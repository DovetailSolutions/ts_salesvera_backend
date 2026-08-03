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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCompanyBank = exports.getOwnCompany = exports.deleteCompany = exports.switchCompany = exports.getCompanyAdmins = exports.removeCompanyAdmin = exports.assignCompanyAdmin = exports.getMyCompanies = exports.getCompanyManagers = exports.removeCompanyManager = exports.assignCompanyManager = exports.updateCompany = exports.getCompanyPolicy = exports.getCompanyById = exports.getCompany = exports.addCompany = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const CompanyService = __importStar(require("./company.service"));
// ============================================================
// Company controller — thin HTTP layer, extracted verbatim from admin.ts's
// addCompany/getCompany/getCompanyById/updateCompany/assignCompanyManager/
// removeCompanyManager/getCompanyManagers/getMyCompanies/switchCompany/
// deleteCompany/getOwnCompany/addCompanyBank.
// ============================================================
const handleServiceError = (res, error) => {
    if (error instanceof serviceError_1.ServiceError)
        return (0, errorMessage_1.badRequest)(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return (0, errorMessage_1.badRequest)(res, errorMessage);
};
const addCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const company = yield CompanyService.addCompany(Number(userData.userId), userData.role, req.body);
        (0, errorMessage_1.createSuccess)(res, "Company added successfully", company);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.addCompany = addCompany;
const getCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield CompanyService.getCompany(Number(userData.userId), req.query);
        (0, errorMessage_1.createSuccess)(res, "Company fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getCompany = getCompany;
const getCompanyById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const company = yield CompanyService.getCompanyById(req.params.id, Number(userData.userId), userData.role);
        (0, errorMessage_1.createSuccess)(res, "Company fetched successfully", company);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getCompanyById = getCompanyById;
const getCompanyPolicy = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const callerCompanyId = userData.companyId ? Number(userData.companyId) : null;
        const policy = yield CompanyService.getCompanyPolicy(Number(userData.userId), userData.role, callerCompanyId);
        (0, errorMessage_1.createSuccess)(res, "Company policy fetched successfully", policy);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getCompanyPolicy = getCompanyPolicy;
const updateCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const updated = yield CompanyService.updateCompany(req.params.id, Number(userData.userId), req.body, userData.role);
        (0, errorMessage_1.createSuccess)(res, "Company updated successfully", updated);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.updateCompany = updateCompany;
const assignCompanyManager = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield CompanyService.assignCompanyManager(req.params.id, Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, result.message, result.record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.assignCompanyManager = assignCompanyManager;
const removeCompanyManager = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        yield CompanyService.removeCompanyManager(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Manager removed from company", null);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.removeCompanyManager = removeCompanyManager;
const getCompanyManagers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const assignments = yield CompanyService.getCompanyManagers(req.params.id, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "Company managers fetched successfully", assignments);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getCompanyManagers = getCompanyManagers;
const getMyCompanies = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const companies = yield CompanyService.getMyCompanies(Number(userData.userId), userData.role);
        (0, errorMessage_1.createSuccess)(res, "Companies fetched successfully", companies);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getMyCompanies = getMyCompanies;
const assignCompanyAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield CompanyService.assignCompanyAdmin(req.params.id, Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, result.message, result.record);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.assignCompanyAdmin = assignCompanyAdmin;
const removeCompanyAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        yield CompanyService.removeCompanyAdmin(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Admin removed from company", null);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.removeCompanyAdmin = removeCompanyAdmin;
const getCompanyAdmins = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const assignments = yield CompanyService.getCompanyAdmins(req.params.id, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "Company admins fetched successfully", assignments);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getCompanyAdmins = getCompanyAdmins;
const switchCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield CompanyService.switchCompany(Number(userData.userId), userData.role, req.body);
        (0, errorMessage_1.createSuccess)(res, "Company switched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.switchCompany = switchCompany;
const deleteCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        yield CompanyService.deleteCompany(req.params.id, Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "Company deleted successfully");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.deleteCompany = deleteCompany;
const getOwnCompany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const companies = yield CompanyService.getOwnCompany(Number(userData.userId));
        (0, errorMessage_1.createSuccess)(res, "Company fetched successfully", companies);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.getOwnCompany = getOwnCompany;
const addCompanyBank = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        const result = yield CompanyService.addCompanyBank(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Bank details added successfully", result);
    }
    catch (error) {
        // Original preserved this specific generic message rather than error.message.
        if (error instanceof serviceError_1.ServiceError) {
            (0, errorMessage_1.badRequest)(res, error.message);
            return;
        }
        (0, errorMessage_1.badRequest)(res, "Error adding bank details", error);
    }
});
exports.addCompanyBank = addCompanyBank;
