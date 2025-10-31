"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const multer_s3_1 = __importDefault(require("multer-s3"));
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
// Create S3 client once (with credentials)
const s3 = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const getUploadMiddleware = (type, maxSizeMB = 1000, maxFiles = 100) => {
    return (0, multer_1.default)({
        storage: (0, multer_s3_1.default)({
            s3,
            bucket: process.env.AWS_S3_BUCKET,
            contentType: multer_s3_1.default.AUTO_CONTENT_TYPE,
            key: (_req, file, cb) => {
                const ext = file.originalname.split(".").pop();
                cb(null, `${type}/${(0, uuid_1.v4)()}.${ext}`);
            },
        }),
        limits: {
            fileSize: maxSizeMB * 1024 * 1024,
            files: maxFiles,
        },
    });
};
exports.default = getUploadMiddleware;
