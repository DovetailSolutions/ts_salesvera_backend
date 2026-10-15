import { QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../../config/dbConnection";
import { getISTDateString } from "./dateUtils";

// ============================================================
// Proforma invoice numbers — PI/<financial year>/<4-digit counter>, e.g.
// PI/2026-27/0001. One counter per company per Indian financial year
// (1 April – 31 March, IST), so every company starts at 0001 and restarts
// at 0001 each April.
//
// Counters live in the existing business_id_sequences table (see migration
// 0018) as one row per company+year — entityType "pi:<companyId>:<FY start
// year>" — so no schema change is needed.
//
// Must be called inside the transaction that creates the proforma invoice:
// the UPDATE row-locks the counter until that transaction ends, so two
// concurrent saves can never receive the same number, and a save that
// rolls back releases its number (no gaps from failed saves).
// ============================================================

export const PROFORMA_INVOICE_PREFIX = "PI";
const COUNTER_PAD_WIDTH = 4;

// "2026-10-15" → { startYear: 2026, label: "2026-27" }; Jan–Mar belong to
// the financial year that started the previous April.
export const financialYearOf = (istDate: string): { startYear: number; label: string } => {
  const year = Number(istDate.slice(0, 4));
  const month = Number(istDate.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return { startYear, label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}` };
};

export const formatProformaInvoiceNumber = (fyLabel: string, counter: number): string =>
  `${PROFORMA_INVOICE_PREFIX}/${fyLabel}/${String(counter).padStart(COUNTER_PAD_WIDTH, "0")}`;

export const allocateProformaInvoiceNumber = async (
  companyId: number,
  transaction: Transaction,
  istDate: string = getISTDateString()
): Promise<string> => {
  const fy = financialYearOf(istDate);
  const entityType = `pi:${Number(companyId) || 0}:${fy.startYear}`;

  await sequelize.query(
    `INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
     VALUES (:entityType, :prefix, 1)
     ON CONFLICT ("entityType") DO NOTHING`,
    { replacements: { entityType, prefix: PROFORMA_INVOICE_PREFIX }, transaction }
  );

  const [row] = await sequelize.query<{ num: number }>(
    `UPDATE "business_id_sequences"
        SET "nextNumber" = "nextNumber" + 1, "updatedAt" = NOW()
      WHERE "entityType" = :entityType
      RETURNING "nextNumber" - 1 AS "num"`,
    { replacements: { entityType }, type: QueryTypes.SELECT, transaction }
  );
  if (!row) throw new Error("Proforma invoice number sequence is not available");

  return formatProformaInvoiceNumber(fy.label, Number(row.num));
};
