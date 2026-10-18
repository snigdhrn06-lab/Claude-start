import type { Dimension, RiskBand, ScoreTerm, ScoreTrace, SignalId } from "../types";
import { ASK_SIGNALS, SIGNALS } from "./catalog";
import type { DetectedSignal } from "./detect";

/**
 * Scoring policy. Versioned: any change to a constant here must bump
 * POLICY_VERSION so stored analyses can be reproduced. See docs/SCORING.md.
 */
export const POLICY_VERSION = "2.0.0";

export const POLICY = {
  /** Log-odds with no evidence at all (≈ 4/100). */
  baseline: -3.2,
  /** Maximum log-odds points each dimension can contribute (dimension value 0–1 × points). */
  dimPoints: { context: 2.6, pressure: 1.6, transaction: 2.2, recipient: 1.6 } as Record<Dimension, number>,
  /** Without a concrete ask (money or secrets), manipulation has no payload yet. */
  noAskScale: 0.75,
  interactions: {
    /** Claimed identity / pretext combined with a concrete ask. */
    pretextAsk: 1.3,
    /** Threat or isolation combined with a concrete ask (coercion). */
    coercionAsk: 0.9,
    /** Deadline pressure aimed at an unverified destination. */
    urgencyDestination: 0.6,
    /** Total interaction points are capped so combinations cannot run away. */
    cap: 2.0,
  },
  mitigation: {
    verification: 1.6,
    knownRecipient: 1.2,
    /** Mitigation halves when the same conversation also contains a concrete ask. */
    askPresentFactor: 0.5,
    /** Mitigations can remove at most this share of the positive points. */
    maxShare: 0.35,
  },
  /**
   * Floor rules: near-definitional fraud indicators set a minimum score, applied
   * last and shown explicitly. They require strong, pattern-supported evidence.
   */
  floors: [
    { signal: "credentials" as SignalId, minConfidence: 0.75, floor: 80, rule: "A request for an OTP, PIN, card details or remote access sets a minimum score of 80." },
    { signal: "reversal" as SignalId, minConfidence: 0.8, floor: 65, rule: "Being asked to pay (or approve a collect request) in order to receive money sets a minimum score of 65." },
  ],
  /**
   * Risk bands (provisional). Thresholds were chosen on the development split
   * of the synthetic benchmark (see docs/EVALUATION.md); they are not
   * calibrated probabilities and must be re-validated on real data.
   */
  bands: { caution: 25, elevated: 50, high: 75 },
};

const PRETEXT: SignalId[] = ["authority", "guarantee", "refund", "identity_change", "windfall"];
const COERCION: SignalId[] = ["threat", "isolation"];
const DESTINATION: SignalId[] = ["new_beneficiary", "unofficial_channel"];
const DIMENSIONS: Dimension[] = ["context", "pressure", "transaction", "recipient"];
const DIM_LABEL: Record<Dimension, string> = { context: "Context", pressure: "Pressure", transaction: "Transaction", recipient: "Recipient" };

export interface ScoreResult {
  riskScore: number;
  band: RiskBand;
  dims: Record<Dimension, number>;
  trace: ScoreTrace;
  /** Legacy flat breakdown for older views. */
  breakdown: { label: string; value: number }[];
}

export interface ScoreOptions {
  /** Payment details were supplied: there is a concrete payment intent even without a counterparty request. */
  paymentIntent?: boolean;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function bandFor(score: number): RiskBand {
  if (score >= POLICY.bands.high) return "high";
  if (score >= POLICY.bands.elevated) return "elevated";
  if (score >= POLICY.bands.caution) return "caution";
  return "low";
}

/**
 * Deterministic, transparent scoring.
 *
 * 1. Each dimension combines its signals as a noisy-OR of weight × evidence
 *    strength, so several excerpts of the same kind have diminishing returns
 *    (no double counting of e.g. three urgency phrases).
 * 2. Dimensions add in log-odds space, each capped at its policy points.
 * 3. Named interaction terms add bounded points for combinations that
 *    characterise social engineering (pretext + ask, coercion + ask, ...).
 * 4. Without a concrete ask, context and pressure contributions are scaled down.
 * 5. Mitigations subtract points, capped at a share of the positive evidence.
 * 6. score = 100·sigmoid(logit), then floor rules for definitional indicators.
 *
 * Every step is recorded in `trace.terms`; the terms sum exactly to the logit.
 */
export function scoreSignals(signals: DetectedSignal[], opts: ScoreOptions = {}): ScoreResult {
  const m = new Map(signals.map((s) => [s.id, s]));
  const conf = (id: SignalId) => m.get(id)?.confidence ?? 0;
  const maxOf = (ids: SignalId[]) => {
    let best: SignalId | null = null;
    for (const id of ids) if (conf(id) > (best ? conf(best) : 0)) best = id;
    return best;
  };
  const terms: ScoreTerm[] = [];
  terms.push({ kind: "baseline", label: "Baseline", points: POLICY.baseline, detail: "Starting point with no evidence.", signalIds: [] });

  // 1–2. Dimensions.
  const dims = {} as Record<Dimension, number>;
  const dimTerms: ScoreTerm[] = [];
  for (const d of DIMENSIONS) {
    const members = signals.filter((s) => SIGNALS[s.id].dimension === d && !SIGNALS[s.id].mitigating);
    const value = 1 - members.reduce((acc, s) => acc * (1 - SIGNALS[s.id].weight * s.confidence), 1);
    dims[d] = value;
    if (members.length) {
      const pts = POLICY.dimPoints[d] * value;
      const t: ScoreTerm = {
        kind: "dimension",
        label: `${DIM_LABEL[d]} evidence`,
        points: pts,
        detail: `${members.map((s) => SIGNALS[s.id].shortName).join(", ")} → dimension ${Math.round(value * 100)}/100 × ${POLICY.dimPoints[d]} pts`,
        signalIds: members.map((s) => s.id),
      };
      dimTerms.push(t);
      terms.push(t);
    }
  }

  // 3. Interactions.
  const ask = maxOf(ASK_SIGNALS);
  const interactions: ScoreTerm[] = [];
  const pretext = maxOf(PRETEXT);
  if (ask && pretext) {
    interactions.push({
      kind: "interaction",
      label: "Claimed identity + concrete ask",
      points: POLICY.interactions.pretextAsk * Math.min(conf(pretext), conf(ask)),
      detail: `${SIGNALS[pretext].shortName} combined with ${SIGNALS[ask].shortName.toLowerCase()}`,
      signalIds: [pretext, ask],
    });
  }
  const coercion = maxOf(COERCION);
  if (ask && coercion) {
    interactions.push({
      kind: "interaction",
      label: "Coercion + concrete ask",
      points: POLICY.interactions.coercionAsk * Math.min(conf(coercion), conf(ask)),
      detail: `${SIGNALS[coercion].shortName} attached to ${SIGNALS[ask].shortName.toLowerCase()}`,
      signalIds: [coercion, ask],
    });
  }
  const dest = maxOf(DESTINATION);
  if (m.has("urgency") && dest) {
    interactions.push({
      kind: "interaction",
      label: "Deadline toward an unverified recipient",
      points: POLICY.interactions.urgencyDestination * Math.min(conf("urgency"), conf(dest)),
      detail: `Urgency combined with ${SIGNALS[dest].shortName.toLowerCase()}`,
      signalIds: ["urgency", dest],
    });
  }
  const rawInteraction = interactions.reduce((a, t) => a + t.points, 0);
  if (rawInteraction > POLICY.interactions.cap) {
    const scale = POLICY.interactions.cap / rawInteraction;
    for (const t of interactions) {
      t.points *= scale;
      t.detail += ` (scaled ×${scale.toFixed(2)}: interaction cap)`;
    }
  }
  terms.push(...interactions);

  // 4. Gate: no concrete ask.
  const hasAsk = !!ask || !!opts.paymentIntent;
  if (!hasAsk) {
    const manip = dimTerms.filter((t) => t.signalIds.some((id) => ["context", "pressure"].includes(SIGNALS[id].dimension)));
    // A guaranteed-return claim is harmful in itself, so its own contribution is not discounted.
    const protectedPts = m.has("guarantee") ? POLICY.dimPoints.context * SIGNALS.guarantee.weight * conf("guarantee") : 0;
    const reducible = Math.max(0, manip.reduce((a, t) => a + t.points, 0) - protectedPts);
    if (reducible > 0) {
      terms.push({
        kind: "gate",
        label: "No payment or credential request",
        points: -reducible * (1 - POLICY.noAskScale),
        detail: `Nobody asked for money or secrets, so manipulation evidence counts at ×${POLICY.noAskScale}${protectedPts ? " (guaranteed-return claims excepted)" : ""}.`,
        signalIds: [],
      });
    }
  }

  // 5. Mitigations.
  const positive = terms.filter((t) => t.kind !== "baseline").reduce((a, t) => a + t.points, 0);
  const mitigations: ScoreTerm[] = [];
  if (m.has("verification")) {
    const f = hasAsk ? POLICY.mitigation.askPresentFactor : 1;
    mitigations.push({
      kind: "mitigation",
      label: "Independent verification path offered",
      points: -POLICY.mitigation.verification * conf("verification") * f,
      detail: hasAsk ? "Points to official channels, but the same conversation contains a concrete ask (mitigation halved)." : "Points to official, independently verifiable channels.",
      signalIds: ["verification"],
    });
  }
  if (m.has("known_beneficiary")) {
    const f = m.has("credentials") ? POLICY.mitigation.askPresentFactor : 1;
    mitigations.push({
      kind: "mitigation",
      label: "Recipient is a saved beneficiary",
      points: -POLICY.mitigation.knownRecipient * conf("known_beneficiary") * f,
      detail: m.has("credentials")
        ? "Saved recipient, but secrets were requested — a familiar contact can be impersonated or compromised (mitigation halved)."
        : "Paying someone already in the saved-recipient list.",
      signalIds: ["known_beneficiary"],
    });
  }
  const totalMit = -mitigations.reduce((a, t) => a + t.points, 0);
  const capMit = Math.max(0, positive) * POLICY.mitigation.maxShare;
  if (totalMit > capMit && totalMit > 0) {
    const scale = capMit / totalMit;
    for (const t of mitigations) {
      t.points *= scale;
      t.detail += ` Capped: mitigations may remove at most ${POLICY.mitigation.maxShare * 100}% of the risk evidence.`;
    }
  }
  terms.push(...mitigations);

  // 6. Final.
  for (const t of terms) t.points = r2(t.points);
  const logit = r2(terms.reduce((a, t) => a + t.points, 0));
  const rawScore = Math.min(99, Math.max(1, Math.round(100 * sigmoid(logit))));
  let score = rawScore;
  let floorApplied: ScoreTrace["floorApplied"];
  for (const f of POLICY.floors) {
    const s = m.get(f.signal);
    // Floors need pattern- or rule-supported evidence that is not the user's own words; model-only assertions never trigger a floor.
    const strong = s && s.confidence >= f.minConfidence && s.evidence.some((e) => e.kind !== "context" && e.speakerRole !== "user" && e.support !== "model-only");
    if (strong && score < f.floor) {
      score = f.floor;
      floorApplied = { rule: f.rule, floor: f.floor };
    }
  }
  if (floorApplied) {
    terms.push({ kind: "floor", label: "Policy floor", points: 0, detail: floorApplied.rule, signalIds: [] });
  }

  const pct = (x: number) => Math.max(0, Math.min(100, Math.round(x * 100)));
  const dimPct = { transaction: pct(dims.transaction), recipient: pct(dims.recipient), context: pct(dims.context), pressure: pct(dims.pressure) };
  const breakdown = terms.map((t) => ({ label: t.label, value: Math.round(t.points * 10) / 10 }));
  return {
    riskScore: score,
    band: bandFor(score),
    dims: dimPct,
    trace: { terms, logit, rawScore, score, floorApplied },
    breakdown,
  };
}
