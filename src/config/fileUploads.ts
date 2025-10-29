import multer from "multer";

const getUploadMiddleware = (
  type: string,
  maxSizeMB: number = 100, // Size in MB
  maxFiles: number = 15
): multer.Multer => {
  // Use memoryStorage instead of diskStorage
  const storage = multer.memoryStorage();

  return multer({
    storage,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024, // Convert MB to bytes
      files: maxFiles,
    },
  });
};

export default getUploadMiddleware;
