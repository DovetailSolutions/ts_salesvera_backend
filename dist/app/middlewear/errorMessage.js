"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalServerError = exports.validationError = exports.conflict = exports.notFound = exports.forbidden = exports.unauthorized = exports.badRequest = exports.getSuccess = exports.createSuccess = void 0;
// ✅ Generic Response Function
const sendResponse = (res, success, message, code, data = {}) => {
    return res.status(code).json({
        success,
        code,
        message,
        data,
    });
};
// ✅ Success Responses
const createSuccess = (res, message, data = {}, code = 200) => sendResponse(res, true, message, code, data);
exports.createSuccess = createSuccess;
const getSuccess = (res, message, data = {}, code = 201) => sendResponse(res, true, message, code, data);
exports.getSuccess = getSuccess;
// ✅ Error Responses
const badRequest = (res, message, data = {}) => sendResponse(res, false, message, 400, data);
exports.badRequest = badRequest;
const unauthorized = (res, message, data = {}) => sendResponse(res, false, message, 401, data);
exports.unauthorized = unauthorized;
const forbidden = (res, message, data = {}) => sendResponse(res, false, message, 403, data);
exports.forbidden = forbidden;
const notFound = (res, message, data = {}) => sendResponse(res, false, message, 404, data);
exports.notFound = notFound;
const conflict = (res, message, data = {}) => sendResponse(res, false, message, 409, data);
exports.conflict = conflict;
const validationError = (res, message, data = {}) => sendResponse(res, false, message, 422, data);
exports.validationError = validationError;
const internalServerError = (res, message, data = {}) => sendResponse(res, false, message, 500, data);
exports.internalServerError = internalServerError;
