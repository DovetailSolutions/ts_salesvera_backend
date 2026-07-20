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

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}
