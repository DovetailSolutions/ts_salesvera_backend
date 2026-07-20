import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_ONLY, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as CompanyController from "./company.controller";

// ============================================================
// Company routes — mounted directly on the /admin router in server.ts, same
// URL paths and same authorizeRoles gates as before. This module fully
// replaces the company functions that used to live in
// admin.ts/router/admin.ts.
// ============================================================
const router = Router();

router.post("/addcompany", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.addCompany);
router.get("/getcompany", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompany);
router.get("/getcompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.getCompanyById);
// Settings module's read-only Company Policy tab — manager-accessible
// (unlike the full company record above), scoped to policy fields only.
router.get("/company-policy", tokenCheck, authorizeRoles(...ADMIN_AND_MANAGER), CompanyController.getCompanyPolicy);
router.patch("/updatecompany/:id", tokenCheck, authorizeRoles(...ADMIN_ONLY), CompanyController.updateCompany);
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
router.get("/getowncompany", tokenCheck, CompanyController.getOwnCompany);

export default router;
