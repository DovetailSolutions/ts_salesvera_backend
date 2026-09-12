import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as CompanyController from "./company.controller";
import getUploadMiddleware from "../../config/fileUploads";

// ============================================================
// Company routes — mounted directly on the /admin router in server.ts, same
// URL paths and same authorizeRoles gates as before. This module fully
// replaces the company functions that used to live in
// admin.ts/router/admin.ts.
// ============================================================
const router = Router();

const companyUpload = getUploadMiddleware("company");
const companyUploadFields = companyUpload.fields([
  { name: "companyProfileImg", maxCount: 1 },
  { name: "companyStampImg", maxCount: 1 },
  { name: "companySignatureImg", maxCount: 1 },
]);

router.post("/addcompany", tokenCheck, authorizeRoles(...ADMIN_ONLY), companyUploadFields, CompanyController.addCompany);
router.get("/getcompany", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompany);
router.get("/getcompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompanyById);
// Settings module's read-only Company Policy tab — manager-accessible
// (unlike the full company record above), scoped to policy fields only.
router.get("/company-policy", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getCompanyPolicy);
router.patch("/updatecompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), companyUploadFields, CompanyController.updateCompany);
router.post("/assign-company-manager/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.assignCompanyManager);
router.delete("/remove-company-manager", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.removeCompanyManager);
router.get("/company-managers/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompanyManagers);
router.post("/assign-company-admin/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.assignCompanyAdmin);
router.delete("/remove-company-admin", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.removeCompanyAdmin);
router.get("/company-admins/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompanyAdmins);
router.get("/my-companies", tokenCheck, CompanyController.getMyCompanies);
router.post("/switch-company", tokenCheck, CompanyController.switchCompany);
router.delete("/deletecompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.deleteCompany);
router.post("/add-bank", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.addCompanyBank);
router.get("/get-bank", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getCompanyBanks);
router.get("/get-bank/:id", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getCompanyBankById);
router.patch("/update-bank/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.updateCompanyBank);
router.delete("/delete-bank/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.deleteCompanyBank);
router.get("/getowncompany", tokenCheck, CompanyController.getOwnCompany);

// Vehicle Allowance Rate — effective-dated history (migration 0023). Same
// admin-edits/manager-views split as the rest of Company settings above.
router.get("/vehicle-allowance-rates", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getVehicleAllowanceRates);
router.post("/vehicle-allowance-rates", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.addVehicleAllowanceRate);

// Per-user override — a simple current-value rate for one staff member
// (including ₹0), taking priority over the company-wide rate above. View:
// admin+manager (matches the company rate's own view gate); edit: admin
// only. Registered AFTER the plain "/vehicle-allowance-rates" routes so
// Express doesn't try to match "/users" against a param route first.
router.get("/vehicle-allowance-rates/users", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getUserVehicleAllowanceOverrides);
router.post("/vehicle-allowance-rates/users/:userId", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.setUserVehicleAllowanceRate);
router.delete("/vehicle-allowance-rates/users/:userId", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.clearUserVehicleAllowanceRate);

export default router;
