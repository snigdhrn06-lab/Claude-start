/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO…).
 * Configure with S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and, for non-AWS
 * providers, S3_ENDPOINT. Objects stay private; they are served through /media/<key>
 * unless S3_PUBLIC_URL points at a public bucket/CDN domain.
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageDriver } from "./types";

function client() {
  const { S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!process.env.S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region: S3_REGION || "auto",
    endpoint: S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
}

let cached: S3Client | null = null;
const s3 = () => (cached ??= client());
const bucket = () => process.env.S3_BUCKET!;

export const s3Driver: StorageDriver = {
  name: "s3",
  async put(key, data, mime) {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }));
  },
  async get(key) {
    try {
      const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return { data: Buffer.from(bytes), mime: res.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  },
  async delete(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
