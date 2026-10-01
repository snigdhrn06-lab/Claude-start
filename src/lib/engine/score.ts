import type { Dimension, SignalId } from "../types";
import { SIGNALS } from "./catalog";
import type { DetectedSignal } from "./detect";

export interface ScoreResult {
  riskScore: number;
  dims: Record<Dimension, number>;
  breakdown: { label: string; value: number }[];
}

/** Calibration constants (tuned with scripts/calibrate.ts). */
export const TUNING = {
  dimWeight: { context: 0.63, pressure: 0.62, transaction: 0.2, recipient: 0 } as Record<Dimension, number>,
  synergy: 0.6,
  pretextAsk: 0.88,
  noAskDamping: 0.9,
  verifyContext: 0.4,
  verifyPressure: 0.25,
};

const has = (m: Map<SignalId, DetectedSignal>, ...ids: SignalId[]) => ids.some((id) => m.has(id));
const conf = (m: Map<SignalId, DetectedSignal>, id: SignalId) => m.get(id)?.confidence ?? 0;

/**
 * Transparent scoring. Each dimension is a noisy-OR of its signals
 * (P = 1 − Π(1 − weight·confidence)), plus named interaction terms.
 * The overall score is a weighted noisy-OR of the dimensions, damped when
 * there is no "ask" (no money or credentials requested) and reduced when an
 * independent verification path is present.
 */
export function scoreSignals(signals: DetectedSignal[]): ScoreResult {
  const m = new Map(signals.map((s) => [s.id, s]));
  const terms: Record<Dimension, number[]> = { context: [], pressure: [], transaction: [], recipient: [] };
  const breakdown: { label: string; value: number }[] = [];

  for (const s of signals) {
    const spec = SIGNALS[s.id];
    if (spec.mitigating) continue;
    terms[spec.dimension].push(spec.weight * s.confidence);
  }

  // Interaction: a claimed institution (or investment/refund pretext) asking for money.
  const pretext = Math.max(conf(m, "authority"), conf(m, "refund"), conf(m, "guarantee"));
  const ask = Math.max(conf(m, "payment_request"), conf(m, "reversal"), conf(m, "credentials"));
  if (pretext > 0 && ask > 0) {
    const v = TUNING.pretextAsk * Math.min(pretext, ask);
    terms.context.push(v);
    breakdown.push({ label: "Pretext + money request", value: Math.round(v * 100) });
  }
  // Interaction: payment demanded under a deadline or threat.
  const pressure = Math.max(conf(m, "urgency"), conf(m, "threat"), conf(m, "scarcity"));
  let synergy = 0;
  if (has(m, "payment_request", "reversal") && pressure > 0) {
    synergy = TUNING.synergy * Math.min(pressure, Math.max(conf(m, "payment_request"), conf(m, "reversal")));
    breakdown.push({ label: "Payment demanded under pressure", value: Math.round(synergy * 100) });
  }

  const dims = {} as Record<Dimension, number>;
  for (const d of Object.keys(terms) as Dimension[]) {
    dims[d] = 1 - terms[d].reduce((acc, t) => acc * (1 - t), 1);
  }

  // Mitigation: an independent verification path weakens contextual risk.
  const verify = conf(m, "verification");
  if (verify > 0) {
    dims.context *= 1 - TUNING.verifyContext * verify;
    dims.pressure *= 1 - TUNING.verifyPressure * verify;
    breakdown.push({ label: "Verification path (mitigating)", value: -Math.round(verify * TUNING.verifyContext * 100) });
  }

  let overall =
    1 - (Object.keys(dims) as Dimension[]).reduce((acc, d) => acc * (1 - TUNING.dimWeight[d] * dims[d]), 1 - synergy);

  // No ask → manipulation has no payload yet.
  if (!has(m, "payment_request", "reversal", "credentials")) {
    overall *= TUNING.noAskDamping;
    breakdown.push({ label: "No payment or credential request", value: -Math.round((1 - TUNING.noAskDamping) * 100) });
  }

  const pct = (x: number) => Math.max(0, Math.min(100, Math.round(x * 100)));
  const result = {
    riskScore: Math.min(99, pct(overall)),
    dims: {
      transaction: pct(dims.transaction),
      recipient: pct(dims.recipient),
      context: pct(dims.context),
      pressure: pct(dims.pressure),
    },
    breakdown,
  };
  breakdown.unshift(
    { label: "Context risk", value: result.dims.context },
    { label: "Pressure risk", value: result.dims.pressure },
    { label: "Transaction risk", value: result.dims.transaction },
    { label: "Recipient risk", value: result.dims.recipient },
  );
  return result;
}
