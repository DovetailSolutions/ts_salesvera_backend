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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jwtVerify_1 = require("../../config/jwtVerify");
const rbac_1 = require("../middlewear/rbac");
const TaskController = __importStar(require("../controller/task"));
const router = (0, express_1.Router)();
// All task routes require a valid JWT and admin/manager role
router.post("/create", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), TaskController.createTask);
router.get("/list", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), TaskController.getAllTasks);
router.get("/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), TaskController.getTaskById);
router.patch("/update/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), TaskController.updateTask);
router.delete("/delete/:id", jwtVerify_1.tokenCheck, (0, rbac_1.authorizeRoles)(...rbac_1.ADMIN_AND_MANAGER), TaskController.deleteTask);
exports.default = router;
