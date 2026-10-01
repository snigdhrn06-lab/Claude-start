import { NextResponse } from "next/server";
import { aiConfig } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export function GET() {
  const cfg = aiConfig();
  return NextResponse.json({ ai: cfg.enabled, model: cfg.enabled ? cfg.model : null });
}
