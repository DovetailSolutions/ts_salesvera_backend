import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { badRequest } from "../../app/middlewear/errorMessage";

// ============================================================
// Bulk inventory-item upload (CSV or Excel). Memory storage on purpose — the
// file is parsed and discarded, never stored. Wrapped so multer errors come
// back as a clear 400 JSON message (same pattern as asset.upload.ts).
// ============================================================

export const BULK_FILE_MAX_MB = 2;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_FILE_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // The extension is the reliable signal — browsers send .csv under
    // several MIME types depending on the OS.
    const name = (file.originalname || "").toLowerCase();
    if (ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) cb(null, true);
    else cb(new Error("UNSUPPORTED_FILE_TYPE"));
  },
}).single("file");

export const handleInventoryFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        badRequest(res, "Only .csv or .xlsx files are allowed. Download the template to get the right format.");
      } else if (err.code === "LIMIT_FILE_SIZE") {
        badRequest(res, `The file is too large — the maximum is ${BULK_FILE_MAX_MB} MB.`);
      } else if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        badRequest(res, "Upload a single file in the \"file\" field.");
      } else {
        badRequest(res, "File upload failed. Please try again.");
      }
      return;
    }
    next();
  });
};
