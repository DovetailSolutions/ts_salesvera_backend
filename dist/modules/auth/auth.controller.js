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
exports.changePassword = exports.verifyOtp = exports.forgotPassword = exports.UpdatePassword = exports.UpdateProfile = exports.GetProfile = exports.Logout = exports.Login = exports.Register = void 0;
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const serviceError_1 = require("../shared/serviceError");
const AuthService = __importStar(require("./auth.service"));
// ============================================================
// Auth controller — thin HTTP layer, extracted verbatim from admin.ts's
// Register/Login/Logout/GetProfile/UpdateProfile/UpdatePassword/
// forgotPassword/verifyOtp/changePassword.
// ============================================================
const handleServiceError = (res, error) => {
    if (error instanceof serviceError_1.ServiceError)
        return (0, errorMessage_1.badRequest)(res, error.message);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return (0, errorMessage_1.badRequest)(res, errorMessage, error);
};
const Register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { item, accessToken, role } = yield AuthService.register(req.body, req.userData);
        (0, errorMessage_1.createSuccess)(res, `${role} registered successfully`, { item, accessToken });
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.Register = Register;
const Login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield AuthService.login(req.body);
        (0, errorMessage_1.createSuccess)(res, "Login successful", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.Login = Login;
const Logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        if (!userData || !userData.userId) {
            (0, errorMessage_1.badRequest)(res, "Unauthorized request");
            return;
        }
        yield AuthService.logout(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Logout successful");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.Logout = Logout;
const GetProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { userId, role, companyId } = userData;
        const result = yield AuthService.getProfile(Number(userId), role, companyId);
        (0, errorMessage_1.createSuccess)(res, "User profile fetched successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.GetProfile = GetProfile;
const UpdateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const { userId } = userData;
        const result = yield AuthService.updateProfile(Number(userId), req.body, req.file);
        (0, errorMessage_1.createSuccess)(res, "Profile updated successfully", result);
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.UpdateProfile = UpdateProfile;
const UpdatePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        yield AuthService.updatePassword(Number(userData.userId), req.body);
        (0, errorMessage_1.createSuccess)(res, "Password updated successfully");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.UpdatePassword = UpdatePassword;
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield AuthService.forgotPassword(req.body);
        (0, errorMessage_1.createSuccess)(res, "OTP sent to your email");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.forgotPassword = forgotPassword;
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield AuthService.verifyOtp(req.body);
        (0, errorMessage_1.createSuccess)(res, "OTP verified successfully");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.verifyOtp = verifyOtp;
const changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield AuthService.changePassword(req.body);
        (0, errorMessage_1.createSuccess)(res, "Password changed successfully");
    }
    catch (error) {
        handleServiceError(res, error);
    }
});
exports.changePassword = changePassword;
