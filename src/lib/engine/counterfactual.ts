import type { AccountContextInput, AnalysisResult, DecisionAction, Dimension, Evidence, RiskBand, ScanInput, SignalId } from "../types";
import { SIGNALS } from "./catalog";
import { ACTION_LABEL } from "./decision";

/**
 * Counterfactual comparison: analyse two controlled variants of the same input
 * and report exactly which evidence, score terms and recommendation changed.
 * The outcome depends only on the detected mechanism — an edit may raise,
 * lower or leave the score unchanged.
 */

export type CounterfactualEdit =
  | { kind: "replace"; find: string; replace: string }
  | { kind: "context"; accountContext: AccountContextInput }
  | { kind: "payment"; recipient?: string; amount?: number };

export interface CounterfactualPreset {
  id: string;
  label: string;
  /** What the edit tests, in plain words. */
  hypothesis: string;
  edits: CounterfactualEdit[];
  /** True if the preset changes synthetic context rather than message text. */
  synthetic?: boolean;
}

export function applyEdits(input: ScanInput, edits: CounterfactualEdit[]): { input: ScanInput; missing: string[] } {
  let conversation = input.conversation;
  let accountContext = input.accountContext;
  let payment = input.payment ? { ...input.payment } : undefined;
  const missing: string[] = [];
  for (const e of edits) {
    if (e.kind === "replace") {
      if (!conversation.includes(e.find)) missing.push(e.find);
      else conversation = conversation.replace(e.find, e.replace);
    } else if (e.kind === "context") accountContext = e.accountContext;
    else if (e.kind === "payment" && payment) payment = { ...payment, ...(e.recipient !== undefined ? { recipient: e.recipient } : {}), ...(e.amount !== undefined ? { amount: e.amount } : {}) };
  }
  return { input: { ...input, conversation, accountContext, payment }, missing };
}

export interface SignalChange {
  kind: "removed" | "added" | "weakened" | "strengthened";
  signalId: SignalId;
  text: string;
  mitigating: boolean;
  before?: number;
  after?: number;
  evidenceBefore?: Evidence;
  evidenceAfter?: Evidence;
}

export interface TermChange {
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface Comparison {
  changes: SignalChange[];
  /** For backwards compatibility with older views. */
  dims: { key: Dimension; label: string; before: number; after: number }[];
  termChanges: TermChange[];
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  bandBefore: RiskBand;
  bandAfter: RiskBand;
  actionBefore: DecisionAction;
  actionAfter: DecisionAction;
  actionChanged: boolean;
  /** Plain-language reasons, largest effect first. */
  reasons: string[];
  limitations: string[];
}

const firstQuote = (s?: AnalysisResult["signals"][number]) => s?.evidence.find((e) => e.kind !== "context") ?? s?.evidence[0];

export function compareAnalyses(before: AnalysisResult, after: AnalysisResult): Comparison {
  const b = new Map(before.signals.map((s) => [s.id, s]));
  const a = new Map(after.signals.map((s) => [s.id, s]));
  const changes: SignalChange[] = [];
  for (const [id, s] of b) {
    const mit = !!SIGNALS[id].mitigating;
    if (!a.has(id)) changes.push({ kind: "removed", signalId: id, text: `${s.label} no longer detected`, mitigating: mit, before: s.confidence, evidenceBefore: firstQuote(s) });
    else if (a.get(id)!.confidence < s.confidence - 4)
      changes.push({ kind: "weakened", signalId: id, text: `${s.label} weaker (${s.confidence} → ${a.get(id)!.confidence})`, mitigating: mit, before: s.confidence, after: a.get(id)!.confidence, evidenceBefore: firstQuote(s), evidenceAfter: firstQuote(a.get(id)) });
  }
  for (const [id, s] of a) {
    const mit = !!SIGNALS[id].mitigating;
    if (!b.has(id)) changes.push({ kind: "added", signalId: id, text: `${s.label} now detected`, mitigating: mit, after: s.confidence, evidenceAfter: firstQuote(s) });
    else if (s.confidence > b.get(id)!.confidence + 4)
      changes.push({ kind: "strengthened", signalId: id, text: `${s.label} stronger (${b.get(id)!.confidence} → ${s.confidence})`, mitigating: mit, before: b.get(id)!.confidence, after: s.confidence, evidenceBefore: firstQuote(b.get(id)), evidenceAfter: firstQuote(s) });
  }
  const good = (c: SignalChange) => (c.kind === "removed" || c.kind === "weakened") !== c.mitigating;
  changes.sort((x, y) => Number(good(y)) - Number(good(x)));

  // Term-level diff: which parts of the calculation moved.
  const termMap = new Map<string, TermChange>();
  for (const t of before.scoreTrace.terms) termMap.set(t.label, { label: t.label, before: t.points, after: 0, delta: 0 });
  for (const t of after.scoreTrace.terms) {
    const e = termMap.get(t.label) ?? { label: t.label, before: 0, after: 0, delta: 0 };
    e.after = t.points;
    termMap.set(t.label, e);
  }
  const termChanges = [...termMap.values()]
    .map((t) => ({ ...t, delta: Math.round((t.after - t.before) * 100) / 100 }))
    .filter((t) => Math.abs(t.delta) >= 0.01)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const reasons = termChanges.slice(0, 4).map((t) =>
    t.before === 0 ? `${t.label} added (${t.delta > 0 ? "+" : ""}${t.delta.toFixed(2)} pts)` : t.after === 0 ? `${t.label} removed (${t.delta.toFixed(2)} pts)` : `${t.label} ${t.delta > 0 ? "rose" : "fell"} by ${Math.abs(t.delta).toFixed(2)} pts`,
  );

  const limitations: string[] = [];
  if (!changes.length)
    limitations.push("No detector responded to this edit. Sentinel can only reflect mechanisms it detects; an unchanged score does not prove the edit is irrelevant.");
  if (before.scoreTrace.floorApplied && after.scoreTrace.floorApplied)
    limitations.push(`Both versions are held at a policy floor (${after.scoreTrace.floorApplied.floor}): ${after.scoreTrace.floorApplied.rule} Edits elsewhere cannot lower it.`);
  if (after.scoreTrace.floorApplied && !before.scoreTrace.floorApplied) limitations.push(`The edited version triggered a policy floor: ${after.scoreTrace.floorApplied.rule}`);
  if ((before.context.mode !== after.context.mode || before.context.recipientStatus !== after.context.recipientStatus) && (after.context.mode === "demo" || before.context.mode === "demo"))
    limitations.push("Recipient context was changed using the synthetic demo profile, not real account history.");
  if (after.signals.some((s) => s.basis === "uncertain")) limitations.push("Some evidence in the edited version has uncertain attribution.");
  const delta = after.riskScore - before.riskScore;
  if (Math.abs(delta) > 0 && Math.abs(delta) < 5 && before.band === after.band) limitations.push("The change is small and does not move the risk band.");
  limitations.push("A counterfactual shows what drives Sentinel's assessment; it does not establish whether the original request was fraudulent.");

  const dims: Comparison["dims"] = [
    { key: "context", label: "Context", before: before.contextRisk, after: after.contextRisk },
    { key: "pressure", label: "Pressure", before: before.pressureRisk, after: after.pressureRisk },
    { key: "transaction", label: "Transaction", before: before.transactionRisk, after: after.transactionRisk },
    { key: "recipient", label: "Recipient", before: before.recipientRisk, after: after.recipientRisk },
  ];
  return {
    changes,
    dims,
    termChanges,
    delta,
    scoreBefore: before.riskScore,
    scoreAfter: after.riskScore,
    bandBefore: before.band,
    bandAfter: after.band,
    actionBefore: before.decision.action,
    actionAfter: after.decision.action,
    actionChanged: before.decision.action !== after.decision.action,
    reasons,
    limitations,
  };
}

/** @deprecated use compareAnalyses */
export const diffAnalyses = compareAnalyses;

export function describeActionChange(c: Comparison) {
  if (!c.actionChanged) return `Recommendation unchanged: ${ACTION_LABEL[c.actionAfter]}.`;
  return `Recommendation changes from “${ACTION_LABEL[c.actionBefore]}” to “${ACTION_LABEL[c.actionAfter]}”.`;
}
