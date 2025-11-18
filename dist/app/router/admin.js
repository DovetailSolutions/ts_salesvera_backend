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
const router = (0, express_1.Router)();
const AdminController = __importStar(require("../controller/admin"));
const jwtVerify_1 = require("../../config/jwtVerify");
const fileUploads_1 = __importDefault(require("../../config/fileUploads"));
const profile = (0, fileUploads_1.default)("image");
const meeting = (0, fileUploads_1.default)("image");
const expense = (0, fileUploads_1.default)("expense");
const csv = (0, fileUploads_1.default)("csv");
router.post("/register", AdminController.Register);
router.post("/login", AdminController.Login);
router.get("/getProfile", jwtVerify_1.tokenCheck, AdminController.GetProfile);
router.patch("/updatepassword", jwtVerify_1.tokenCheck, AdminController.UpdatePassword);
router.get("/mysaleperson", jwtVerify_1.tokenCheck, AdminController.MySalePerson);
router.post('/assign-salesman', jwtVerify_1.tokenCheck, AdminController.assignSalesman);
router.get("/getalluser", jwtVerify_1.tokenCheck, AdminController.GetAllUser);
router.get('/getusermeeting', jwtVerify_1.tokenCheck, AdminController.getMeeting);
router.post("/addcategory", jwtVerify_1.tokenCheck, AdminController.AddCategory);
router.get("/getcategory", jwtVerify_1.tokenCheck, AdminController.getcategory);
router.get("/getcategoy/:id", jwtVerify_1.tokenCheck, AdminController.categoryDetails);
router.patch("/updatecategory/:id", jwtVerify_1.tokenCheck, AdminController.UpdateCategory);
router.delete("/deletecategory/:id", jwtVerify_1.tokenCheck, AdminController.DeleteCategory);
router.post("/bulk-upload", csv.array("csv"), AdminController.BulkUploads);
// meeting apis 
exports.default = router;
