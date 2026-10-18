"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FlaskConical, MinusCircle, PlusCircle, RotateCcw, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLocal } from "@/lib/engine/analyze";
import { applyEdits, compareAnalyses, describeActionChange, type CounterfactualEdit, type CounterfactualPreset } from "@/lib/engine/counterfactual";
import { ACTION_LABEL } from "@/lib/engine/decision";
import { parseConversation } from "@/lib/engine/parse";
import { scenarioInput, type Scenario } from "@/lib/scenarios";
import type { ScanInput } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { bandTone, cn } from "./ui";

/**
 * Counterfactual lab: apply a controlled edit to one input and re-run the same
 * deterministic pipeline on both versions. Everything shown on the right is
 * computed from the two analyses — nothing is scripted per scenario.
 */
export function CounterfactualLab({ scenario, autoplayPresetId, onDone }: { scenario: Scenario; autoplayPresetId?: string; onDone?: () => void }) {
  const base: ScanInput = useMemo(() => ({ ...scenarioInput(scenario, false), title: "Counterfactual (original)" }), [scenario]);
  const before = useMemo(() => analyzeLocal(base, { id: "cf-before" }), [base]);
  const messages = useMemo(() => parseConversation(base.conversation).filter((m) => m.role === "counterparty" || m.role === "unknown"), [base]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [edits, setEdits] = useState<CounterfactualEdit[] | null>(null);
  const [customIdx, setCustomIdx] = useState(0);
  const [customText, setCustomText] = useState(messages[0]?.text ?? "");
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setPresetId(null);
    setEdits(null);
    setCustomIdx(0);
    setCustomText(messages[0]?.text ?? "");
  }, [scenario.id, messages]);

  const applied = useMemo(() => (edits ? applyEdits(base, edits) : null), [base, edits]);
  const after = useMemo(() => (applied ? analyzeLocal({ ...applied.input, title: "Counterfactual (edited)" }, { id: "cf-after" }) : null), [applied]);
  const cmp = after ? compareAnalyses(before, after) : null;

  const runPreset = (p: CounterfactualPreset) => {
    setPresetId(p.id);
    setEdits(p.edits);
  };
  const runCustom = () => {
    const msg = messages[customIdx];
    if (!msg || customText === msg.text) return;
    setPresetId("custom");
    setEdits([{ kind: "replace", find: msg.text, replace: customText }]);
  };

  // Judge mode: apply a named preset (no simulated typing — the computation is instant).
  useEffect(() => {
    if (!autoplayPresetId) return;
    const p = scenario.counterfactuals.find((x) => x.id === autoplayPresetId);
    if (!p) return;
    const t1 = setTimeout(() => runPreset(p), 700);
    const t2 = setTimeout(() => doneRef.current?.(), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [autoplayPresetId, scenario]);

  const preset = scenario.counterfactuals.find((p) => p.id === presetId);
  const toneB = bandTone(before.band);
  const toneA = after ? bandTone(after.band) : toneB;

  // Changed messages, for the before/after evidence view.
  const changedMessages = useMemo(() => {
    if (!applied) return [];
    const a = parseConversation(base.conversation).filter((m) => m.role !== "reported");
    const b = parseConversation(applied.input.conversation).filter((m) => m.role !== "reported");
    const out: { sender: string; before?: string; after?: string }[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i]?.text !== b[i]?.text) out.push({ sender: (b[i] ?? a[i]).sender, before: a[i]?.text, after: b[i]?.text });
    return out;
  }, [applied, base]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel p-5">
          <div className="label mb-3 flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3" /> Controlled edits
          </div>
          <ul className="flex flex-col gap-2">
            {scenario.counterfactuals.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => runPreset(p)}
                  className={cn("w-full rounded-md border px-3 py-2.5 text-left transition", presetId === p.id ? "border-white/25 bg-white/[0.05]" : "border-white/[0.07] hover:border-white/15")}
                  aria-pressed={presetId === p.id}
                >
                  <div className="flex items-center gap-2 text-[13.5px] font-medium">
                    <Wand2 className="h-3.5 w-3.5 text-fg-dim" /> {p.label}
                    {p.synthetic && <span className="chip border-caution/30 text-caution">synthetic context</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-fg-dim">{p.hypothesis}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-5">
          <label htmlFor="cf-msg" className="label mb-2 block">
            Or edit any message yourself
          </label>
          <select
            id="cf-msg"
            className="input mb-2 text-[13px]"
            value={customIdx}
            onChange={(e) => {
              const i = Number(e.target.value);
              setCustomIdx(i);
              setCustomText(messages[i]?.text ?? "");
            }}
          >
            {messages.map((m, i) => (
              <option key={i} value={i}>
                {m.sender}: {m.text.slice(0, 70)}
                {m.text.length > 70 ? "…" : ""}
              </option>
            ))}
          </select>
          <textarea aria-label="Edited message text" value={customText} onChange={(e) => setCustomText(e.target.value)} rows={4} className="input resize-y font-mono text-[13px] leading-relaxed" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={runCustom} disabled={!messages[customIdx] || customText === messages[customIdx]?.text}>
              <Sparkles className="h-4 w-4" /> Re-run with my edit
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setEdits(null);
                setPresetId(null);
                setCustomText(messages[customIdx]?.text ?? "");
              }}
              disabled={!edits}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-dim">
            Both versions run through the same deterministic engine with the same account context ({before.context.label.toLowerCase()}). Payment fields are excluded so only the edited content changes.
          </p>
        </div>

        {changedMessages.length > 0 && (
          <div className="panel p-5">
            <div className="label mb-3">What changed in the input</div>
            <div className="flex flex-col gap-3">
              {changedMessages.map((c, i) => (
                <div key={i} className="text-[13px] leading-relaxed">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">{c.sender}</div>
                  {c.before && <div className="rounded-t border border-risk/20 bg-risk/[0.05] px-3 py-2 text-fg-muted line-through decoration-risk/50">{c.before}</div>}
                  {c.after && <div className="rounded-b border border-safe/20 bg-safe/[0.05] px-3 py-2">{c.after}</div>}
                </div>
              ))}
              {preset?.synthetic && <p className="text-[12px] text-caution">This edit changes synthetic account context, not message text.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel-raised relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl transition-colors duration-700" style={{ background: toneA.hex, opacity: 0.12 }} />
          <div className="label">Risk score</div>
          <div className="mt-3 flex items-center gap-4 md:gap-6">
            <div className="text-center">
              <div className={cn("num text-5xl font-semibold tracking-tight md:text-6xl", toneB.text)}>{before.riskScore}</div>
              <div className="label mt-1">Original</div>
            </div>
            <ArrowRight className="h-6 w-6 shrink-0 text-fg-dim" />
            <div className="text-center">
              {after ? (
                <AnimatedNumber key={presetId ?? ""} from={before.riskScore} to={after.riskScore} duration={0.9} className={cn("text-5xl font-semibold tracking-tight md:text-6xl", toneA.text)} />
              ) : (
                <span className="text-5xl font-semibold tracking-tight text-fg-faint md:text-6xl">—</span>
              )}
              <div className="label mt-1">{after ? "Edited" : "Choose an edit"}</div>
            </div>
            {cmp && (
              <div className={cn("ml-auto hidden rounded border px-2 py-1 font-mono text-sm sm:block", cmp.delta < 0 ? "border-safe/30 bg-safe/10 text-safe" : cmp.delta > 0 ? "border-risk/30 bg-risk/10 text-risk-soft" : "border-white/15 text-fg-muted")}>
                {cmp.delta > 0 ? "+" : ""}
                {cmp.delta}
              </div>
            )}
          </div>
          {cmp && after && (
            <div className="mt-4 rounded-md border border-white/[0.08] bg-black/25 px-3 py-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={toneB.text}>{ACTION_LABEL[cmp.actionBefore]}</span>
                <ArrowRight className="h-3.5 w-3.5 text-fg-dim" />
                <span className={toneA.text}>{ACTION_LABEL[cmp.actionAfter]}</span>
              </div>
              <div className="mt-1 text-[12px] text-fg-muted">{describeActionChange(cmp)}</div>
            </div>
          )}
          {cmp && (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {cmp.dims.map((d) => (
                <div key={d.key}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-fg-muted">{d.label}</span>
                    <span className="num font-mono text-fg-dim">
                      {d.before} → <span className="text-fg">{d.after}</span>
                    </span>
                  </div>
                  <div className="relative h-1 rounded-full bg-white/[0.06]">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${d.before}%` }} />
                    <motion.div className="absolute inset-y-0 left-0 rounded-full bg-fg/70" initial={{ width: `${d.before}%` }} animate={{ width: `${d.after}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="label mb-3">Which evidence changed</div>
          {!cmp && <p className="text-[13px] text-fg-muted">Pick an edit. Sentinel re-runs the full analysis on both versions and shows exactly which signals and score terms moved — or that nothing did.</p>}
          {cmp && !cmp.changes.length && <p className="text-[13px] text-fg-muted">No signal changed.</p>}
          <AnimatePresence>
            {cmp && (
              <ul className="flex flex-col gap-2">
                {cmp.changes.map((c, i) => {
                  const good = (c.kind === "removed" || c.kind === "weakened") !== c.mitigating;
                  const Icon = c.kind === "added" ? (c.mitigating ? CheckCircle2 : PlusCircle) : MinusCircle;
                  const ev = c.evidenceAfter ?? c.evidenceBefore;
                  return (
                    <motion.li key={c.signalId + c.kind} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className={cn("rounded-md border px-3 py-2 text-[13px]", good ? "border-safe/20 bg-safe/[0.05]" : "border-risk/20 bg-risk/[0.05]")}>
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn("h-4 w-4 shrink-0", good ? "text-safe" : "text-risk-soft")} />
                        {c.text}
                      </div>
                      {ev && <div className="mt-1 truncate pl-6 font-mono text-[11.5px] text-fg-dim" title={ev.text}>{ev.kind === "context" ? ev.text : `“${ev.text}”`}</div>}
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </AnimatePresence>
        </div>

        {cmp && cmp.termChanges.length > 0 && (
          <div className="panel p-5">
            <div className="label mb-3">Why the score moved (score terms, log-odds points)</div>
            <div className="divide-y divide-white/[0.05] rounded border border-white/[0.06] bg-black/20 text-[12.5px]">
              {cmp.termChanges.map((t) => (
                <div key={t.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="text-fg-muted">{t.label}</span>
                  <span className="num font-mono">
                    {t.before.toFixed(2)} → {t.after.toFixed(2)}{" "}
                    <span className={t.delta < 0 ? "text-safe" : "text-risk-soft"}>
                      ({t.delta > 0 ? "+" : ""}
                      {t.delta.toFixed(2)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {before.riskScore >= 97 && after && after.riskScore >= 97 && (
              <p className="mt-2 text-[12px] text-fg-dim">Both versions are at the top of the scale, where the score saturates; compare the terms above rather than the headline number.</p>
            )}
          </div>
        )}

        {cmp && (
          <div className="panel p-5">
            <div className="label mb-2 flex items-center gap-1.5">
              <TriangleAlert className="h-3 w-3" /> Limits of this comparison
            </div>
            <ul className="flex flex-col gap-1.5 text-[12.5px] leading-snug text-fg-muted">
              {cmp.limitations.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-dim" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
