import { Request, Response, NextFunction } from "express";
import getUploadMiddleware from "../../config/fileUploads";
import { badRequest } from "../../app/middlewear/errorMessage";
import { User } from "../../config/dbConnection";

// ============================================================
// Meeting-in / meeting-out photo (migration 0055).
//
// The photo is OPTIONAL by default. An admin or manager can make it
// REQUIRED per employee from Attendance Security
// (users.isMeetingInPhotoRequired / isMeetingOutPhotoRequired).
//
// Multipart field names:
//   meetingInPhoto   POST /api/createmeeting (status "in"),
//                    POST /api/scheduledupdate, POST /api/meeting/start
//   meetingOutPhoto  POST /api/endmeeting, POST /api/meeting/end
// JPG / PNG / WEBP, max 5 MB. Requests without a file (plain JSON) work
// exactly as before.
// ============================================================

export const MEETING_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const photoError = (res: Response, err: any) => {
  if (err.message === "UNSUPPORTED_FILE_TYPE") {
    badRequest(res, "Only JPG, PNG or WEBP images are allowed for meeting photos.");
  } else if (err.code === "LIMIT_FILE_SIZE") {
    badRequest(res, "Photo is too large — please retake or choose a file under 5MB.");
  } else if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
    badRequest(res, "Only one meeting photo can be uploaded.");
  } else {
    badRequest(res, "Photo upload failed. Please retry.");
  }
};

const single = (field: "meetingInPhoto" | "meetingOutPhoto") => {
  const upload = getUploadMiddleware("meeting-photo", 5, 1, { allowedMimeTypes: MEETING_PHOTO_TYPES }).single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    upload(req, res, (err: any) => (err ? photoError(res, err) : next()));
  };
};

/** Meeting start (scheduled → in). */
export const handleMeetingInPhoto = single("meetingInPhoto");
/** Meeting end (in → out). */
export const handleMeetingOutPhoto = single("meetingOutPhoto");

// Create meeting: keeps the existing "image" attachments (any type, many)
// and adds the optional single "meetingInPhoto".
const createUpload = getUploadMiddleware("image").fields([
  { name: "image", maxCount: 100 },
  { name: "meetingInPhoto", maxCount: 1 },
]);
export const handleCreateMeetingFiles = (req: Request, res: Response, next: NextFunction): void => {
  createUpload(req, res, (err: any) => (err ? photoError(res, err) : next()));
};

/** Files of one field, whether multer stored req.files as an array or a map. */
export const filesOf = (req: Request, field: string): any[] => {
  const files: any = (req as any).files;
  if (!files) return [];
  if (Array.isArray(files)) return files.filter((f) => f.fieldname === field);
  return files[field] || [];
};

/** The uploaded photo's URL (S3/Spaces location), or null. */
export const photoUrlOf = (file: any): string | null => (file ? file.location || file.path || null : null);

export const getMeetingPhotoFlags = async (userId: number) => {
  const u: any = await (User as any).findByPk(userId, {
    attributes: ["id", "isMeetingInPhotoRequired", "isMeetingOutPhotoRequired"],
  });
  return {
    inRequired: !!u?.isMeetingInPhotoRequired,
    outRequired: !!u?.isMeetingOutPhotoRequired,
  };
};

export const PHOTO_REQUIRED_META = (stage: "in" | "out") => ({
  code: stage === "in" ? "MEETING_IN_PHOTO_REQUIRED" : "MEETING_OUT_PHOTO_REQUIRED",
});
