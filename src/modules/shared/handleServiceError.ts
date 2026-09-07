import { Response } from "express";
import { badRequest, forbidden } from "../../app/middlewear/errorMessage";
import { ServiceError } from "./serviceError";

// ============================================================
// Shared controller-layer error mapper — a ServiceError becomes
// badRequest(400)/forbidden(403) with its optional `meta` threaded through
// as the response's `data` field (e.g. { code, action, requestId,
// distanceMeters }), so a caller can branch on structured error info
// without parsing the human message. Any other thrown value falls back to
// a generic 400 with its message (or "Something went wrong").
//
// Extracted from attendance.controller.ts's private handleServiceError so
// attendanceSecurity.controller.ts can reuse the identical mapping instead
// of duplicating it — attendance.controller.ts now re-exports this same
// function rather than keeping its own copy.
// ============================================================
export const handleServiceError = (res: Response, error: unknown): void => {
  if (error instanceof ServiceError) {
    if (error.status === 403) {
      forbidden(res, error.message, error.meta ?? {});
    } else {
      badRequest(res, error.message, error.meta ?? {});
    }
    return;
  }
  const errorMessage = error instanceof Error ? error.message : "Something went wrong";
  badRequest(res, errorMessage);
};
