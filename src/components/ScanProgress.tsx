"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SIGNALS } from "@/lib/engine/catalog";
import type { AnalysisResult } from "@/lib/types";
import { cn } from "./ui";

export const TEXT_STEPS = [
  "Ingesting input",
  "Extracting entities",
  "Identifying pressure signals",
  "Analyzing payment context",
  "Constructing attack path",
  "Calculating risk",
  "Sentinel analysis complete",
];

export const IMAGE_STEPS = [
  "Image received",
  "Extracting text",
  "Identifying entities",
  "Analyzing manipulation",
  "Building attack graph",
  "Complete",
];

function logLines(result: AnalysisResult | null | undefined, input: string) {
  const lines: { k: string; v: string; tone?: "risk" | "safe" | "dim" }[] = [];
  const words = input.split(/\s+/).filter(Boolean);
  lines.push({ k: "ingest.bytes", v: String(new TextEncoder().encode(input).length), tone: "dim" });
  lines.push({ k: "ingest.tokens", v: String(words.length), tone: "dim" });
  if (!result) return lines;
  for (const e of result.extractedEntities.slice(0, 7)) {
    lines.push({ k: `entity.${e.type}`, v: `"${e.value}"`, tone: e.flagged ? "risk" : undefined });
  }
  for (const s of result.signals.slice(0, 8)) {
    lines.push({
      k: `signal.${s.id}`,
      v: `${(s.confidence / 100).toFixed(2)}  ${s.evidence[0] ? `"${s.evidence[0].text.slice(0, 46)}${s.evidence[0].text.length > 46 ? "…" : ""}"` : ""}`,
      tone: SIGNALS[s.id].mitigating ? "safe" : "risk",
    });
  }
  lines.push({ k: "chain.nodes", v: String(result.attackChain.length) });
  lines.push({ k: "risk.context", v: String(result.contextRisk) });
  lines.push({ k: "risk.pressure", v: String(result.pressureRisk) });
  lines.push({ k: "risk.transaction", v: String(result.transactionRisk) });
  lines.push({ k: "risk.recipient", v: String(result.recipientRisk) });
  lines.push({ k: "risk.score", v: `${result.riskScore}/100`, tone: result.riskScore >= 55 ? "risk" : "safe" });
  return lines;
}

export function ScanProgress({
  steps = TEXT_STEPS,
  result,
  input,
  stepMs = 430,
  onComplete,
  className,
}: {
  steps?: string[];
  result?: AnalysisResult | null;
  input: string;
  stepMs?: number;
  onComplete?: () => void;
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const completed = useRef(false);
  const cb = useRef(onComplete);
  cb.current = onComplete;
  const last = steps.length - 1;

  useEffect(() => {
    if (step >= last) return;
    // Hold before the final step until the analysis has arrived.
    if (step === last - 1 && !result) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === last - 1 ? stepMs * 1.2 : stepMs);
    return () => clearTimeout(t);
  }, [step, last, result, stepMs]);

  useEffect(() => {
    if (step === last && !completed.current) {
      completed.current = true;
      const t = setTimeout(() => cb.current?.(), 650);
      return () => clearTimeout(t);
    }
  }, [step, last]);

  const lines = useMemo(() => logLines(result, input), [result, input]);
  const visibleLines = Math.round((lines.length * Math.min(step + 1, last)) / last);
  const pct = Math.round((step / last) * 100);
  const done = step === last;

  return (
    <div className={cn("panel-raised overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2 w-2 rounded-full", done ? "bg-safe" : "animate-pulseDot bg-risk")} />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg">{done ? "Analysis complete" : "Sentinel scanning"}</span>
        </div>
        <span className="num font-mono text-[11px] text-fg-muted">{pct.toString().padStart(3, "0")}%</span>
      </div>
      <div className="h-[2px] w-full bg-white/[0.04]">
        <motion.div
          className={cn("h-full", done ? "bg-safe" : "bg-risk")}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{ boxShadow: done ? "0 0 12px #33d69f" : "0 0 12px #ff4a3d" }}
        />
      </div>
      <div className="grid gap-0 md:grid-cols-[minmax(0,260px)_1fr]">
        <ol className="flex flex-col gap-1 border-b border-white/[0.06] p-4 md:border-b-0 md:border-r">
          {steps.map((s, i) => {
            const state = i < step || (i === last && done) ? "done" : i === step ? "active" : "pending";
            return (
              <li key={s} className="flex items-center gap-3 py-1">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    state === "done" && "border-safe/50 bg-safe/15 text-safe",
                    state === "active" && "border-risk/60 bg-risk/15",
                    state === "pending" && "border-white/10",
                  )}
                >
                  {state === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  {state === "active" && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-risk" />}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                    state === "done" && "text-fg-muted",
                    state === "active" && "text-fg",
                    state === "pending" && "text-fg-faint",
                    i === last && done && "text-safe",
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="relative h-[260px] overflow-hidden bg-black/30">
          <div className="bg-grid-fine absolute inset-0 opacity-60" />
          {!done && (
            <div className="pointer-events-none absolute inset-0 animate-scan">
              <div className="h-24 w-full bg-gradient-to-b from-transparent via-risk/[0.07] to-transparent" />
              <div className="h-px w-full bg-risk/50 shadow-[0_0_14px_#ff4a3d]" />
            </div>
          )}
          <div className="relative flex h-full flex-col justify-end gap-0.5 overflow-hidden p-4 font-mono text-[11px] leading-5">
            <AnimatePresence initial={false}>
              {lines.slice(0, Math.max(2, visibleLines)).map((l, i) => (
                <motion.div
                  key={l.k + i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex min-w-0 gap-3 whitespace-nowrap"
                >
                  <span className="text-fg-faint">{String(i).padStart(2, "0")}</span>
                  <span className={cn("w-40 shrink-0 truncate", l.tone === "dim" ? "text-fg-dim" : "text-fg-muted")}>{l.k}</span>
                  <span className={cn("truncate", l.tone === "risk" ? "text-risk-soft" : l.tone === "safe" ? "text-safe" : l.tone === "dim" ? "text-fg-dim" : "text-fg")}>
                    {l.v}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
