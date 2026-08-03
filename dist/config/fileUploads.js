"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const multer_s3_1 = __importDefault(require("multer-s3"));
const uuid_1 = require("uuid");
const spaces_1 = require("./spaces");
const getUploadMiddleware = (type, maxSizeMB = 1000, maxFiles = 100) => {
    return (0, multer_1.default)({
        storage: (0, multer_s3_1.default)({
            s3: spaces_1.spacesClient,
            bucket: spaces_1.SPACES_BUCKET,
            contentType: multer_s3_1.default.AUTO_CONTENT_TYPE,
            key: (_req, file, cb) => {
                const ext = file.originalname.split(".").pop();
                cb(null, `salesvera/${type}/${(0, uuid_1.v4)()}.${ext}` // < === added "newProject/"
                );
            },
        }),
        limits: {
            fileSize: maxSizeMB * 1024 * 1024,
            files: maxFiles,
        },
    });
};
exports.default = getUploadMiddleware;
