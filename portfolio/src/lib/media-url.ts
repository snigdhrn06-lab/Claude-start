/** Media URL helpers (safe for client and server). */
import type { MediaVariant } from "@/lib/db/schema";

export type PublicMedia = {
  id: string;
  kind: "image" | "document";
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  filename: string;
  mime: string;
  size: number;
  srcSet: string;
  variants: { width: number; url: string }[];
};

/** S3_PUBLIC_URL is read at build/run time on the server and passed down already resolved. */
export function mediaUrl(key: string, publicBase?: string | null) {
  const base = publicBase?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : `/media/${key}`;
}

export function toPublicMedia(
  row: { id: string; kind: string; key: string; width: number | null; height: number | null; alt: string; filename: string; mime: string; size: number; variants: MediaVariant[] },
  publicBase?: string | null,
): PublicMedia {
  const variants = [...(row.variants ?? [])].sort((a, b) => a.width - b.width).map((v) => ({ width: v.width, url: mediaUrl(v.key, publicBase) }));
  return {
    id: row.id,
    kind: row.kind === "document" ? "document" : "image",
    url: mediaUrl(row.key, publicBase),
    width: row.width,
    height: row.height,
    alt: row.alt,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    variants,
    srcSet: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
  };
}
