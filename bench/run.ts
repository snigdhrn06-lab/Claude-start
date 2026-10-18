/**
 * Benchmark runner.
 *
 *   npm run bench                                   # offline: Sentinel (local) + keyword baseline
 *   npm run bench -- --compare=generic-llm,sentinel-llm --repeats=2   # live comparison (needs ANTHROPIC_API_KEY)
 *   npm run bench -- --split=test                   # restrict to one split
 *
 * Writes bench/results/<name>.json and .md. Live assessors that are not
 * available are reported as skipped; no results are fabricated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLocal, ENGINE_VERSION } from "../src/lib/engine/analyze";
import { CATALOG_VERSION } from "../src/lib/engine/catalog";
import { locateQuote, parseConversation } from "../src/lib/engine/parse";
import { POLICY, POLICY_VERSION } from "../src/lib/engine/score";
import { ASSESSORS, toInput, type Assessor, type AssessorOutput } from "./baselines";
import { CASES, DATASET_VERSION, type BenchCase } from "./dataset";
import { confusion, evaluateSentinel, fmt, ratio, sweep, type Ratio, type SentinelReport } from "./metrics";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")) as [string, string][]);
const split = (args.split ?? "all") as "dev" | "test" | "all";
const compare = (args.compare ?? "keyword").split(",").filter(Boolean);
const repeats = Math.max(1, Number(args.repeats ?? 1));
const outName = args.out ?? (compare.some((c) => ASSESSORS[c]?.live) ? "live-comparison" : "latest");

const cases = CASES.filter((c) => split === "all" || c.split === split);

// ── Sentinel (local) full report, per split ─────────────────────────────────
function runSentinel(cs: BenchCase[]) {
  const runs = cs.map((c) => [0, 1, 2].map(() => analyzeLocal(toInput(c))));
  return evaluateSentinel(cs, runs);
}
const reports: Record<string, SentinelReport> = {};
for (const s of ["dev", "test", "all"] as const) {
  const cs = CASES.filter((c) => s === "all" || c.split === s);
  if (split === "all" || split === s) reports[s] = runSentinel(cs);
}

// ── Assessor comparison ─────────────────────────────────────────────────────
const CONCRETE = /\b(call|contact|check|verify|look (?:it )?up|do not share|don'?t share|never share|do not pay|don'?t pay|confirm|open the|report|block|hang up)\b/i;

interface Comparison {
  assessor: string;
  model?: string;
  status: "ran" | "skipped";
  reason?: string;
  detection?: ReturnType<typeof confusion>;
  noVerdict?: Ratio;
  grounding?: Ratio;
  attribution?: Ratio;
  userTextQuoted?: Ratio;
  consistency?: Ratio;
  concreteActions?: Ratio;
  caseSpecificRecs?: Ratio;
  transparentScore?: boolean;
  errors?: number;
}

async function runAssessor(a: Assessor): Promise<Comparison> {
  const av = a.available();
  if (!av.ok) return { assessor: a.name, status: "skipped", reason: av.reason };
  const outs: AssessorOutput[][] = [];
  for (const c of cases) {
    const rs: AssessorOutput[] = [];
    for (let i = 0; i < (a.live ? repeats : Math.max(repeats, 2)); i++) rs.push(await a.assess(c));
    outs.push(rs);
    if (a.live) process.stdout.write(".");
  }
  if (a.live) process.stdout.write("\n");
  let qOk = 0, qTot = 0, spkOk = 0, spkTot = 0, userQ = 0, consistent = 0, concrete = 0, specific = 0, flaggedCases = 0, noVerdict = 0, errors = 0;
  const rows: { truth: boolean; predicted: boolean }[] = [];
  cases.forEach((c, i) => {
    const [o, ...rest] = outs[i];
    if (o.error) errors++;
    if (o.flagged === null) noVerdict++;
    if (c.label !== "ambiguous") rows.push({ truth: c.label === "scam", predicted: o.flagged === true });
    if (rest.every((r) => r.flagged === o.flagged)) consistent++;
    const msgs = parseConversation(c.conversation);
    for (const q of o.quotes) {
      qTot++;
      const hits = locateQuote(c.conversation, msgs, q.text);
      if (!hits.length) continue;
      qOk++;
      if (hits.every((h) => h.speakerRole === "user")) userQ++;
      if (q.speaker) {
        spkTot++;
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (hits.some((h) => norm(h.speaker ?? "") === norm(q.speaker!) || (h.speakerRole === "user" && /^(you|user|me)$/i.test(q.speaker!)))) spkOk++;
      }
    }
    if (o.flagged) {
      flaggedCases++;
      if (o.recommendations.some((r) => CONCRETE.test(r))) concrete++;
      const anchors = [c.payment?.recipient, ...(c.conversation.match(/[a-z0-9._-]+@[a-z]+/gi) ?? []), ...(c.conversation.match(/^([^:\n]{2,40}):/gm) ?? []).map((s) => s.replace(":", ""))].filter(Boolean) as string[];
      if (o.recommendations.some((r) => anchors.some((x) => r.toLowerCase().includes(x.toLowerCase())))) specific++;
    }
  });
  return {
    assessor: a.name,
    model: a.model,
    status: "ran",
    detection: confusion(rows),
    noVerdict: ratio(noVerdict, cases.length),
    grounding: ratio(qOk, qTot),
    attribution: ratio(spkOk, spkTot),
    userTextQuoted: ratio(userQ, qOk),
    consistency: ratio(consistent, cases.length),
    concreteActions: ratio(concrete, flaggedCases),
    caseSpecificRecs: ratio(specific, flaggedCases),
    transparentScore: outs[0]?.[0]?.transparentScore,
    errors,
  };
}

async function main() {
  const comparisons: Comparison[] = [await runAssessor(ASSESSORS["sentinel-local"])];
  for (const name of compare) {
    const a = ASSESSORS[name];
    if (!a) {
      console.error(`Unknown assessor: ${name}. Options: ${Object.keys(ASSESSORS).join(", ")}`);
      process.exit(2);
    }
    if (name !== "sentinel-local") comparisons.push(await runAssessor(a));
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    datasetVersion: DATASET_VERSION,
    engineVersion: ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
    catalogVersion: CATALOG_VERSION,
    bands: POLICY.bands,
    split,
    cases: cases.length,
    repeats,
    counts: {
      scam: cases.filter((c) => c.label === "scam").length,
      legitimate: cases.filter((c) => c.label === "legitimate").length,
      ambiguous: cases.filter((c) => c.label === "ambiguous").length,
    },
  };
  const sweepAll = reports.dev ? sweep(reports.dev.outcomes) : [];
  const json = { meta, sentinel: reports, thresholdSweepDev: sweepAll, comparisons };
  const dir = join(__dirname, "results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${outName}.json`), JSON.stringify(json, null, 2));
  writeFileSync(join(dir, `${outName}.md`), toMarkdown(meta, reports, sweepAll, comparisons));
  console.log(toMarkdown(meta, reports, sweepAll, comparisons).split("\n## Failures")[0]);
  console.log(`\nWrote bench/results/${outName}.json and .md`);
}

function toMarkdown(meta: Record<string, unknown> & { counts: Record<string, number> }, reps: Record<string, SentinelReport>, sw: ReturnType<typeof sweep>, comps: Comparison[]) {
  const L: string[] = [];
  L.push(`# Sentinel benchmark results`);
  L.push("");
  L.push(`Generated ${meta.generatedAt} · dataset v${meta.datasetVersion} · engine v${meta.engineVersion} · policy v${meta.policyVersion} · catalog v${meta.catalogVersion}`);
  L.push("");
  L.push(`Cases: ${meta.cases} (${meta.counts.scam} scam, ${meta.counts.legitimate} legitimate, ${meta.counts.ambiguous} ambiguous). Synthetic, author-written; see docs/EVALUATION.md for limitations. Not an estimate of real-world performance.`);
  L.push("");
  L.push(`## Sentinel (local engine)`);
  L.push("");
  const splits = Object.keys(reps);
  L.push(`| Metric | ${splits.join(" | ")} |`);
  L.push(`|---|${splits.map(() => "---").join("|")}|`);
  const row = (name: string, f: (r: SentinelReport) => string) => L.push(`| ${name} | ${splits.map((s) => f(reps[s])).join(" | ")} |`);
  row("Cases", (r) => String(r.n));
  row("Recall @ elevated+", (r) => fmt(r.binaryAtElevated.recall));
  row("Precision @ elevated+", (r) => fmt(r.binaryAtElevated.precision));
  row("F1 @ elevated+", (r) => fmt(r.binaryAtElevated.f1));
  row("False-positive rate @ elevated+", (r) => fmt(r.binaryAtElevated.fpr));
  row("False-negative rate @ elevated+", (r) => fmt(r.binaryAtElevated.fnr));
  row("Recall @ high", (r) => fmt(r.binaryAtHigh.recall));
  row("False-positive rate @ high", (r) => fmt(r.binaryAtHigh.fpr));
  row("Band matches expectation", (r) => fmt(r.bandAccuracy));
  row("Required signals detected", (r) => fmt(r.requiredSignalRecall));
  row("Forbidden signals raised", (r) => fmt(r.forbiddenSignalViolations));
  row("Quote integrity (text == input[start:end])", (r) => fmt(r.quoteIntegrity));
  row("Annotated evidence found", (r) => fmt(r.annotatedEvidenceRecall));
  row("Speaker attribution accuracy (annotated)", (r) => fmt(r.speakerAttributionAccuracy));
  row("Risk evidence quoted from user's own text", (r) => String(r.userAuthoredEvidenceLeaks));
  row("Entity grounding precision", (r) => fmt(r.entityGroundedPrecision));
  row("Annotated entity recall", (r) => fmt(r.annotatedEntityRecall));
  row("Deterministic repeatability (3 runs)", (r) => fmt(r.deterministicRepeatability));
  row("Score trace reproduces score", (r) => fmt(r.traceConsistency));
  row("Legit urgent payments flagged", (r) => fmt(r.legitUrgentFlagRate));
  L.push("");
  const all = reps.all ?? reps[splits[0]];
  L.push(`### By category (${splits.includes("all") ? "all" : splits[0]})`);
  L.push("");
  L.push(`| Category | n | Band matches | Flagged (elevated+) |`);
  L.push(`|---|---|---|---|`);
  for (const [cat, v] of Object.entries(all.perCategory)) L.push(`| ${cat} | ${v.n} | ${fmt(v.bandAccuracy)} | ${fmt(v.flagRate)} |`);
  L.push("");
  if (sw.length) {
    L.push(`### Threshold sweep (dev split, scam vs legitimate)`);
    L.push("");
    L.push(`| Score ≥ | Recall | FPR | Precision | F1 |`);
    L.push(`|---|---|---|---|---|`);
    for (const s of sw) L.push(`| ${s.threshold} | ${fmt(s.recall)} | ${fmt(s.fpr)} | ${fmt(s.precision)} | ${fmt(s.f1)} |`);
    L.push("");
  }
  L.push(`## Assessor comparison (${meta.split} split${Number(meta.repeats) > 1 ? `, ${meta.repeats} repeats` : ""})`);
  L.push("");
  L.push(`| Assessor | Status | Recall | FPR | Precision | Quotes verbatim | Speaker correct | Quotes from user's text | Same verdict on repeat | Concrete action | Case-specific advice | Reproducible score breakdown |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of comps) {
    if (c.status === "skipped") {
      L.push(`| ${c.assessor} | skipped: ${c.reason} | | | | | | | | | | |`);
      continue;
    }
    L.push(
      `| ${c.assessor}${c.model && ASSESSORS[c.assessor]?.live ? ` (${c.model})` : ""} | ran${c.errors ? `, ${c.errors} errors` : ""} | ${fmt(c.detection!.recall)} | ${fmt(c.detection!.fpr)} | ${fmt(c.detection!.precision)} | ${fmt(c.grounding!)} | ${fmt(c.attribution!)} | ${fmt(c.userTextQuoted!)} | ${fmt(c.consistency!)} | ${fmt(c.concreteActions!)} | ${fmt(c.caseSpecificRecs!)} | ${c.transparentScore ? "yes" : "no"} |`,
    );
  }
  L.push("");
  L.push(`"Concrete action" and "case-specific advice" are keyword heuristics over recommendation text, not human judgements.`);
  L.push("");
  L.push(`## Failures (${all === reps.all ? "all" : splits[0]})`);
  L.push("");
  const fails = all.outcomes.filter((o) => !o.bandOk || o.missingSignals.length || o.forbiddenSignals.length);
  L.push(`| Case | Split | Label | Score | Band | Problems |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const f of fails)
    L.push(`| ${f.id} | ${f.split} | ${f.label} | ${f.score} | ${f.band} | ${[!f.bandOk ? "band" : "", f.missingSignals.length ? `missing ${f.missingSignals.join(",")}` : "", f.forbiddenSignals.length ? `unexpected ${f.forbiddenSignals.join(",")}` : ""].filter(Boolean).join("; ")} |`);
  return L.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
