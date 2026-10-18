import { NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai/provider";
import { createLimiter, clientKey } from "@/lib/api/rateLimit";
import { LIMITS, parseAnalyzeBody, readJsonLimited } from "@/lib/api/validate";
import { analyzeLocal } from "@/lib/engine/analyze";

export const runtime = "nodejs";

// 30 analyses per minute per client; generous for people, limiting for scripts.
const limiter = createLimiter({ capacity: 30, refillPerMinute: 30 });

export async function POST(req: Request) {
  const rl = limiter.take(clientKey(req));
  if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const body = await readJsonLimited(req, LIMITS.analyzeBodyBytes);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = parseAnalyzeBody(body.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  try {
    if (parsed.mode === "local") return NextResponse.json({ result: analyzeLocal(parsed.input) });
    const { result, notice } = await analyzeWithAI(parsed.input);
    return NextResponse.json({ result, notice });
  } catch (err) {
    console.warn("[sentinel] analysis error:", (err as Error).name);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
