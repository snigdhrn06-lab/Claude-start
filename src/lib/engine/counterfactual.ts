import type { AnalysisResult, Dimension, SignalId } from "../types";
import { SIGNALS } from "./catalog";

export interface CounterfactualChange {
  kind: "removed" | "added" | "weakened" | "strengthened";
  signalId: SignalId;
  text: string;
  mitigating: boolean;
}

const REMOVED_COPY: Partial<Record<SignalId, string>> = {
  urgency: "Urgency signal disappeared",
  threat: "Threat disappeared",
  payment_request: "Payment instruction disappeared",
  reversal: "Pay-to-receive framing disappeared",
  authority: "Institutional claim disappeared",
  guarantee: "Guaranteed-return promise disappeared",
  scarcity: "Scarcity pressure disappeared",
  isolation: "Request for secrecy disappeared",
  credentials: "Credential request disappeared",
  amount_anomaly: "Unusual amount no longer requested",
  new_beneficiary: "Unknown recipient no longer involved",
  unofficial_channel: "Unofficial payment channel removed",
  social_proof: "Social-proof claim disappeared",
  escalation: "Escalating requests disappeared",
  emotional: "Emotional leverage disappeared",
  refund: "Refund bait disappeared",
};

export function diffAnalyses(before: AnalysisResult, after: AnalysisResult) {
  const b = new Map(before.signals.map((s) => [s.id, s]));
  const a = new Map(after.signals.map((s) => [s.id, s]));
  const changes: CounterfactualChange[] = [];
  for (const [id, s] of b) {
    if (!a.has(id)) {
      changes.push({ kind: "removed", signalId: id, text: REMOVED_COPY[id] ?? `${s.label} disappeared`, mitigating: !!s.mitigating });
    } else if (a.get(id)!.confidence < s.confidence - 4) {
      changes.push({ kind: "weakened", signalId: id, text: `${s.label} weakened (${s.confidence}% → ${a.get(id)!.confidence}%)`, mitigating: !!s.mitigating });
    }
  }
  for (const [id, s] of a) {
    if (!b.has(id)) {
      const text = id === "verification" ? "Independent verification became available" : `New signal: ${s.label}`;
      changes.push({ kind: "added", signalId: id, text, mitigating: !!SIGNALS[id].mitigating });
    } else if (s.confidence > b.get(id)!.confidence + 4) {
      changes.push({ kind: "strengthened", signalId: id, text: `${s.label} strengthened`, mitigating: !!s.mitigating });
    }
  }
  // Risk-reducing changes first.
  const good = (c: CounterfactualChange) => (c.kind === "removed" || c.kind === "weakened") !== c.mitigating;
  changes.sort((x, y) => Number(good(y)) - Number(good(x)));

  const dims: { key: Dimension; label: string; before: number; after: number }[] = [
    { key: "context", label: "Context", before: before.contextRisk, after: after.contextRisk },
    { key: "pressure", label: "Pressure", before: before.pressureRisk, after: after.pressureRisk },
    { key: "transaction", label: "Transaction", before: before.transactionRisk, after: after.transactionRisk },
    { key: "recipient", label: "Recipient", before: before.recipientRisk, after: after.recipientRisk },
  ];
  return { changes, dims, delta: after.riskScore - before.riskScore };
}
