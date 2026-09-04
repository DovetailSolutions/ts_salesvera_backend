"use strict";
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
exports.deleteFromSpaces = exports.getObjectFromSpaces = exports.uploadBufferToSpaces = exports.buildSpacesUrl = exports.spacesClient = exports.SPACES_BUCKET = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
// Shared DigitalOcean Spaces client — Spaces is S3-API-compatible, so the AWS SDK
// works unmodified against it once pointed at the Spaces endpoint/credentials.
exports.SPACES_BUCKET = process.env.DO_SPACES_BUCKET;
exports.spacesClient = new client_s3_1.S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});
const buildSpacesUrl = (key, bucket = exports.SPACES_BUCKET) => {
    const host = process.env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "");
    return `https://${bucket}.${host}/${key}`;
};
exports.buildSpacesUrl = buildSpacesUrl;
const uploadBufferToSpaces = (key_1, buffer_1, contentType_1, ...args_1) => __awaiter(void 0, [key_1, buffer_1, contentType_1, ...args_1], void 0, function* (key, buffer, contentType, bucket = exports.SPACES_BUCKET) {
    yield exports.spacesClient.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
    }));
    return (0, exports.buildSpacesUrl)(key, bucket);
});
exports.uploadBufferToSpaces = uploadBufferToSpaces;
const getObjectFromSpaces = (key_1, ...args_1) => __awaiter(void 0, [key_1, ...args_1], void 0, function* (key, bucket = exports.SPACES_BUCKET) {
    return exports.spacesClient.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key }));
});
exports.getObjectFromSpaces = getObjectFromSpaces;
const deleteFromSpaces = (key_1, ...args_1) => __awaiter(void 0, [key_1, ...args_1], void 0, function* (key, bucket = exports.SPACES_BUCKET) {
    yield exports.spacesClient.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key }));
});
exports.deleteFromSpaces = deleteFromSpaces;
