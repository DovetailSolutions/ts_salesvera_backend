import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Create S3 client once (with credentials)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const getUploadMiddleware = (
  type: string,
  maxSizeMB: number = 1000,
  maxFiles: number = 100
): multer.Multer => {
  return multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_S3_BUCKET as string,
      contentType: (multerS3 as any).AUTO_CONTENT_TYPE,
      key: (_req, file, cb) => {
        const ext = file.originalname.split(".").pop();
        cb(
          null,
          `salesvera/${type}/${uuidv4()}.${ext}`  // < === added "newProject/"
        );
      },
    }),
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
      files: maxFiles,
    },
  });
};


export default getUploadMiddleware;
