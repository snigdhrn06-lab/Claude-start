"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowRight, CheckCircle2, MinusCircle, PlusCircle, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLocal } from "@/lib/engine/analyze";
import { diffAnalyses } from "@/lib/engine/counterfactual";
import type { AnalysisResult } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { cn, riskTone } from "./ui";

export interface Pivot {
  context: string;
  original: string;
  safe: string;
}

function run(context: string, sentence: string): AnalysisResult {
  return analyzeLocal({ conversation: `${context} ${sentence}`.trim(), source: "text", title: "Counterfactual" }, { id: "cf" });
}

const PRESETS = (p: Pivot) => [
  { label: "Remove the deadline", text: p.original.replace(/\s*immediately/i, "") },
  { label: "Remove the threat", text: p.original.replace(/\s*or your account will be frozen/i, " to complete verification") },
  { label: "Offer the official channel", text: p.safe },
];

export function CounterfactualLab({ pivot, autoplay = false, onDone }: { pivot: Pivot; autoplay?: boolean; onDone?: () => void }) {
  const before = useMemo(() => run(pivot.context, pivot.original), [pivot]);
  const [draft, setDraft] = useState(pivot.original);
  const [after, setAfter] = useState<AnalysisResult | null>(null);
  const [typing, setTyping] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const rerun = (text = draft) => setAfter(run(pivot.context, text));

  // Judge mode: type the safer sentence, then re-run.
  useEffect(() => {
    if (!autoplay) return;
    setDraft(pivot.original);
    setAfter(null);
    let cancelled = false;
    const target = pivot.safe;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        setTyping(true);
        setDraft("");
        let i = 0;
        const tick = () => {
          if (cancelled) return;
          i += 2;
          setDraft(target.slice(0, i));
          if (i < target.length) timers.push(setTimeout(tick, 18));
          else {
            setTyping(false);
            timers.push(
              setTimeout(() => {
                setAfter(run(pivot.context, target));
                timers.push(setTimeout(() => doneRef.current?.(), 1600));
              }, 350),
            );
          }
        };
        tick();
      }, 900),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [autoplay, pivot]);

  const diff = after ? diffAnalyses(before, after) : null;
  const shownAfter = after ?? before;
  const toneB = riskTone(before.riskScore);
  const toneA = riskTone(shownAfter.riskScore);
  const edited = draft.trim() !== pivot.original;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel p-5">
          <div className="label mb-3">Original message</div>
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-4 text-[14px] leading-relaxed">
            <span className="text-fg-muted">{pivot.context.replace(/^[^:]+:\s*/, "")} </span>
            <mark className="evidence">{pivot.original}</mark>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12.5px] text-fg-dim">
            Risk <span className={cn("num font-mono font-semibold", toneB.text)}>{before.riskScore}</span> · {before.classification}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="cf-edit" className="label">
              Edit one sentence
            </label>
            {typing && <span className="font-mono text-[10px] uppercase tracking-wider text-info">typing…</span>}
          </div>
          <textarea
            id="cf-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="input resize-none font-mono text-[13.5px] leading-relaxed"
            placeholder="Rewrite the highlighted sentence…"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS(pivot).filter((p) => p.text !== pivot.original).map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setDraft(p.text);
                  rerun(p.text);
                }}
                className="chip cursor-pointer normal-case tracking-normal transition hover:border-white/20 hover:text-fg"
              >
                <Wand2 className="h-3 w-3" /> {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => rerun()} disabled={!draft.trim()}>
              <Sparkles className="h-4 w-4" /> Re-run analysis
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setDraft(pivot.original);
                setAfter(null);
              }}
              disabled={!edited && !after}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel-raised relative overflow-hidden p-6">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl transition-colors duration-700"
            style={{ background: toneA.hex, opacity: 0.12 }}
          />
          <div className="label">Risk score</div>
          <div className="mt-3 flex items-center gap-4 md:gap-6">
            <div className="text-center">
              <div className={cn("num text-5xl font-semibold tracking-tight md:text-6xl", toneB.text)}>{before.riskScore}</div>
              <div className="label mt-1">Original</div>
            </div>
            <ArrowRight className="h-6 w-6 shrink-0 text-fg-dim" />
            <div className="text-center">
              {after ? (
                <AnimatedNumber
                  from={before.riskScore}
                  to={shownAfter.riskScore}
                  duration={1.4}
                  className={cn("text-5xl font-semibold tracking-tight transition-colors duration-500 md:text-6xl", toneA.text)}
                />
              ) : (
                <span className="text-5xl font-semibold tracking-tight text-fg-faint md:text-6xl">—</span>
              )}
              <div className="label mt-1">{after ? "Counterfactual" : "Awaiting edit"}</div>
            </div>
            <AnimatePresence>
              {diff && diff.delta !== 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1 }}
                  className={cn(
                    "ml-auto hidden items-center gap-1 rounded border px-2 py-1 font-mono text-sm sm:flex",
                    diff.delta < 0 ? "border-safe/30 bg-safe/10 text-safe" : "border-risk/30 bg-risk/10 text-risk-soft",
                  )}
                >
                  {diff.delta < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : null}
                  {diff.delta > 0 ? "+" : ""}
                  {diff.delta}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {diff && (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {diff.dims.map((d) => (
                <div key={d.key}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-fg-muted">{d.label}</span>
                    <span className="num font-mono text-fg-dim">
                      {d.before} → <span className={riskTone(d.after).text}>{d.after}</span>
                    </span>
                  </div>
                  <div className="relative h-1 rounded-full bg-white/[0.06]">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${d.before}%` }} />
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: riskTone(d.after).hex }}
                      initial={{ width: `${d.before}%` }}
                      animate={{ width: `${d.after}%` }}
                      transition={{ duration: 1.1, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="label mb-3">Why did the risk change?</div>
          {!diff && <p className="text-[13px] text-fg-muted">Edit the highlighted sentence and re-run. Sentinel will show exactly which signals moved — proof the score comes from context, not guesswork.</p>}
          {diff && !diff.changes.length && <p className="text-[13px] text-fg-muted">No signals changed. The edit didn't alter the manipulation pattern.</p>}
          {diff && (
            <ul className="flex flex-col gap-2">
              {diff.changes.map((c, i) => {
                const good = (c.kind === "removed" || c.kind === "weakened") !== c.mitigating;
                const Icon = c.kind === "added" ? (c.mitigating ? CheckCircle2 : PlusCircle) : MinusCircle;
                return (
                  <motion.li
                    key={c.signalId + c.kind}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.12 }}
                    className={cn("flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13px]", good ? "border-safe/20 bg-safe/[0.05]" : "border-risk/20 bg-risk/[0.05]")}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", good ? "text-safe" : "text-risk-soft")} />
                    {c.text}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
