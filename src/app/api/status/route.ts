import { NextResponse } from "next/server";
import { aiConfig } from "@/lib/ai/provider";
import { ENGINE_VERSION } from "@/lib/engine/analyze";
import { CATALOG_VERSION } from "@/lib/engine/catalog";
import { POLICY_VERSION } from "@/lib/engine/score";

export const dynamic = "force-dynamic";

/** Public status: whether AI perception is on, and engine versions. Never exposes keys or config values. */
export function GET() {
  const cfg = aiConfig();
  return NextResponse.json({
    ai: cfg.enabled,
    model: cfg.enabled ? cfg.model : null,
    engineVersion: ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
    catalogVersion: CATALOG_VERSION,
  });
}
