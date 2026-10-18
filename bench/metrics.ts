/**
 * Evaluation metrics. All ratios use explicit denominators; a metric whose
 * denominator is zero is reported as null ("undefined"), never as 0 or 1.
 */
import { parseConversation } from "../src/lib/engine/parse";
import type { AnalysisResult, RiskBand } from "../src/lib/types";
import type { BenchCase, Category } from "./dataset";

export interface Ratio {
  num: number;
  den: number;
  value: number | null;
}
export const ratio = (num: number, den: number): Ratio => ({ num, den, value: den ? Math.round((num / den) * 1000) / 1000 : null });

export interface Confusion {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: Ratio;
  recall: Ratio;
  f1: number | null;
  fpr: Ratio;
  fnr: Ratio;
}

export function confusion(rows: { truth: boolean; predicted: boolean }[]): Confusion {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    if (r.truth && r.predicted) tp++;
    else if (!r.truth && r.predicted) fp++;
    else if (!r.truth && !r.predicted) tn++;
    else fn++;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const f1 = precision.value !== null && recall.value !== null && precision.value + recall.value > 0 ? Math.round(((2 * precision.value * recall.value) / (precision.value + recall.value)) * 1000) / 1000 : null;
  return { tp, fp, tn, fn, precision, recall, f1, fpr: ratio(fp, fp + tn), fnr: ratio(fn, fn + tp) };
}

const FLAG_BANDS: RiskBand[] = ["elevated", "high"];

export interface CaseOutcome {
  id: string;
  category: Category;
  split: "dev" | "test";
  label: BenchCase["label"];
  score: number;
  band: RiskBand;
  action: string;
  bandOk: boolean;
  missingSignals: string[];
  forbiddenSignals: string[];
  deterministic: boolean;
}

export interface SentinelReport {
  n: number;
  binaryAtElevated: Confusion;
  binaryAtHigh: Confusion;
  bandAccuracy: Ratio;
  requiredSignalRecall: Ratio;
  forbiddenSignalViolations: Ratio;
  quoteIntegrity: Ratio;
  annotatedEvidenceRecall: Ratio;
  speakerAttributionAccuracy: Ratio;
  userAuthoredEvidenceLeaks: number;
  entityGroundedPrecision: Ratio;
  annotatedEntityRecall: Ratio;
  deterministicRepeatability: Ratio;
  traceConsistency: Ratio;
  legitUrgentFlagRate: Ratio;
  perCategory: Record<string, { n: number; bandAccuracy: Ratio; flagRate: Ratio }>;
  outcomes: CaseOutcome[];
}

/** Stable serialisation of a result without per-run fields. */
export function stableResult(r: AnalysisResult) {
  const { id: _id, createdAt: _c, ...rest } = r;
  return JSON.stringify(rest);
}

export function evaluateSentinel(cases: BenchCase[], runs: AnalysisResult[][]): SentinelReport {
  const outcomes: CaseOutcome[] = [];
  let reqHit = 0, reqTotal = 0, forbidHit = 0, forbidTotal = 0;
  let quoteOk = 0, quoteTotal = 0;
  let annFound = 0, annTotal = 0, spkOk = 0, spkTotal = 0;
  let leaks = 0;
  let entOk = 0, entTotal = 0, annEntFound = 0, annEntTotal = 0;
  let detOk = 0, traceOk = 0;

  cases.forEach((c, i) => {
    const [r, ...repeats] = runs[i];
    const ids = new Set(r.signals.map((s) => s.id));
    const missing = (c.expect.signals ?? []).filter((s) => !ids.has(s));
    const forbidden = (c.expect.notSignals ?? []).filter((s) => ids.has(s));
    reqTotal += c.expect.signals?.length ?? 0;
    reqHit += (c.expect.signals?.length ?? 0) - missing.length;
    forbidTotal += c.expect.notSignals?.length ?? 0;
    forbidHit += forbidden.length;

    const messages = parseConversation(c.conversation);
    for (const s of r.signals) {
      for (const e of s.evidence) {
        if (e.kind === "context" || e.source !== "conversation") continue;
        quoteTotal++;
        if (c.conversation.slice(e.start, e.end) === e.text) quoteOk++;
        if (!s.mitigating && e.speakerRole === "user") leaks++;
      }
    }
    for (const a of c.expect.evidence ?? []) {
      annTotal++;
      const ev = r.signals.find((s) => s.id === a.signal)?.evidence.find((e) => e.text.toLowerCase().includes(a.quote.toLowerCase()));
      if (!ev) continue;
      annFound++;
      spkTotal++;
      if (ev.speaker === a.speaker) spkOk++;
    }
    const lc = c.conversation.toLowerCase();
    const pay = c.payment ? `${c.payment.recipient} ${c.payment.amount} ${c.payment.method} ${c.payment.reason}`.toLowerCase() : "";
    for (const e of r.extractedEntities) {
      entTotal++;
      const v = e.value.toLowerCase().replace(/^a\/c |^ifsc /, "");
      const digits = v.replace(/\D/g, "");
      const grounded = lc.includes(v) || pay.includes(v) || (e.type === "amount" && digits.length > 0 && (lc.replace(/[^\d]/g, " ").split(/\s+/).includes(digits) || lc.replace(/,/g, "").includes(digits) || pay.includes(digits)));
      if (grounded) entOk++;
    }
    for (const a of c.expect.entities ?? []) {
      annEntTotal++;
      if (r.extractedEntities.some((e) => e.type === a.type && e.value.toLowerCase().replace(/,/g, "").includes(a.value.toLowerCase().replace(/,/g, "")))) annEntFound++;
    }
    const det = repeats.every((x) => stableResult(x) === stableResult(r));
    if (det) detOk++;
    const sum = Math.round(r.scoreTrace.terms.reduce((a, t) => a + t.points, 0) * 100) / 100;
    const expected = Math.max(r.scoreTrace.rawScore, r.scoreTrace.floorApplied?.floor ?? 0);
    if (Math.abs(sum - r.scoreTrace.logit) < 0.011 && r.riskScore === expected) traceOk++;

    void messages;
    outcomes.push({
      id: c.id,
      category: c.category,
      split: c.split,
      label: c.label,
      score: r.riskScore,
      band: r.band,
      action: r.decision.action,
      bandOk: c.expect.bands.includes(r.band),
      missingSignals: missing,
      forbiddenSignals: forbidden,
      deterministic: det,
    });
  });

  const binary = (bands: RiskBand[]) =>
    confusion(outcomes.filter((o) => o.label !== "ambiguous").map((o) => ({ truth: o.label === "scam", predicted: bands.includes(o.band) })));
  const perCategory: SentinelReport["perCategory"] = {};
  for (const cat of [...new Set(outcomes.map((o) => o.category))]) {
    const os = outcomes.filter((o) => o.category === cat);
    perCategory[cat] = { n: os.length, bandAccuracy: ratio(os.filter((o) => o.bandOk).length, os.length), flagRate: ratio(os.filter((o) => FLAG_BANDS.includes(o.band)).length, os.length) };
  }
  const lu = outcomes.filter((o) => o.category === "legit_urgent");
  return {
    n: cases.length,
    binaryAtElevated: binary(["elevated", "high"]),
    binaryAtHigh: binary(["high"]),
    bandAccuracy: ratio(outcomes.filter((o) => o.bandOk).length, outcomes.length),
    requiredSignalRecall: ratio(reqHit, reqTotal),
    forbiddenSignalViolations: ratio(forbidHit, forbidTotal),
    quoteIntegrity: ratio(quoteOk, quoteTotal),
    annotatedEvidenceRecall: ratio(annFound, annTotal),
    speakerAttributionAccuracy: ratio(spkOk, spkTotal),
    userAuthoredEvidenceLeaks: leaks,
    entityGroundedPrecision: ratio(entOk, entTotal),
    annotatedEntityRecall: ratio(annEntFound, annEntTotal),
    deterministicRepeatability: ratio(detOk, cases.length),
    traceConsistency: ratio(traceOk, cases.length),
    legitUrgentFlagRate: ratio(lu.filter((o) => FLAG_BANDS.includes(o.band)).length, lu.length),
    perCategory,
    outcomes,
  };
}

/** Threshold sweep over raw scores: how recall and FPR trade off. Used to justify band thresholds. */
export function sweep(outcomes: CaseOutcome[], thresholds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]) {
  const rows = outcomes.filter((o) => o.label !== "ambiguous");
  return thresholds.map((t) => {
    const c = confusion(rows.map((o) => ({ truth: o.label === "scam", predicted: o.score >= t })));
    return { threshold: t, recall: c.recall.value, fpr: c.fpr.value, precision: c.precision.value, f1: c.f1 };
  });
}

export const fmt = (r: Ratio | number | null) => {
  if (r === null) return "n/a";
  if (typeof r === "number") return r.toFixed(3);
  return r.value === null ? `n/a (0/0)` : `${(r.value * 100).toFixed(1)}% (${r.num}/${r.den})`;
};
