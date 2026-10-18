// Prints scenario scores, signals and the score trace. Use while reviewing policy changes.
import { analyzeLocal } from "../src/lib/engine/analyze";
import { applyEdits, compareAnalyses } from "../src/lib/engine/counterfactual";
import { HISTORY_SEEDS, SCENARIOS, scenarioInput } from "../src/lib/scenarios";
import type { ScanInput } from "../src/lib/types";

const verbose = process.argv.includes("-v");
const show = (name: string, input: ScanInput) => {
  const r = analyzeLocal(input);
  console.log(
    name.padEnd(26),
    String(r.riskScore).padStart(3),
    r.band.padEnd(9),
    r.decision.action.padEnd(18),
    r.signals.map((s) => `${s.id}:${s.confidence}`).join(" "),
  );
  if (verbose) for (const t of r.scoreTrace.terms) console.log("     ", t.points.toFixed(2).padStart(6), t.label, "—", t.detail);
  return r;
};

for (const sc of SCENARIOS) {
  show(sc.id, scenarioInput(sc));
  const base = { ...scenarioInput(sc, false) };
  const before = show(`  ${sc.id} (chat only)`, base);
  for (const p of sc.counterfactuals) {
    const { input, missing } = applyEdits(base, p.edits);
    if (missing.length) console.log("    !! preset find-text missing:", missing);
    const after = show(`    cf:${p.id}`, input);
    const c = compareAnalyses(before, after);
    console.log("       ", c.delta > 0 ? "+" : "", c.delta, "|", c.reasons.slice(0, 2).join("; "));
  }
}
for (const h of HISTORY_SEEDS) show(h.id, { conversation: h.conversation, payment: h.payment, source: "scenario", accountContext: h.accountContext });
