"use client";

import { FlaskConical, TriangleAlert } from "lucide-react";
import { PageHeader, SectionLabel, cn } from "@/components/ui";
import summary from "@/data/benchmark-summary.json";

/**
 * Evaluation results, read from src/data/benchmark-summary.json, which
 * `npm run bench` regenerates. Nothing on this page is hand-entered.
 */
type R = { num: number; den: number; value: number | null } | null | undefined;
const pct = (r: R) => (!r || r.value === null ? "n/a" : `${(r.value * 100).toFixed(1)}%`);
const frac = (r: R) => (!r ? "" : `${r.num}/${r.den}`);

function Metric({ label, r, help, good }: { label: string; r: R; help: string; good?: "high" | "low" }) {
  const v = r?.value;
  const tone = v == null ? "text-fg" : good === "high" ? (v >= 0.9 ? "text-safe" : v >= 0.75 ? "text-caution" : "text-risk") : good === "low" ? (v <= 0.05 ? "text-safe" : v <= 0.15 ? "text-caution" : "text-risk") : "text-fg";
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className={cn("num mt-2 text-2xl font-semibold", tone)}>{pct(r)}</div>
      <div className="font-mono text-[11px] text-fg-dim">{frac(r)}</div>
      <p className="mt-2 text-[12px] leading-snug text-fg-muted">{help}</p>
    </div>
  );
}

export default function EvaluationPage() {
  const s = summary;
  const all = s.splits.all;
  const test = s.splits.test;
  const first = s.firstHeldOut?.test;
  return (
    <div>
      <PageHeader
        eyebrow="Evaluation"
        title="How well does Sentinel actually work?"
        description={`Measured on a ${s.meta.cases}-case synthetic benchmark (${s.meta.counts.scam} scam, ${s.meta.counts.legitimate} legitimate, ${s.meta.counts.ambiguous} ambiguous) with the local engine. Regenerate with npm run bench.`}
        actions={<span className="chip">dataset v{s.meta.datasetVersion} · policy v{s.meta.policyVersion}</span>}
      />

      <div className="mb-6 flex gap-3 rounded-md border border-caution/30 bg-caution/[0.06] p-4 text-[13px] leading-relaxed text-caution" role="note">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          The cases are synthetic and were written by the same team that wrote the detectors. They do not reflect real-world prevalence, and these numbers are not an estimate of real-world accuracy. Scores are a ranking, not calibrated
          probabilities. The dev/test split limits — but does not remove — overfitting.
        </div>
      </div>

      <SectionLabel>All cases · flagged = elevated or high</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Recall (scams flagged)" r={all.recall} good="high" help="Share of scam cases rated elevated or high." />
        <Metric label="Precision" r={all.precision} good="high" help="Of flagged cases, the share that were scams." />
        <Metric label="False-positive rate" r={all.fpr} good="low" help="Share of legitimate cases wrongly flagged." />
        <Metric label="Legit urgent payments flagged" r={all.legitUrgentFlagRate} good="low" help="Genuine urgent payments (rent, medical, fees) rated elevated or high." />
        <Metric label="Quote integrity" r={all.quoteIntegrity} good="high" help="Evidence text exactly equals the input at its stated offsets." />
        <Metric label="Speaker attribution" r={all.speakerAttribution} good="high" help="Annotated evidence attributed to the right speaker (small annotated subset)." />
        <Metric label="Entity grounding" r={all.entityPrecision} good="high" help="Extracted entities that appear in the input or payment fields." />
        <Metric label="Deterministic repeats" r={all.determinism} good="high" help="Identical output across repeated runs of the same input." />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <SectionLabel>Generalisation: dev vs held-out test</SectionLabel>
          <div className="panel overflow-x-auto p-4">
            <table className="w-full text-[13px]">
              <thead className="text-left text-fg-dim">
                <tr>
                  <th className="py-1.5 font-normal">Split</th>
                  <th className="font-normal">Recall</th>
                  <th className="font-normal">FPR</th>
                  <th className="font-normal">Precision</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-white/[0.05]">
                  <td className="py-1.5 font-sans">Dev (tuned on)</td>
                  <td>{pct(s.splits.dev.recall)}</td>
                  <td>{pct(s.splits.dev.fpr)}</td>
                  <td>{pct(s.splits.dev.precision)}</td>
                </tr>
                {first && (
                  <tr className="border-t border-white/[0.05]">
                    <td className="py-1.5 font-sans">Test — first held-out run</td>
                    <td>{pct(first.recall)}</td>
                    <td>{pct(first.fpr)}</td>
                    <td>{pct(first.precision)}</td>
                  </tr>
                )}
                <tr className="border-t border-white/[0.05]">
                  <td className="py-1.5 font-sans">Test — current (seen)</td>
                  <td>{pct(test.recall)}</td>
                  <td>{pct(test.fpr)}</td>
                  <td>{pct(test.precision)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[12px] leading-snug text-fg-muted">
              The first held-out run is the most honest estimate of how pattern detectors generalise to unseen wording. After that run, general detector gaps it exposed were fixed, so the current test row is no longer held-out.
            </p>
          </div>
        </div>
        <div>
          <SectionLabel>Comparison (offline)</SectionLabel>
          <div className="panel overflow-x-auto p-4">
            <table className="w-full text-[13px]">
              <thead className="text-left text-fg-dim">
                <tr>
                  <th className="py-1.5 font-normal">Assessor</th>
                  <th className="font-normal">Recall</th>
                  <th className="font-normal">FPR</th>
                  <th className="font-normal">Quotes from user</th>
                  <th className="font-normal">Score breakdown</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {s.comparisons.map((c) => (
                  <tr key={c.assessor} className="border-t border-white/[0.05]">
                    <td className="py-1.5 font-sans">{c.assessor}</td>
                    <td>{c.status === "ran" ? pct(c.recall as R) : "—"}</td>
                    <td>{c.status === "ran" ? pct(c.fpr as R) : "—"}</td>
                    <td>{c.status === "ran" ? pct(c.userTextQuoted as R) : "—"}</td>
                    <td>{c.transparentScore ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] leading-snug text-fg-muted">
              The keyword baseline flags any alarming word anywhere — including the user&apos;s own lines. The comparison against a general-purpose LLM needs an API key (npm run bench:live) and has not been run for these results; no LLM
              numbers are shown until it is.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <SectionLabel>By category</SectionLabel>
          <div className="panel overflow-x-auto p-4">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-fg-dim">
                <tr>
                  <th className="py-1.5 font-normal">Category</th>
                  <th className="font-normal">n</th>
                  <th className="font-normal">Expected band</th>
                  <th className="font-normal">Flagged</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {Object.entries(s.perCategory).map(([k, v]) => (
                  <tr key={k} className="border-t border-white/[0.05]">
                    <td className="py-1.5">{k}</td>
                    <td>{v.n}</td>
                    <td className={cn((v.bandAccuracy.value ?? 0) < 0.75 && "text-risk-soft")}>{pct(v.bandAccuracy)}</td>
                    <td>{pct(v.flagRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <SectionLabel>Threshold sweep (dev split)</SectionLabel>
            <div className="panel overflow-x-auto p-4">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-fg-dim">
                  <tr>
                    <th className="py-1 font-normal">Score ≥</th>
                    <th className="font-normal">Recall</th>
                    <th className="font-normal">FPR</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {s.sweep.map((r) => (
                    <tr key={r.threshold} className={cn("border-t border-white/[0.05]", [s.meta.bands.elevated, s.meta.bands.high].includes(r.threshold) && "text-fg")}>
                      <td className="py-1">{r.threshold}</td>
                      <td>{r.recall === null ? "n/a" : `${(r.recall * 100).toFixed(1)}%`}</td>
                      <td>{r.fpr === null ? "n/a" : `${(r.fpr * 100).toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[12px] text-fg-muted">
                Band thresholds (elevated {s.meta.bands.elevated}, high {s.meta.bands.high}) are provisional and sit where the dev split shows no false positives while keeping recall; they need validation on real data.
              </p>
            </div>
          </div>
          <div>
            <SectionLabel>Known misses</SectionLabel>
            <div className="panel p-4">
              <ul className="flex flex-col gap-1.5 text-[12.5px]">
                {s.misses.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 font-mono">
                    <span>
                      {m.id} <span className="text-fg-dim">({m.category})</span>
                    </span>
                    <span className="text-fg-muted">
                      {m.label} → {m.band} ({m.score})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex gap-2 text-[12px] leading-snug text-fg-muted">
                <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Most misses are scams phrased in ways no local pattern covers (paraphrased requests, fake-job purchases, referral top-ups). This is the main limitation of pattern detection, and what optional LLM perception is for —
                its effect has not yet been measured here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
