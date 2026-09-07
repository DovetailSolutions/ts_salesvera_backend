import { Request, Response, NextFunction } from "express";
import getUploadMiddleware from "../../config/fileUploads";
import { badRequest } from "../../app/middlewear/errorMessage";

// ============================================================
// Punch-in photo upload middleware, shared by attendance.routes.ts (admin
// side) and attendanceSelf.routes.ts (self-service side) — both call the
// same attendancePunchIn service function, so both need identical handling.
//
// This wraps multer's single-file upload in its own error handler because
// server.ts's only error-handling middleware (line ~56) is registered
// BEFORE the routers are mounted, so it never sees an error thrown inside a
// route handler registered later — without this wrapper, a rejected file
// type/size would fall through to Express's raw default error response
// instead of the clear message required here.
//
// Always attached to the route; whether a photo is actually REQUIRED is a
// per-user runtime decision enforced in attendance.service.ts's
// attendancePunchIn (isAttendancePhotoRequired) — this middleware only
// validates a photo IF one was sent.
// ============================================================
const upload = getUploadMiddleware("attendance-photo", 5, 1, {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
}).single("photo");

export const handleAttendancePhoto = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        badRequest(res, "Only JPG, PNG or WEBP images are allowed for attendance photos.");
      } else if (err.code === "LIMIT_FILE_SIZE") {
        badRequest(res, "Photo is too large — please retake or choose a file under 5MB.");
      } else {
        badRequest(res, "Photo upload failed. Please retry.");
      }
      return;
    }
    next();
  });
};
