/** Media library: GET list (with usage), POST multipart upload (one or more files). */
import { desc } from "drizzle-orm";
import { ApiError, handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { logActivity } from "@/lib/content/repo";
import { getDb, schema } from "@/lib/db/client";
import { storeUpload } from "@/lib/media";
import { toPublicMedia } from "@/lib/media-url";
import { mediaUsage } from "@/lib/media-usage";

export const runtime = "nodejs";
const publicBase = () => (process.env.STORAGE_DRIVER === "s3" ? process.env.S3_PUBLIC_URL || null : null);

export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  const [rows, usage] = await Promise.all([getDb().select().from(schema.media).orderBy(desc(schema.media.createdAt)), mediaUsage()]);
  return json({
    items: rows.map((r) => ({ ...toPublicMedia(r, publicBase()), createdAt: r.createdAt, usage: usage.get(r.id) ?? [] })),
  });
});

export const POST = handle(async (request: Request) => {
  await requireAdmin(request);
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("multipart/form-data")) throw new ApiError(400, "Upload files as multipart/form-data");
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 60 * 1024 * 1024) throw new ApiError(413, "Upload is too large");
  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f);
  if (!files.length) throw new ApiError(400, "No file received");
  if (files.length > 10) throw new ApiError(400, "Upload at most 10 files at a time");
  const alt = String(form.get("alt") ?? "");
  const created = [];
  for (const file of files) {
    const row = await storeUpload({ data: Buffer.from(await file.arrayBuffer()), filename: file.name, alt });
    created.push({ ...toPublicMedia(row, publicBase()), createdAt: row.createdAt, usage: [] });
    await logActivity("media", "uploaded", row.filename, row.id);
  }
  // Uploads don't change public pages until they're referenced, so no revalidation is needed here.
  return json({ items: created }, { status: 201 });
});
