import { analyzeLocal } from "../src/lib/engine/analyze";
import type { AccountContextInput, AnalysisResult, PaymentDetails } from "../src/lib/types";

export function run(conversation: string | string[], opts: { payment?: PaymentDetails; context?: AccountContextInput } = {}): AnalysisResult {
  return analyzeLocal({
    conversation: Array.isArray(conversation) ? conversation.join("\n") : conversation,
    payment: opts.payment,
    source: "text",
    accountContext: opts.context,
  });
}

export const ids = (r: AnalysisResult) => new Set(r.signals.map((s) => s.id));
export const sig = (r: AnalysisResult, id: string) => r.signals.find((s) => s.id === id);
