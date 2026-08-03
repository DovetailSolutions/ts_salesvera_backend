"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = void 0;
// ============================================================
// A validation/not-found error a service layer can throw without knowing
// anything about HTTP — the controller layer catches this and maps it to
// the existing badRequest(res, message) response shape, keeping that one
// convention consistent across every extracted module.
// ============================================================
class ServiceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "ServiceError";
        this.status = status;
    }
}
exports.ServiceError = ServiceError;
