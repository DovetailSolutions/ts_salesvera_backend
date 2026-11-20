import { Request, Response, NextFunction } from "express";
import getUploadMiddleware from "../../config/fileUploads";
import { badRequest } from "../../app/middlewear/errorMessage";

// Optional attachment on a separation request (e.g. a signed resignation
// letter). Same pattern and limits as the regularization attachment
// (attendanceRegularizationUpload.ts): one file in the "attachment" field,
// JPG/PNG/WEBP image or PDF, max 5 MB. A JSON request (no file) passes
// straight through, so existing callers are unaffected.
const upload = getUploadMiddleware("separation", 5, 1, {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
}).single("attachment");

export const handleSeparationAttachment = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        badRequest(res, "Only JPG, PNG, WEBP images or PDF files are allowed as attachments.");
      } else if (err.code === "LIMIT_FILE_SIZE") {
        badRequest(res, "Attachment is too large — please choose a file under 5MB.");
      } else if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        badRequest(res, "Only one attachment can be uploaded, in the \"attachment\" field.");
      } else {
        badRequest(res, "Attachment upload failed. Please retry.");
      }
      return;
    }
    next();
  });
};

/** The uploaded file's stored URL, original name and type, or null when none was sent. */
export const attachmentFromRequest = (req: Request) => {
  const f: any = (req as any).file;
  if (!f) return null;
  const url = f.location || f.path || null;
  if (!url) return null;
  return {
    url: String(url),
    name: String(f.originalname || "attachment").slice(0, 255),
    type: String(f.mimetype || "").slice(0, 100) || null,
  };
};
