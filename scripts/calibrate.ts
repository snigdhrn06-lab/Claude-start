import { detectLocal } from "../src/lib/engine/detect";
import { scoreSignals } from "../src/lib/engine/score";
import { SCENARIOS, HISTORY_SEEDS } from "../src/lib/scenarios";
const run = (name: string, conv: string, pay?: any) => {
  const d = detectLocal(conv, pay);
  const s = scoreSignals(d.signals);
  console.log(name.padEnd(22), s.riskScore, JSON.stringify(s.dims), d.signals.map(x => `${x.id}:${Math.round(x.confidence*100)}`).join(" "));
};
for (const sc of SCENARIOS) run(sc.id, sc.conversation, sc.payment);
for (const h of HISTORY_SEEDS) run(h.id, h.conversation, h.payment);
const k = SCENARIOS[0].pivot!;
run("cf-original", k.context + " " + k.original);
run("cf-safe", k.context + " " + k.safe);
