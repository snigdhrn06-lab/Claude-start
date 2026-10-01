"use client";

import { motion } from "framer-motion";
import { AlertOctagon, ArrowRight, CheckCircle2, Cpu, ShieldAlert, Sigma } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult, RiskSignal } from "@/lib/types";
import { ConversationView } from "./ConversationView";
import { DimensionGauge, RiskGauge, ScoreCounter } from "./RiskGauge";
import { RiskSignalCard } from "./RiskSignalCard";
import { SectionLabel, cn, riskTone } from "./ui";

export function ScoreHero({ result, play = true, onDone }: { result: AnalysisResult; play?: boolean; onDone?: () => void }) {
  const tone = riskTone(result.riskScore);
  const [settled, setSettled] = useState(!play);
  useEffect(() => setSettled(!play), [play, result.id]);
  const high = result.riskScore >= 55;
  return (
    <div className="panel-raised relative overflow-hidden p-5 md:p-6">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-opacity duration-700"
        style={{ background: tone.hex, opacity: settled ? 0.13 : 0.04 }}
      />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <RiskGauge
          value={result.riskScore}
          size={196}
          stroke={9}
          play={play}
          center={
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <ScoreCounter
                  value={result.riskScore}
                  play={play}
                  onDone={() => {
                    setSettled(true);
                    onDone?.();
                  }}
                  className={cn("text-[56px] font-semibold leading-none tracking-tight", tone.text)}
                />
                <span className="font-mono text-sm text-fg-dim">/100</span>
              </div>
            </div>
          }
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="label mb-2">Sentinel risk score</div>
          <motion.div
            initial={false}
            animate={{ opacity: settled ? 1 : 0.25 }}
            className={cn("flex items-start justify-center gap-2 text-lg font-semibold uppercase leading-snug tracking-wide sm:justify-start md:text-xl", tone.text)}
          >
            {high ? <ShieldAlert className="mt-1 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />}
            {result.headline}
          </motion.div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="chip text-fg">{result.classification}</span>
            <span className="chip">
              <Cpu className="h-3 w-3" />
              {result.engine === "llm" ? `LLM perception · ${result.model}` : "Local deterministic engine"}
            </span>
            <span className="chip">{result.signals.filter((s) => !s.mitigating).length} signals</span>
          </div>
          <motion.p
            initial={false}
            animate={{ opacity: settled ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            className="mt-3 text-[13.5px] leading-relaxed text-fg-muted"
          >
            {result.explanation}
          </motion.p>
        </div>
      </div>
    </div>
  );
}

export function DimensionGrid({ result, play = true, baseDelay = 0.2 }: { result: AnalysisResult; play?: boolean; baseDelay?: number }) {
  const dims = [
    { label: "Transaction Risk", value: result.transactionRisk, caption: "Amount, method, reason" },
    { label: "Recipient Risk", value: result.recipientRisk, caption: "Beneficiary history & channel" },
    { label: "Context Risk", value: result.contextRisk, caption: "Identity claims & pretext" },
    { label: "Pressure Risk", value: result.pressureRisk, caption: "Deadlines, threats, isolation" },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {dims.map((d, i) => (
        <DimensionGauge key={d.label} {...d} play={play} delay={baseDelay + i * 0.12} />
      ))}
    </div>
  );
}

export function AnalysisView({ result, play = true, compactActions = false }: { result: AnalysisResult; play?: boolean; compactActions?: boolean }) {
  const [activeId, setActiveId] = useState<RiskSignal["id"] | null>(null);
  const [lit, setLit] = useState(play ? 0 : result.signals.length);
  useEffect(() => {
    setActiveId(null);
    if (!play) return setLit(result.signals.length);
    setLit(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLit(i);
      if (i >= result.signals.length) clearInterval(id);
    }, 1700 / Math.max(1, result.signals.length));
    return () => clearInterval(id);
  }, [play, result]);

  const active = useMemo(() => result.signals.find((s) => s.id === activeId), [activeId, result]);
  const allEvidence = useMemo(() => result.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence), [result]);
  const safeEvidence = useMemo(() => result.signals.filter((s) => s.mitigating).flatMap((s) => s.evidence), [result]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ScoreHero result={result} play={play} />
        <DimensionGrid result={result} play={play} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionLabel right={<span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">Click a signal to locate it</span>}>
            Detected signals
          </SectionLabel>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {result.signals.map((s, i) => (
              <RiskSignalCard
                key={s.id}
                signal={s}
                index={i}
                lit={i < lit}
                active={activeId === s.id}
                onClick={() => setActiveId(activeId === s.id ? null : s.id)}
              />
            ))}
            {!result.signals.length && (
              <div className="panel p-5 text-sm text-fg-muted">No manipulation signals were found in this input.</div>
            )}
          </div>
        </div>
        <div className="min-w-0 lg:sticky lg:top-16 lg:self-start">
          <SectionLabel>Original conversation</SectionLabel>
          <ConversationView
            conversation={result.input.conversation || "(No conversation provided — payment details only.)"}
            highlights={allEvidence}
            active={active?.evidence ?? []}
            safe={safeEvidence}
            maxHeight={460}
          />
          {active && active.evidence.some((e) => e.source === "payment") && (
            <div className="mt-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-[11.5px] text-fg-muted">
              From payment record: {active.evidence.find((e) => e.source === "payment")?.text}
            </div>
          )}
          <EntityStrip result={result} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Recommendations result={result} />
        <ScoreBreakdown result={result} />
      </div>

      {!compactActions && result.riskScore >= 25 && (
        <div className="panel flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <div className="label mb-1">Next</div>
            <div className="text-sm text-fg">See how the attack is constructed — and what happens if the payment goes through.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/attack-chain" className="btn-ghost">
              Attack chain <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/firewall" className="btn-risk">
              Open payment firewall <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function EntityStrip({ result }: { result: AnalysisResult }) {
  if (!result.extractedEntities.length) return null;
  return (
    <div className="mt-4">
      <div className="label mb-2">Extracted entities</div>
      <div className="flex flex-wrap gap-1.5">
        {result.extractedEntities.slice(0, 12).map((e, i) => (
          <span
            key={i}
            title={e.note}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-1 text-[11.5px]",
              e.flagged ? "border-risk/25 bg-risk/[0.06] text-fg" : "border-white/[0.07] bg-white/[0.02] text-fg-muted",
            )}
          >
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-fg-dim">{e.type.replace("_", " ")}</span>
            <span className="truncate">{e.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Recommendations({ result }: { result: AnalysisResult }) {
  const pri = { now: "Now", "before-paying": "Before paying", after: "If already paid" } as const;
  return (
    <div className="min-w-0">
      <SectionLabel>Recommended actions</SectionLabel>
      <ol className="panel divide-y divide-white/[0.05]">
        {result.recommendedActions.map((r, i) => (
          <li key={r.id} className="flex gap-3 px-4 py-3">
            <span className="num mt-0.5 font-mono text-[11px] text-fg-dim">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-medium">{r.title}</span>
                <span className={cn("font-mono text-[9.5px] uppercase tracking-wider", r.priority === "now" ? "text-risk-soft" : r.priority === "after" ? "text-fg-dim" : "text-warn")}>
                  {pri[r.priority]}
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{r.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ScoreBreakdown({ result }: { result: AnalysisResult }) {
  return (
    <div className="min-w-0">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Sigma className="h-3 w-3" /> How the score was built
        </span>
      </SectionLabel>
      <div className="panel p-4">
        <p className="mb-3 text-[12.5px] leading-snug text-fg-muted">
          Each dimension combines its signals as independent evidence (noisy-OR of weight × confidence). Named interaction terms capture
          combinations that matter more than their parts. No black box: identical input always yields the identical score.
        </p>
        <div className="flex flex-col divide-y divide-white/[0.05] rounded border border-white/[0.06] bg-black/20">
          {result.scoreBreakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
              <span className="text-fg-muted">{b.label}</span>
              <span className={cn("num font-mono", b.value < 0 ? "text-safe" : "text-fg")}>{b.value > 0 && !/risk$/i.test(b.label) ? "+" : ""}{b.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertOctagon className="h-3.5 w-3.5" /> Sentinel risk score
            </span>
            <span className={cn("num font-mono font-semibold", riskTone(result.riskScore).text)}>{result.riskScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
