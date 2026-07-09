import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Check if S3 environment variables are fully configured
const hasS3 = !!(
  process.env.AWS_REGION &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET
);

// Create S3 client only if credentials are provided
const s3 = hasS3
  ? new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const getUploadMiddleware = (
  type: string,
  maxSizeMB: number = 1000,
  maxFiles: number = 100
): multer.Multer => {
  if (hasS3 && s3) {
    return multer({
      storage: multerS3({
        s3,
        bucket: process.env.AWS_S3_BUCKET as string,
        contentType: (multerS3 as any).AUTO_CONTENT_TYPE,
        key: (_req, file, cb) => {
          const ext = file.originalname.split(".").pop();
          cb(
            null,
            `salesvera/${type}/${uuidv4()}.${ext}`
          );
        },
      }),
      limits: {
        fileSize: maxSizeMB * 1024 * 1024,
        files: maxFiles,
      },
    });
  } else {
    // Local disk storage fallback
    const uploadDir = path.join(__dirname, `../../uploads/${type}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const ext = file.originalname.split(".").pop();
          cb(null, `${uuidv4()}.${ext}`);
        },
      }),
      limits: {
        fileSize: maxSizeMB * 1024 * 1024,
        files: maxFiles,
      },
    });
  }
};

export default getUploadMiddleware;

