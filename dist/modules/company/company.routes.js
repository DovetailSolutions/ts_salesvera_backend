"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jwtVerify_1 = require("../../config/jwtVerify");
const rbac_1 = require("../../app/middlewear/rbac");
const CompanyController = __importStar(require("./company.controller"));
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
// ============================================================
// Company routes — mounted directly on the /admin router in server.ts, same
// URL paths and same authorizeRoles gates as before. This module fully
// replaces the company functions that used to live in
// admin.ts/router/admin.ts.
// ============================================================
const router = (0, express_1.Router)();
const companyUpload = (0, fileUploads_1.default)("company");
const companyUploadFields = companyUpload.fields([
    { name: "companyProfileImg", maxCount: 1 },
    { name: "companyStampImg", maxCount: 1 },
    { name: "companySignatureImg", maxCount: 1 },
]);
router.post("/addcompany", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), companyUploadFields, CompanyController.addCompany);
router.get("/getcompany", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.getCompany);
router.get("/getcompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.getCompanyById);
// Settings module's read-only Company Policy tab — manager-accessible
// (unlike the full company record above), scoped to policy fields only.
router.get("/company-policy", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), CompanyController.getCompanyPolicy);
router.patch("/updatecompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), companyUploadFields, CompanyController.updateCompany);
router.post("/assign-company-manager/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.assignCompanyManager);
router.delete("/remove-company-manager", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.removeCompanyManager);
router.get("/company-managers/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.getCompanyManagers);
router.post("/assign-company-admin/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.assignCompanyAdmin);
router.delete("/remove-company-admin", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.removeCompanyAdmin);
router.get("/company-admins/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.getCompanyAdmins);
router.get("/my-companies", jwtVerify_1.tokenCheck, CompanyController.getMyCompanies);
router.post("/switch-company", jwtVerify_1.tokenCheck, CompanyController.switchCompany);
router.delete("/deletecompany/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.deleteCompany);
router.post("/add-bank", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_ONLY), CompanyController.addCompanyBank);
router.get("/getowncompany", jwtVerify_1.tokenCheck, CompanyController.getOwnCompany);
exports.default = router;
