import { NextResponse } from "next/server";
import { ocrWithAI, validateImageDataUrl } from "@/lib/ai/provider";
import { createLimiter, clientKey } from "@/lib/api/rateLimit";
import { LIMITS, readJsonLimited } from "@/lib/api/validate";

export const runtime = "nodejs";

// OCR calls a paid vision model: keep it tight.
const limiter = createLimiter({ capacity: 6, refillPerMinute: 6 });

export async function POST(req: Request) {
  const rl = limiter.take(clientKey(req));
  if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const body = await readJsonLimited(req, LIMITS.ocrBodyBytes);
  if (!body.ok) return NextResponse.json({ error: body.status === 413 ? "Image is too large (5 MB max)." : body.error }, { status: body.status });
  const image = (body.body as { image?: unknown })?.image;
  if (typeof image !== "string") return NextResponse.json({ error: "Expected an image data URL." }, { status: 400 });
  const v = validateImageDataUrl(image);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.error.includes("too large") ? 413 : 400 });
  try {
    const text = await ocrWithAI(image);
    if (!text) {
      return NextResponse.json(
        // 200 with ok:false — an expected state in offline mode, not a server fault.
        { ok: false, error: "Offline mode can't read photos. Paste the conversation text, or try a sample screenshot.", code: "OCR_UNAVAILABLE" },
      );
    }
    return NextResponse.json({ ok: true, text, engine: "llm" });
  } catch (err) {
    console.warn("[sentinel] OCR failed:", (err as Error).name);
    return NextResponse.json({ error: "Text extraction failed. Paste the conversation text instead.", code: "OCR_FAILED" }, { status: 502 });
  }
}
