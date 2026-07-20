import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as ReportsController from "./reports.controller";

// ============================================================
// Reports (Insights) routes — Download Reports module. "insights" is a
// deliberately separate permission module from "report" (which is fully
// owned by the frozen Tally proforma/sales-report feature).
// ============================================================
const router = Router();

router.get("/reports/generate", tokenCheck, checkPermission("insights", "view"), ReportsController.generateReport);

export default router;
