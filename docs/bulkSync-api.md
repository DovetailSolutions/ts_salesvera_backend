# Bulk Sync API — Developer Reference

Base URL: `https://<your-domain>/admin/bulk`

All endpoints require a **Bearer token** in the Authorization header.

---

## Authentication

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## Common Request Envelope

Every endpoint accepts the same outer envelope structure:

```json
{
  "source": "Tally",
  "company": {
    "name": "My Company Pvt Ltd",
    "guid": "TALLY-COMPANY-GUID-HERE"
  },
  "financialYear": "2024-25",
  "dateRange": {
    "from": "2024-04-01",
    "to": "2025-03-31"
  },
  "batch": {
    "uploadId": "upload-001",
    "index": 1,
    "total": 3
  },
  "records": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | No | Source system name (e.g. `"Tally"`) |
| `company.guid` | string | **Yes** | Unique GUID of the company in Tally |
| `company.name` | string | No | Company display name |
| `financialYear` | string | No | e.g. `"2024-25"` |
| `dateRange.from` | string | No | Date filter start `YYYY-MM-DD` |
| `dateRange.to` | string | No | Date filter end `YYYY-MM-DD` |
| `batch.uploadId` | string | No | Unique ID for this upload batch |
| `batch.index` | number | No | Current batch number (1-based) |
| `batch.total` | number | No | Total number of batches |
| `records` | array | **Yes** | Array of records (min 1 item) |

---

## Common Response Format

### Success (200)

```json
{
  "message": "Bulk invoices processed",
  "data": {
    "summary": {
      "received": 3,
      "created": 2,
      "updated": 1,
      "failed": 0
    },
    "results": [
      { "tallyGuid": "GUID-001", "status": "created", "id": 101 },
      { "tallyGuid": "GUID-002", "status": "updated", "id": 88 },
      { "tallyGuid": "GUID-003", "status": "created", "id": 102 }
    ]
  }
}
```

| Result status | Meaning |
|---------------|---------|
| `created` | New record inserted into DB |
| `updated` | Existing record updated |
| `failed` | Record skipped — see `error` field |

### Error (400)

```json
{
  "message": "Invalid envelope: company.guid and records[] are required"
}
```

---

## Dedup Strategy

All four endpoints are **idempotent** — safe to call multiple times with the same data.

| Endpoint | Primary key (GUID-first) | Fallback key |
|----------|--------------------------|--------------|
| `/invoices` | `tallyGuid` + `companyId` | — (no fallback; `tallyGuid` required) |
| `/quotations` | `tallyGuid` + `companyId` | — (no fallback; `tallyGuid` required) |
| `/clients` | `tallyGuid` | `mobile` OR `email` |
| `/stock-items` | `tallyGuid` + `adminId` | `name` + `CategoryId` + `adminId` |

**Fallback backfill** — For `/clients` and `/stock-items`, when an existing record is matched via the fallback key, the `tallyGuid` is immediately written back onto that row. This means the first sync may use the fallback; every subsequent sync will hit the fast GUID path instead.

> **DB migration required** — The `tally_guid` column must be added to `meeting_users` and `sub_categories` tables before deploying the new dedup logic.

---

## Endpoints

---

### 1. POST `/admin/bulk/invoices`

Push sales vouchers (invoices) from Tally.

**Dedup key:** `tallyGuid` + `companyId` (GUID required — no fallback)

#### Record fields

```json
{
  "tallyGuid": "SALES-VOUCHER-GUID-001",
  "voucherNumber": "INV-2024-001",
  "party": "ABC Traders",
  "date": "2024-06-15",
  "alterId": "1234"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tallyGuid` | string | **Yes** | Unique GUID from Tally voucher |
| `voucherNumber` | string | No | Invoice number (e.g. `INV-2024-001`) |
| `party` | string | No | Customer / party name |
| `date` | string | No | Invoice date `YYYY-MM-DD` |
| `alterId` | string/number | No | Tally alter ID for change tracking |

> You may include any additional fields inside each record object — the entire record object is stored as-is in the `invoice` JSON column.

#### Full example request

```json
{
  "source": "Tally",
  "company": {
    "name": "My Company Pvt Ltd",
    "guid": "TALLY-CO-GUID-001"
  },
  "financialYear": "2024-25",
  "dateRange": { "from": "2024-04-01", "to": "2025-03-31" },
  "batch": { "uploadId": "inv-batch-001", "index": 1, "total": 1 },
  "records": [
    {
      "tallyGuid": "SALES-VOUCHER-GUID-001",
      "voucherNumber": "INV-2024-001",
      "party": "ABC Traders",
      "date": "2024-06-15",
      "alterId": "1234",
      "netAmount": 15000,
      "taxAmount": 2700,
      "items": []
    },
    {
      "tallyGuid": "SALES-VOUCHER-GUID-002",
      "voucherNumber": "INV-2024-002",
      "party": "XYZ Pvt Ltd",
      "date": "2024-06-20",
      "alterId": "1235"
    }
  ]
}
```

---

### 2. POST `/admin/bulk/quotations`

Push quotation vouchers from Tally.

**Dedup key:** `tallyGuid` + `companyId` (GUID required — no fallback)

#### Record fields

```json
{
  "tallyGuid": "QUOT-VOUCHER-GUID-001",
  "voucherNumber": "QT-2024-001",
  "referenceNumber": "REF-001",
  "party": "ABC Traders",
  "alterId": "5678"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tallyGuid` | string | **Yes** | Unique GUID from Tally voucher |
| `voucherNumber` | string | No | Quotation number |
| `referenceNumber` | string | No | Reference number |
| `party` | string | No | Customer / party name |
| `alterId` | string/number | No | Tally alter ID for change tracking |

> The entire record object is stored as-is in the `quotation` JSON column.

#### Full example request

```json
{
  "source": "Tally",
  "company": {
    "name": "My Company Pvt Ltd",
    "guid": "TALLY-CO-GUID-001"
  },
  "batch": { "uploadId": "quot-batch-001", "index": 1, "total": 1 },
  "records": [
    {
      "tallyGuid": "QUOT-VOUCHER-GUID-001",
      "voucherNumber": "QT-2024-001",
      "referenceNumber": "REF-001",
      "party": "ABC Traders",
      "alterId": "5678",
      "totalAmount": 50000
    }
  ]
}
```

---

### 3. POST `/admin/bulk/clients`

Push ledger master (Sundry Debtors) as clients.

**Dedup key:** `tallyGuid` first → falls back to `mobile` OR `email`

**Lookup order:**
1. If `tallyGuid` is present, search `meeting_users` by `tallyGuid`
2. If not found, search by `mobile` OR `email` (whichever are present)
3. On a fallback match, `tallyGuid` is backfilled onto the row

> If none of `tallyGuid`, `mobile`, or `email` is provided the record is skipped with `status: "failed"`.

**Row status** — both new and updated records are set to `"imported"`.

#### Record fields

```json
{
  "tallyGuid": "LEDGER-GUID-001",
  "name": "Ramesh Gupta",
  "email": "ramesh@example.com",
  "mobile": "9876543210",
  "companyName": "Gupta Enterprises",
  "customerType": "existing",
  "address": "123 MG Road",
  "city": "Pune",
  "state": "Maharashtra",
  "country": "India",
  "gstNumber": "27AABCU9603R1ZX",
  "panNumber": "AABCU9603R"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tallyGuid` / `guid` | string | No* | GUID from Tally ledger — **primary dedup key** |
| `name` | string | No | Full name of the client |
| `email` | string | No* | Email — used as fallback dedup key |
| `mobile` / `phone` | string | No* | Mobile number — used as fallback dedup key |
| `companyName` | string | No | Client's company name |
| `customerType` | string | No | `"existing"` or `"new"` (default: `"existing"`) |
| `address` | string | No | Full address |
| `city` | string | No | City |
| `state` | string | No | State |
| `country` | string | No | Country |
| `gstNumber` | string | No | GST registration number |
| `panNumber` | string | No | PAN number |

*At least one of `tallyGuid`, `mobile`, or `email` must be present.

#### Full example request

```json
{
  "source": "Tally",
  "company": {
    "name": "My Company Pvt Ltd",
    "guid": "TALLY-CO-GUID-001"
  },
  "batch": { "uploadId": "clients-batch-001", "index": 1, "total": 1 },
  "records": [
    {
      "tallyGuid": "LEDGER-GUID-001",
      "name": "Ramesh Gupta",
      "email": "ramesh@example.com",
      "mobile": "9876543210",
      "companyName": "Gupta Enterprises",
      "customerType": "existing",
      "address": "123 MG Road",
      "city": "Pune",
      "state": "Maharashtra",
      "country": "India",
      "gstNumber": "27AABCU9603R1ZX",
      "panNumber": "AABCU9603R"
    },
    {
      "tallyGuid": "LEDGER-GUID-002",
      "name": "Sunita Shah",
      "mobile": "9123456789",
      "companyName": "Shah & Co.",
      "state": "Gujarat",
      "country": "India"
    }
  ]
}
```

---

### 4. POST `/admin/bulk/stock-items`

Push stock item master from Tally (maps to product sub-categories).

**Dedup key:** `tallyGuid` + `adminId` first → falls back to `name` + `CategoryId` + `adminId`

**Lookup order:**
1. If `tallyGuid` is present, search `sub_categories` by `tallyGuid` + `adminId`
2. If not found, search by `sub_category_name` + `CategoryId` + `adminId`
3. On a fallback match, `tallyGuid` is backfilled onto the row

> If `name` is missing the record is skipped with `status: "failed"`.

#### Record fields

```json
{
  "tallyGuid": "STOCK-GUID-001",
  "name": "Water Pump 1HP",
  "CategoryId": 5,
  "amount": 4500.00,
  "rate": 4500.00,
  "unit": "NOS",
  "hsnCode": "84137000",
  "gst": 18,
  "tax": 18
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tallyGuid` / `guid` | string | No | GUID from Tally stock item — **primary dedup key** |
| `name` / `stockItemName` | string | **Yes** | Stock item / product name — fallback dedup key |
| `CategoryId` / `categoryId` | number | No | Category ID in SalesVera — used in fallback dedup |
| `amount` / `rate` | number | No | Unit price / rate |
| `unit` | string | No | Unit of measure (e.g. `"NOS"`, `"KG"`, `"LTR"`) |
| `hsnCode` | string | No | HSN / SAC code |
| `gst` / `tax` | number | No | GST percentage (e.g. `18` for 18%) |

#### Full example request

```json
{
  "source": "Tally",
  "company": {
    "name": "My Company Pvt Ltd",
    "guid": "TALLY-CO-GUID-001"
  },
  "batch": { "uploadId": "stock-batch-001", "index": 1, "total": 1 },
  "records": [
    {
      "tallyGuid": "STOCK-GUID-001",
      "name": "Water Pump 1HP",
      "CategoryId": 5,
      "amount": 4500.00,
      "unit": "NOS",
      "hsnCode": "84137000",
      "gst": 18
    },
    {
      "tallyGuid": "STOCK-GUID-002",
      "name": "PVC Pipe 1 inch",
      "CategoryId": 7,
      "amount": 120.00,
      "unit": "MTR",
      "hsnCode": "39172100",
      "gst": 12
    }
  ]
}
```

---

## Notes for the Exe Developer

1. **Batching** — There is no enforced batch size limit server-side, but it is recommended to send **100–500 records per request** to avoid timeouts.
2. **Idempotency** — All endpoints are safe to call multiple times. Records are upserted (insert or update) based on the dedup keys described above.
3. **GUID-first dedup** — Always include `tallyGuid` in every record. For `/clients` and `/stock-items`, the first sync may match on mobile/email/name; from the second sync onward the GUID is stored on the row and used directly — faster and unambiguous.
4. **Partial failure is normal** — A 200 response does not mean all records succeeded. Always check `summary.failed` and `results[].status` per record.
5. **Extra fields are allowed** — Any additional fields sent inside a record object are stored as-is in the JSON column (`invoice`, `quotation`). There is no strict schema rejection for extra fields.
6. **Date format** — Use `YYYY-MM-DD` for all dates (e.g. `"2024-06-15"`).
7. **Auth token** — The JWT token is obtained from the login endpoint. Pass it as `Authorization: Bearer <token>` on every request.
8. **DB migration** — The `tally_guid` column must be added to `meeting_users` and `sub_categories` before deploying. No migration is needed for `invoices` or `quotations` — those tables already have a `guid` column.
