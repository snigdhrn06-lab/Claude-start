import type { AnalysisResult } from "../types";

/**
 * Compact, reproducible decision record: what a payment partner (or an audit
 * log) needs, without the raw conversation. Quotes are included only as short
 * excerpts with offsets so the record can be checked against the original
 * input by whoever holds it.
 */
export interface DecisionRecord {
  schema: "sentinel.decision/v1";
  provenance: AnalysisResult["provenance"];
  riskScore: number;
  band: AnalysisResult["band"];
  action: AnalysisResult["decision"]["action"];
  summary: string;
  insufficientEvidence: boolean;
  scoreMeaning: string;
  reasons: {
    signal: string;
    label: string;
    strength: number;
    basis: string;
    evidence: { excerpt: string; start: number; end: number; speakerRole?: string; attribution?: string; support?: string }[];
  }[];
  scoreTrace: AnalysisResult["scoreTrace"];
  context: { mode: string; recipientStatus: string };
  uncertainties: string[];
  recommendations: { id: string; title: string; because: string[] }[];
}

export const SCORE_MEANING =
  "A 0–100 risk score from a versioned scoring policy. It ranks how strongly the submitted material matches social-engineering patterns. It is not a calibrated probability of fraud.";

export function toDecisionRecord(r: AnalysisResult): DecisionRecord {
  return {
    schema: "sentinel.decision/v1",
    provenance: r.provenance,
    riskScore: r.riskScore,
    band: r.band,
    action: r.decision.action,
    summary: r.decision.summary,
    insufficientEvidence: r.decision.insufficientEvidence,
    scoreMeaning: SCORE_MEANING,
    reasons: r.signals.map((s) => ({
      signal: s.id,
      label: s.label,
      strength: s.confidence,
      basis: s.basis,
      evidence: s.evidence.map((e) => ({
        excerpt: e.text.length > 160 ? e.text.slice(0, 157) + "…" : e.text,
        start: e.start,
        end: e.end,
        speakerRole: e.speakerRole,
        attribution: e.attribution,
        support: e.support,
      })),
    })),
    scoreTrace: r.scoreTrace,
    context: { mode: r.context.mode, recipientStatus: r.context.recipientStatus },
    uncertainties: r.decision.uncertainties,
    recommendations: r.recommendedActions.map((a) => ({ id: a.id, title: a.title, because: a.because ?? [] })),
  };
}
