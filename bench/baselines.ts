/**
 * Assessors compared on the same cases with the same information
 * (conversation + payment fields + account context described in text).
 *
 * - sentinel-local : the deterministic engine (offline, reproducible)
 * - keyword        : naive offline baseline — flags any scary keyword anywhere,
 *                    including the user's own lines. Shows what structure adds
 *                    over keyword matching. Not a straw man for the LLM.
 * - generic-llm    : a general-purpose LLM with a neutral prompt (live; needs ANTHROPIC_API_KEY)
 * - sentinel-llm   : Sentinel with LLM perception (live; needs ANTHROPIC_API_KEY)
 *
 * Live assessors never fabricate output: without a key they report "skipped".
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { aiConfig, analyzeWithAI, getClient } from "../src/lib/ai/core";
import { analyzeLocal } from "../src/lib/engine/analyze";
import { DEMO_PROFILE } from "../src/lib/engine/context";
import type { ScanInput } from "../src/lib/types";
import type { BenchCase } from "./dataset";

export interface AssessorOutput {
  /** true = treat as scam / stop-or-verify; false = not flagged; null = no verdict. */
  flagged: boolean | null;
  score?: number;
  quotes: { text: string; speaker?: string }[];
  recommendations: string[];
  /** The assessor exposes a numeric breakdown that reproduces its score. */
  transparentScore: boolean;
  error?: string;
}

export interface Assessor {
  name: string;
  live: boolean;
  model?: string;
  available(): { ok: boolean; reason?: string };
  assess(c: BenchCase): Promise<AssessorOutput>;
}

export function toInput(c: BenchCase): ScanInput {
  return { conversation: c.conversation, payment: c.payment, source: "text", accountContext: c.context };
}

export const sentinelLocal: Assessor = {
  name: "sentinel-local",
  live: false,
  available: () => ({ ok: true }),
  async assess(c) {
    const r = analyzeLocal(toInput(c));
    return {
      flagged: r.band === "elevated" || r.band === "high",
      score: r.riskScore,
      quotes: r.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence.filter((e) => e.kind !== "context").map((e) => ({ text: e.text, speaker: e.speaker }))),
      recommendations: r.recommendedActions.map((a) => `${a.title}. ${a.detail}`),
      transparentScore: true,
    };
  },
};

const KEYWORDS = /\b(otp|pin|urgent|immediately|blocked|frozen|kyc|refund|guaranteed|lottery|prize|police|arrest|deposit|password|cvv|anydesk|penalty)\b/i;
export const keywordBaseline: Assessor = {
  name: "keyword",
  live: false,
  available: () => ({ ok: true }),
  async assess(c) {
    const lines = c.conversation.split("\n").filter((l) => KEYWORDS.test(l));
    return {
      flagged: lines.length > 0,
      quotes: lines.map((l) => ({ text: l.replace(/^[^:]{1,40}:\s*/, "") })),
      recommendations: lines.length ? ["Be careful, this may be a scam."] : [],
      transparentScore: false,
    };
  },
};

const GenericSchema = z.object({
  verdict: z.enum(["scam", "legitimate", "uncertain"]),
  risk: z.number().describe("0-100"),
  evidence: z.array(z.object({ quote: z.string(), speaker: z.string() })),
  recommendations: z.array(z.string()),
});

/** Neutral prompt: what a careful user might ask a general-purpose assistant. */
export const GENERIC_PROMPT = `You are a helpful assistant. A user shares a conversation that preceded a payment they are considering, plus optional payment details and notes about their account.
Assess whether this looks like a scam or a legitimate request. Quote the exact text that supports your assessment and say who wrote it. Recommend what the user should do.`;

function contextNote(c: BenchCase) {
  if (!c.context || c.context.mode === "none") return "No account history available.";
  const list = c.context.mode === "demo" ? DEMO_PROFILE.knownBeneficiaries : c.context.knownBeneficiaries ?? [];
  const typical = c.context.mode === "demo" ? DEMO_PROFILE.typicalOutgoing : c.context.typicalOutgoing;
  return `Saved recipients: ${list.join(", ") || "none"}. Typical payment: ${typical ? `₹${typical}` : "unknown"}.`;
}

export const genericLLM: Assessor = {
  name: "generic-llm",
  live: true,
  get model() {
    return aiConfig().model;
  },
  available: () => (aiConfig().enabled ? { ok: true } : { ok: false, reason: "ANTHROPIC_API_KEY not set (or SENTINEL_AI_MODE=local)" }),
  async assess(c) {
    try {
      const pay = c.payment ? `\nPayment: ${c.payment.amount} INR to ${c.payment.recipient} via ${c.payment.method}. Note: ${c.payment.reason}` : "";
      const res = await getClient().messages.parse({
        model: aiConfig().model,
        max_tokens: 4000,
        system: GENERIC_PROMPT,
        output_config: { format: zodOutputFormat(GenericSchema), effort: "low" },
        messages: [{ role: "user", content: `Conversation:\n${c.conversation || "(none)"}${pay}\nAccount notes: ${contextNote(c)}` }],
      });
      const p = res.parsed_output;
      if (!p) return { flagged: null, quotes: [], recommendations: [], transparentScore: false, error: "no structured output" };
      return {
        flagged: p.verdict === "scam" ? true : p.verdict === "legitimate" ? false : null,
        score: p.risk,
        quotes: p.evidence.map((e) => ({ text: e.quote, speaker: e.speaker })),
        recommendations: p.recommendations,
        transparentScore: false,
      };
    } catch (e) {
      return { flagged: null, quotes: [], recommendations: [], transparentScore: false, error: (e as Error).name };
    }
  },
};

export const sentinelLLM: Assessor = {
  name: "sentinel-llm",
  live: true,
  get model() {
    return aiConfig().model;
  },
  available: () => (aiConfig().enabled ? { ok: true } : { ok: false, reason: "ANTHROPIC_API_KEY not set (or SENTINEL_AI_MODE=local)" }),
  async assess(c) {
    const { result: r, notice } = await analyzeWithAI(toInput(c));
    return {
      flagged: r.band === "elevated" || r.band === "high",
      score: r.riskScore,
      quotes: r.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence.filter((e) => e.kind !== "context").map((e) => ({ text: e.text, speaker: e.speaker }))),
      recommendations: r.recommendedActions.map((a) => `${a.title}. ${a.detail}`),
      transparentScore: true,
      error: r.engine === "local" ? notice ?? "fell back to local engine" : undefined,
    };
  },
};

export const ASSESSORS: Record<string, Assessor> = {
  "sentinel-local": sentinelLocal,
  keyword: keywordBaseline,
  "generic-llm": genericLLM,
  "sentinel-llm": sentinelLLM,
};
