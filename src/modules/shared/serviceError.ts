// ============================================================
// A validation/not-found error a service layer can throw without knowing
// anything about HTTP — the controller layer catches this and maps it to
// the existing badRequest(res, message) response shape, keeping that one
// convention consistent across every extracted module.
// ============================================================
export class ServiceError extends Error {
  // status defaults to 400 (badRequest) — pass 403 for ownership/permission
  // failures that the original controller responded to with forbidden().
  status: number;
  // Optional structured payload (e.g. { code, action, requestId,
  // distanceMeters }) threaded through to the response's `data` field
  // alongside the human-readable `message` — see attendance.controller.ts's
  // handleServiceError. Undefined for every existing throw site, so this is
  // fully backward compatible.
  meta?: Record<string, any>;

  constructor(message: string, status: number = 400, meta?: Record<string, any>) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.meta = meta;
  }
}
