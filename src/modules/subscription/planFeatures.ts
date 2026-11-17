// ============================================================
// SalesVera plan catalogue — the single source of truth for which feature
// belongs to which plan tier, and which API routes each feature owns.
//
//   LITE      Attendance & HR, employee management, collaboration
//   PRO       + client visits, travel allowance, expenses, field reports
//   ADVANCE   + separation, orders, inventory, assets, executive dashboard,
//               business reports
//   TALLY     paid add-on, ADVANCE only
//
// Each tier includes everything in the tiers before it. Core Lite features
// are not listed in FEATURE_ROUTES at all — they are always reachable, so a
// gap in this table can only ever leave a route open, never lock one.
// Kept free of any DB import so the frontend-facing catalogue endpoint and
// tests can use it directly.
// ============================================================

export type PlanTier = "LITE" | "PRO" | "ADVANCE";
export const TIER_ORDER: PlanTier[] = ["LITE", "PRO", "ADVANCE"];
export const TIER_LABEL: Record<PlanTier, string> = {
  LITE: "SalesVera Lite",
  PRO: "SalesVera Pro",
  ADVANCE: "SalesVera Advance",
};

export type AddonCode = "TALLY";
export const ADDONS: Record<AddonCode, { label: string; requiresTier: PlanTier; description: string }> = {
  TALLY: {
    label: "Tally Integration",
    requiresTier: "ADVANCE",
    description: "Two-way Tally sync, sales orders and invoices from Tally, outstanding report",
  },
};

export type FeatureKey =
  | "attendance"
  | "employees"
  | "collaboration"
  | "client_visits"
  | "travel_allowance"
  | "expenses"
  | "field_reports"
  | "separation"
  | "order_management"
  | "inventory"
  | "assets"
  | "executive_dashboard"
  | "business_reports"
  | "tally";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  group: string;
  tier: PlanTier;
  addon?: AddonCode;
  includes: string[];
}

export const FEATURES: FeatureDef[] = [
  {
    key: "attendance", label: "Attendance & HR", group: "Attendance & HR", tier: "LITE",
    includes: [
      "Punch in / punch out", "Geo-fencing and location radius", "Geo-tagged attendance",
      "GPS validation, registered device, selfie", "Leave with manager approval",
      "Attendance regularization", "Shifts and department allocation", "Attendance and leave reports",
    ],
  },
  {
    key: "employees", label: "Employee Management", group: "Employee Management", tier: "LITE",
    includes: ["Employee directory and profiles", "Branch, department and shift assignment",
      "Role-based access", "Bulk user and permission management"],
  },
  {
    key: "collaboration", label: "Collaboration", group: "Collaboration", tier: "LITE",
    includes: ["Tasks with priorities, Kanban and deadlines", "Team chat (direct and group)",
      "Announcements", "Instant notifications"],
  },
  {
    key: "client_visits", label: "Customers & Meetings", group: "Client Visits", tier: "PRO",
    includes: ["Client directory, search, CSV upload", "Meeting scheduling",
      "Meeting check-in with geo-tag and photo", "Meeting outcomes and notes"],
  },
  {
    key: "travel_allowance", label: "Travel & Mileage", group: "Client Visits", tier: "PRO",
    includes: ["GPS-verified travel distance", "Vehicle-wise per-km travel allowance"],
  },
  {
    key: "expenses", label: "Expense Management", group: "Client Visits", tier: "PRO",
    includes: ["Claims and categories", "Approval and reimbursement tracking"],
  },
  {
    key: "field_reports", label: "Field Activity Reports", group: "Client Visits", tier: "PRO",
    includes: ["Meeting and expense reports"],
  },
  {
    key: "separation", label: "Separation Management", group: "Separation Management", tier: "ADVANCE",
    includes: ["Resignation with manager approval", "Notice period and last working day",
      "Automatic deactivation on last working day"],
  },
  {
    key: "order_management", label: "Order Management", group: "Order Management", tier: "ADVANCE",
    includes: ["Item master, categories, GST and discounts", "Sales orders", "Quotations",
      "Invoice finalisation and generation"],
  },
  {
    key: "inventory", label: "Inventory", group: "Order Management", tier: "ADVANCE",
    includes: ["Stock availability", "Stock movement history"],
  },
  {
    key: "assets", label: "Asset Management", group: "Asset Management", tier: "ADVANCE",
    includes: ["Asset registration with serial numbers", "Assignment to employees",
      "Transfer history", "Asset details and status"],
  },
  {
    key: "executive_dashboard", label: "Executive Dashboard", group: "Reports & Dashboards", tier: "ADVANCE",
    includes: ["Sales and activity insights", "Top performers", "Revenue trends"],
  },
  {
    key: "business_reports", label: "Business Performance Reports", group: "Reports & Dashboards", tier: "ADVANCE",
    includes: ["Order and activity reports", "Invoice and collection reports"],
  },
  {
    key: "tally", label: "Tally Integration", group: "Tally Integration", tier: "ADVANCE", addon: "TALLY",
    includes: ["Two-way Tally sync", "Sales orders from / to Tally", "Invoices from Tally",
      "Outstanding report"],
  },
];

export const FEATURE_BY_KEY: Record<string, FeatureDef> = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

/** Maps a stored plan row to its tier. Unknown/missing → ADVANCE (grandfathered, never lock anyone out by accident). */
export const normalizeTier = (tier: string | null | undefined): PlanTier =>
  TIER_ORDER.includes(tier as PlanTier) ? (tier as PlanTier) : "ADVANCE";

export const tierIncludes = (have: PlanTier, need: PlanTier) => TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);

/** Feature availability for a tier + set of active add-ons. */
export const featuresFor = (tier: PlanTier, addons: string[]): Record<FeatureKey, boolean> => {
  const out = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) {
    out[f.key] = tierIncludes(tier, f.tier) && (!f.addon || addons.includes(f.addon));
  }
  return out;
};

// ── Route ownership ───────────────────────────────────────────────────────
// Matched against the lower-cased request path (no query string). Covers
// both the web ("/admin/...") and mobile ("/api/...") surfaces.
export const FEATURE_ROUTES: Array<{ feature: FeatureKey; pattern: RegExp }> = [
  // Pro — client visits
  { feature: "client_visits", pattern: /^\/admin\/(clients|meetings)(\/|$)/ },
  { feature: "client_visits", pattern: /^\/admin\/(create-client|get-client|my-clients|get-client-details|client-details|update-client|assign-meeting|bulk-upload)(\/|$)/ },
  { feature: "client_visits", pattern: /^\/api\/(clientmeeting|my-clients|endmeeting|getmeetinglist|scheduledupdate|createmeeting|create-client|meeting|meetings)(\/|$)/ },
  // Pro — travel & mileage
  { feature: "travel_allowance", pattern: /^\/admin\/(travel|travel-range|vehicle-allowance-rates|fuel-expense|get-fuel-expense)(\/|$)/ },
  { feature: "travel_allowance", pattern: /^\/admin\/sales-person\/[^/]+\/travel(\/|$)/ },
  { feature: "travel_allowance", pattern: /^\/admin\/sales-team\/travel-summary(\/|$)/ },
  { feature: "travel_allowance", pattern: /^\/api\/(travel|travel-range)(\/|$)/ },
  // Pro — expenses
  { feature: "expenses", pattern: /^\/admin\/(getexpense|getexpance|get-expense|export-expense|addexpense|addexpance|expense)(\/|$)/ },
  { feature: "expenses", pattern: /^\/api\/(getexpense|expense|user-expense|approved-expense)(\/|$)/ },
  // Advance — separation
  { feature: "separation", pattern: /^\/admin\/separation(\/|$)/ },
  // Advance — order management (items, quotations/sale orders, invoices, sale records)
  { feature: "order_management", pattern: /^\/admin\/(addcategory|getcategory|getcategory-with-subcategories|getcategoy|updatecategory|deletecategory|category|sub-category|addsubcategory|updatesubcategory|getsubcategory|add|addquotation|getquotationlist|getquotationpdflist|downloadquotationpdf|addquotationpdf|addinvoice|getinvoice|updateinvoice|finalizeinvoice|get-record-sale)(\/|$)/ },
  { feature: "order_management", pattern: /^\/api\/(getcategory|getsubcategory|addquotation|getquotation|getquotationpdf|getquotationpdflist|downloadquotationpdf|addinvoice|getinvoice|quotationtoinvoice|recordsale|getrecordsale|updaterecordsale|deleterecordsale)(\/|$)/ },
  // Advance — inventory
  { feature: "inventory", pattern: /^\/admin\/inventory(\/|$)/ },
  // Advance — assets
  { feature: "assets", pattern: /^\/admin\/(assets|asset-categories|asset-assignments|my-assets)(\/|$)/ },
  { feature: "assets", pattern: /^\/api\/my-assets(\/|$)/ },
  // Advance — executive dashboard
  { feature: "executive_dashboard", pattern: /^\/admin\/(top-performers|monthly-revenue|client-type-breakdown)(\/|$)/ },
  { feature: "executive_dashboard", pattern: /^\/api\/(top-performers|getsalesperformance)(\/|$)/ },
  // Tally add-on — connector push endpoints and outstanding reports
  { feature: "tally", pattern: /^\/admin\/bulk(\/|$)/ },
  { feature: "tally", pattern: /^\/admin\/(get-report|add-report|update-report|delete-report|get-report-details)(\/|$)/ },
  { feature: "tally", pattern: /^\/api\/tally-report(\/|$)/ },
];

export const featureForPath = (rawPath: string): FeatureKey | null => {
  const path = rawPath.split("?")[0].replace(/\/+$/, "").toLowerCase();
  for (const r of FEATURE_ROUTES) if (r.pattern.test(path)) return r.feature;
  return null;
};
