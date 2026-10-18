import type { AnalysisResult, ExtractedEntity, RejectedEvidence, RiskSignal, ScanInput } from "../types";
import { CATALOG_VERSION, SIGNALS } from "./catalog";
import { summariseContext } from "./context";
import { buildRecommendations, decide } from "./decision";
import { detectLocal, type DetectedSignal, type LocalDetection } from "./detect";
import { validateSignals } from "./grounding";
import { buildAttackChain, buildExplanation, buildPredictedPath, classify, headlineFor } from "./narrative";
import { isAnalysable, summariseParse } from "./parse";
import { POLICY_VERSION, scoreSignals } from "./score";

/** Bump when the pipeline (not just catalogue or policy) changes behaviour. */
export const ENGINE_VERSION = "2.0.0";

let counter = 0;
export function newId(prefix = "scan") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** FNV-1a over the normalised input — stable across runtimes, used as an analysis fingerprint. */
export function inputHash(input: ScanInput) {
  const norm = JSON.stringify({
    c: input.conversation.replace(/\r\n/g, "\n"),
    p: input.payment ? [input.payment.recipient.trim(), input.payment.amount, input.payment.method, input.payment.reason] : null,
    x: input.accountContext ?? { mode: "none" },
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function basisOf(d: DetectedSignal): RiskSignal["basis"] {
  if (d.evidence.some((e) => e.kind !== "context" && e.attribution === "attributed")) return "observed";
  if (d.evidence.every((e) => e.kind === "context")) return "context";
  return "uncertain";
}

function toRiskSignal(d: DetectedSignal): RiskSignal {
  const spec = SIGNALS[d.id];
  return {
    id: d.id,
    label: spec.label,
    category: spec.category,
    dimension: spec.dimension,
    severity: spec.severity,
    confidence: Math.round(d.confidence * 100),
    explanation: d.explanation || spec.explanation,
    evidence: d.evidence,
    mitigating: spec.mitigating,
    basis: basisOf(d),
  };
}

export interface BuildOptions {
  engine: AnalysisResult["engine"];
  model?: string;
  explanation?: string;
  id?: string;
  createdAt?: string;
  /** Extra rejected evidence from an upstream perception step (e.g. unlocatable LLM quotes). */
  rejected?: RejectedEvidence[];
}

/**
 * Deterministic assembly: validated signals → score → decision → narrative.
 * Given identical perception output, every field except id/createdAt is identical.
 */
export function buildResult(input: ScanInput, detection: LocalDetection, opts: BuildOptions): AnalysisResult {
  const conversation = input.conversation ?? "";
  const { messages, context, recipient, amount } = detection;
  const validated = validateSignals(conversation, messages, detection.signals);
  const signals = validated.signals;
  const parse = summariseParse(conversation, messages);
  const ctxSummary = summariseContext(context, recipient);
  const hasPaymentDetails = !!(input.payment && input.payment.amount > 0);

  const score = scoreSignals(signals, { paymentIntent: hasPaymentDetails });
  const decision = decide({ band: score.band, score: score.riskScore, signals, context: ctxSummary, parse, recipient, amount, hasPaymentDetails });
  const classification = classify(signals, score.band, decision.insufficientEvidence);
  const sender = messages.find((m) => isAnalysable(m) && m.role === "counterparty")?.sender;

  const ordered = [...signals].sort((a, b) => {
    if (!!SIGNALS[a.id].mitigating !== !!SIGNALS[b.id].mitigating) return SIGNALS[a.id].mitigating ? 1 : -1;
    return b.confidence * SIGNALS[b.id].weight - a.confidence * SIGNALS[a.id].weight || a.id.localeCompare(b.id);
  });

  return {
    id: opts.id ?? newId(),
    createdAt: opts.createdAt ?? new Date().toISOString(),
    title: input.title ?? (classification === "Low Risk" ? "Routine payment" : classification),
    input,
    riskScore: score.riskScore,
    band: score.band,
    classification,
    headline: headlineFor(score.band, decision.insufficientEvidence),
    signals: ordered.map(toRiskSignal),
    extractedEntities: detection.entities,
    attackChain: buildAttackChain(messages, signals, score.band, recipient, amount, input.payment?.method),
    hypotheticalNextSteps: buildPredictedPath(classification, score.band, amount, signals),
    recommendedActions: buildRecommendations(signals, decision, recipient),
    transactionRisk: score.dims.transaction,
    recipientRisk: score.dims.recipient,
    contextRisk: score.dims.context,
    pressureRisk: score.dims.pressure,
    explanation: opts.explanation || buildExplanation(classification, signals, sender, recipient, amount, decision.insufficientEvidence),
    engine: opts.engine,
    model: opts.model,
    scoreBreakdown: score.breakdown,
    scoreTrace: score.trace,
    decision,
    context: ctxSummary,
    parse,
    rejectedEvidence: [...(opts.rejected ?? []), ...detection.rejected, ...validated.rejected],
    provenance: {
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      catalogVersion: CATALOG_VERSION,
      perception: opts.engine,
      model: opts.model,
      inputHash: inputHash(input),
    },
  };
}

/** Fully local analysis — no network, no API key. */
export function analyzeLocal(input: ScanInput, opts: Partial<BuildOptions> = {}): AnalysisResult {
  const d = detectLocal(input.conversation ?? "", input.payment, input.accountContext);
  return buildResult(input, d, { engine: "local", ...opts });
}

export type { ExtractedEntity };
