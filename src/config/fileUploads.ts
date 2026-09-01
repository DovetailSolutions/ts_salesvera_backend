import multer from "multer";
import multerS3 from "multer-s3";
import { v4 as uuidv4 } from "uuid";
import { spacesClient, SPACES_BUCKET } from "./spaces";

const getUploadMiddleware = (
  type: string,
  maxSizeMB: number = 1000,
  maxFiles: number = 100
): multer.Multer => {
  return multer({
    storage: multerS3({
      s3: spacesClient,
      bucket: SPACES_BUCKET,
      acl: "public-read",
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
