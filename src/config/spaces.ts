import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

// Shared DigitalOcean Spaces client — Spaces is S3-API-compatible, so the AWS SDK
// works unmodified against it once pointed at the Spaces endpoint/credentials.
export const SPACES_BUCKET = process.env.DO_SPACES_BUCKET as string;

export const spacesClient = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
});

export interface SpacesFile extends Express.Multer.File {
  bucket: string;
  key: string;
  location?: string;
  etag?: string;
}

export const buildSpacesUrl = (key: string, bucket: string = SPACES_BUCKET): string => {
  const host = (process.env.DO_SPACES_ENDPOINT as string).replace(/^https?:\/\//, "");
  return `https://${bucket}.${host}/${key}`;
};

export const uploadBufferToSpaces = async (
  key: string,
  buffer: Buffer,
  contentType: string,
  bucket: string = SPACES_BUCKET
): Promise<string> => {
  await spacesClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return buildSpacesUrl(key, bucket);
};

export const getObjectFromSpaces = async (
  key: string,
  bucket: string = SPACES_BUCKET
): Promise<GetObjectCommandOutput> => {
  return spacesClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
};

export const deleteFromSpaces = async (
  key: string,
  bucket: string = SPACES_BUCKET
): Promise<void> => {
  await spacesClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
