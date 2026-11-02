/**
 * Serves stored media (images and PDFs) from the configured storage driver.
 * Keys are unique per upload, so responses are cached as immutable.
 */
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!/^(img|doc)\/[0-9a-f-]{36}\/[\w.\- ]+$/i.test(key)) return new Response("Not found", { status: 404 });
  const file = await getStorage().get(key);
  if (!file) return new Response("Not found", { status: 404 });
  const isPdf = file.mime === "application/pdf";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.data.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      ...(isPdf ? { "content-disposition": `inline; filename="${key.split("/").pop()}"` } : {}),
    },
  });
}
