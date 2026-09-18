import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { badRequest } from "../../app/middlewear/errorMessage";

// ============================================================
// Bulk asset CSV upload. Memory storage on purpose — the file is parsed and
// discarded, never written to disk or to the (public-read) Spaces bucket the
// shared getUploadMiddleware uses. Wrapped so multer errors come back as a
// clear 400 JSON message (same reason as attendancePhotoUpload.ts: server.ts's
// error middleware is registered before the routers).
// ============================================================

export const BULK_CSV_MAX_MB = 2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_CSV_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Browsers/Excel send .csv as text/csv, application/vnd.ms-excel or
    // application/octet-stream depending on OS — the extension is the
    // reliable signal.
    if ((file.originalname || "").toLowerCase().endsWith(".csv")) cb(null, true);
    else cb(new Error("UNSUPPORTED_FILE_TYPE"));
  },
}).single("file");

export const handleAssetCsvUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: any) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        badRequest(res, "Only .csv files are allowed. Download the template to get the right format.");
      } else if (err.code === "LIMIT_FILE_SIZE") {
        badRequest(res, `The file is too large — the maximum is ${BULK_CSV_MAX_MB} MB.`);
      } else if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        badRequest(res, "Upload a single CSV file in the \"file\" field.");
      } else {
        badRequest(res, "File upload failed. Please try again.");
      }
      return;
    }
    next();
  });
};
