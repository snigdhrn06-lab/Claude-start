/** Social sharing image (LinkedIn, WhatsApp, X…), generated from the current site settings. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getDb, schema } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";
import { getSettingsSafe } from "@/lib/site";
import { stripEmphasis } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Portfolio preview";

const ACCENTS: Record<string, string> = { lime: "#C8F560", ice: "#8FD8FF", amber: "#FFBA52", coral: "#FF8066" };

/** If a custom social image is set in Admin → Site settings → SEO, serve it (cropped to 1200×630). */
async function customImage(id: string) {
  try {
    const [m] = await getDb().select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    if (!m || m.kind !== "image") return null;
    const file = await getStorage().get(m.key);
    if (!file) return null;
    const png = await sharp(file.data).resize(1200, 630, { fit: "cover", position: "attention" }).png().toBuffer();
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const s = await getSettingsSafe();
  if (s.ogImageId) {
    const custom = await customImage(s.ogImageId);
    if (custom) return custom;
  }
  const accent = ACCENTS[s.accent] ?? ACCENTS.lime!;
  const [serif, serifItalic] = await Promise.all([
    readFile(path.join(process.cwd(), "src/app/fonts/InstrumentSerif-Regular.woff")),
    readFile(path.join(process.cwd(), "src/app/fonts/InstrumentSerif-Italic.woff")),
  ]);
  const headline = stripEmphasis(s.headline || "").replace(/\n/g, " ");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#08090a", color: "#ECEAE4", padding: 64, fontFamily: "Serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#A09F9A", fontFamily: "sans-serif" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: accent }} />
            {s.location || "Portfolio"}
          </span>
          <span>{s.shortName}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, color: accent, fontStyle: "italic", fontFamily: "SerifItalic", maxWidth: 1000 }}>{headline}</div>
          <div style={{ fontSize: 150, lineHeight: 0.95, marginTop: 24, letterSpacing: -4 }}>{s.name}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#A09F9A", fontFamily: "sans-serif" }}>{s.roleLine}</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Serif", data: serif, style: "normal", weight: 400 }, { name: "SerifItalic", data: serifItalic, style: "italic", weight: 400 }] },
  );
}
