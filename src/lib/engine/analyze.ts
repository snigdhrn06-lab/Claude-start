import type { AnalysisResult, ExtractedEntity, RiskSignal, ScanInput } from "../types";
import { SIGNALS } from "./catalog";
import { detectLocal, type DetectedSignal } from "./detect";
import {
  amountAtStake,
  buildAttackChain,
  buildExplanation,
  buildPredictedPath,
  buildRecommendations,
  classify,
  headlineFor,
} from "./narrative";
import { scoreSignals } from "./score";

let counter = 0;
export function newId(prefix = "scan") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  };
}

export interface BuildOptions {
  engine: AnalysisResult["engine"];
  model?: string;
  explanation?: string;
  id?: string;
  createdAt?: string;
}

/** Deterministic assembly: scores, chain, path and recommendations from perceived signals. */
export function buildResult(input: ScanInput, signals: DetectedSignal[], entities: ExtractedEntity[], opts: BuildOptions): AnalysisResult {
  const score = scoreSignals(signals);
  const classification = classify(signals, score.riskScore);
  const amount = amountAtStake(input.conversation, input.payment);
  const ordered = [...signals].sort((a, b) => {
    if (!!SIGNALS[a.id].mitigating !== !!SIGNALS[b.id].mitigating) return SIGNALS[a.id].mitigating ? 1 : -1;
    return b.confidence * SIGNALS[b.id].weight - a.confidence * SIGNALS[a.id].weight;
  });
  return {
    id: opts.id ?? newId(),
    createdAt: opts.createdAt ?? new Date().toISOString(),
    title: input.title ?? (classification === "Low Risk" ? "Routine payment" : classification),
    input,
    riskScore: score.riskScore,
    classification,
    headline: headlineFor(score.riskScore),
    signals: ordered.map(toRiskSignal),
    extractedEntities: entities,
    attackChain: buildAttackChain(classification, input.conversation, signals, entities, score.riskScore, input.payment),
    hypotheticalNextSteps: buildPredictedPath(classification, amount, signals),
    recommendedActions: buildRecommendations(signals, classification, score.riskScore),
    transactionRisk: score.dims.transaction,
    recipientRisk: score.dims.recipient,
    contextRisk: score.dims.context,
    pressureRisk: score.dims.pressure,
    explanation: opts.explanation || buildExplanation(classification, signals, entities, input.conversation, input.payment),
    engine: opts.engine,
    model: opts.model,
    scoreBreakdown: score.breakdown,
  };
}

/** Fully local analysis — no network, no API key. */
export function analyzeLocal(input: ScanInput, opts: Partial<BuildOptions> = {}): AnalysisResult {
  const d = detectLocal(input.conversation, input.payment);
  return buildResult(input, d.signals, d.entities, { engine: "local", ...opts });
}
