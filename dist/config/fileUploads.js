"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const getUploadMiddleware = (type, maxSizeMB = 100, // Size in MB
maxFiles = 15) => {
    // Use memoryStorage instead of diskStorage
    const storage = multer_1.default.memoryStorage();
    return (0, multer_1.default)({
        storage,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024, // Convert MB to bytes
            files: maxFiles,
        },
    });
};
exports.default = getUploadMiddleware;
