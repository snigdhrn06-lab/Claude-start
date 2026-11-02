/**
 * Upload processing: validation, image optimisation (responsive WebP variants), storage and deletion.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { ApiError } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import type { MediaVariant } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff"]);
const VARIANT_WIDTHS = [480, 960, 1600, 2400];

export type UploadInput = { data: Buffer; filename: string; alt?: string };

function sniffKind(data: Buffer): "pdf" | "image" | "unknown" {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const h = data.subarray(0, 12);
  if (h[0] === 0xff && h[1] === 0xd8) return "image"; // JPEG
  if (h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image"; // PNG
  if (h.subarray(0, 4).toString("latin1") === "RIFF" && h.subarray(8, 12).toString("latin1") === "WEBP") return "image";
  if (h.subarray(4, 8).toString("latin1") === "ftyp") return "image"; // AVIF / HEIC
  if (h.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || h.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return "image";
  return "unknown";
}

function cleanFilename(name: string) {
  return (name || "upload").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
}

/** Validates, optimises and stores an upload. Returns the new media row. */
export async function storeUpload({ data, filename, alt = "" }: UploadInput) {
  const kind = sniffKind(data);
  const storage = getStorage();
  const id = randomUUID();
  const name = cleanFilename(filename);

  if (kind === "pdf") {
    if (data.length > DOCUMENT_MAX_BYTES) throw new ApiError(413, `PDFs must be under ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB`);
    const key = `doc/${id}/${name.toLowerCase().endsWith(".pdf") ? name : name + ".pdf"}`.replace(/\s+/g, "-");
    await storage.put(key, data, "application/pdf");
    const [row] = await getDb()
      .insert(schema.media)
      .values({ id, kind: "document", filename: name, mime: "application/pdf", key, size: data.length, alt: alt.slice(0, 300) })
      .returning();
    return row!;
  }

  if (kind !== "image") throw new ApiError(415, "Unsupported file. Upload a JPEG, PNG, WebP or AVIF image, or a PDF.");
  if (data.length > IMAGE_MAX_BYTES) throw new ApiError(413, `Images must be under ${IMAGE_MAX_BYTES / 1024 / 1024} MB`);

  let meta: sharp.Metadata;
  try {
    meta = await sharp(data, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new ApiError(415, "That file could not be read as an image.");
  }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) throw new ApiError(415, "Unsupported image format.");

  // Apply EXIF orientation once; metadata (GPS etc.) is stripped by default.
  const base = sharp(data, { limitInputPixels: 80_000_000 }).rotate();
  const { info: orientedInfo } = await base.clone().toBuffer({ resolveWithObject: true });
  const fullWidth = orientedInfo.width;
  const widths = VARIANT_WIDTHS.filter((w) => w < fullWidth);
  widths.push(Math.min(fullWidth, 2400));

  const variants: MediaVariant[] = [];
  const written: string[] = [];
  try {
    for (const width of [...new Set(widths)].sort((a, b) => a - b)) {
      const { data: out, info } = await base
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 90, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      const key = `img/${id}/w${info.width}.webp`;
      await storage.put(key, out, "image/webp");
      written.push(key);
      variants.push({ width: info.width, height: info.height, key, size: out.length });
    }
  } catch (err) {
    await Promise.allSettled(written.map((k) => storage.delete(k)));
    throw err;
  }
  const largest = variants[variants.length - 1]!;
  const [row] = await getDb()
    .insert(schema.media)
    .values({ id, kind: "image", filename: name, mime: "image/webp", key: largest.key, size: largest.size, width: largest.width, height: largest.height, variants, alt: alt.slice(0, 300) })
    .returning();
  return row!;
}

/** Deletes a media row and its stored files. References are cleared by ON DELETE SET NULL / CASCADE. */
export async function deleteMedia(id: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!row) return null;
  const keys = new Set<string>([row.key, ...(row.variants ?? []).map((v) => v.key)]);
  await db.delete(schema.media).where(eq(schema.media.id, id));
  const storage = getStorage();
  await Promise.allSettled([...keys].map((k) => storage.delete(k)));
  return row;
}
