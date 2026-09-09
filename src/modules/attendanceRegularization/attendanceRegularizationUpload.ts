import { Request, Response, NextFunction } from "express";
import getUploadMiddleware from "../../config/fileUploads";
import { badRequest } from "../../app/middlewear/errorMessage";

// Optional supporting-evidence attachment for a regularization request
// (e.g. a client-visit photo, a screenshot of a network error). Same
// wrap-multer-in-its-own-error-handler pattern as
// attendance/attendancePhotoUpload.ts, for the same reason: server.ts's
// error handler is registered before the routers and never sees errors
// thrown inside a route handler.
const upload = getUploadMiddleware("attendance-regularization", 5, 1, {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
}).single("attachment");

export const handleRegularizationAttachment = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        badRequest(res, "Only JPG, PNG, WEBP images or PDF files are allowed as attachments.");
      } else if (err.code === "LIMIT_FILE_SIZE") {
        badRequest(res, "Attachment is too large — please choose a file under 5MB.");
      } else {
        badRequest(res, "Attachment upload failed. Please retry.");
      }
      return;
    }
    next();
  });
};
