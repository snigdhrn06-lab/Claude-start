import { NextResponse } from "next/server";
import { createLimiter, clientKey } from "@/lib/api/rateLimit";
import { LIMITS, parseAnalyzeBody, readJsonLimited } from "@/lib/api/validate";
import { analyzeLocal } from "@/lib/engine/analyze";
import { toDecisionRecord } from "@/lib/engine/record";

export const runtime = "nodejs";

const limiter = createLimiter({ capacity: 60, refillPerMinute: 60 });

/**
 * Integration-ready decision endpoint (prototype).
 *
 * Deterministic local engine only — no external provider call — so a payment
 * partner gets a reproducible, versioned decision record for a given input.
 * Nothing is stored. There is no authentication in this prototype: a real
 * deployment must add partner authentication, mTLS or signed requests, and a
 * data-processing agreement. See docs/INTEGRATION.md.
 */
export async function POST(req: Request) {
  const rl = limiter.take(clientKey(req));
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const body = await readJsonLimited(req, LIMITS.analyzeBodyBytes);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = parseAnalyzeBody({ input: body.body, mode: "local" });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  return NextResponse.json(toDecisionRecord(analyzeLocal(parsed.input)));
}
