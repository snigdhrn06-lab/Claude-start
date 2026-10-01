import { NextResponse } from "next/server";
import { ocrWithAI } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.image?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected an image data URL." }, { status: 400 });
  }
  if (body.image.length > 7_000_000) {
    return NextResponse.json({ error: "Image is too large (5 MB max)." }, { status: 413 });
  }
  try {
    const text = await ocrWithAI(body.image);
    if (!text) {
      return NextResponse.json(
        // 200 with ok:false — an expected state in offline mode, not a server fault.
        { ok: false, error: "Offline mode can't read photos. Paste the conversation text, or try a sample screenshot.", code: "OCR_UNAVAILABLE" },
      );
    }
    return NextResponse.json({ ok: true, text, engine: "llm" });
  } catch (err) {
    console.warn("[sentinel] OCR failed:", (err as Error).message);
    return NextResponse.json({ error: "Text extraction failed. Paste the conversation text instead.", code: "OCR_FAILED" }, { status: 502 });
  }
}
