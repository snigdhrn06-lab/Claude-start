"use client";

import { motion } from "framer-motion";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Cpu,
  Download,
  FileWarning,
  Info,
  ListChecks,
  ShieldAlert,
  Sigma,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ACTION_LABEL } from "@/lib/engine/decision";
import { formatINR } from "@/lib/engine/parse";
import { amountAtStake } from "@/lib/engine/narrative";
import { SCORE_MEANING, toDecisionRecord } from "@/lib/engine/record";
import { POLICY } from "@/lib/engine/score";
import { useSentinel } from "@/lib/store";
import type { AnalysisResult, Evidence, RiskSignal } from "@/lib/types";
import { ConversationView } from "./ConversationView";
import { DimensionGauge, RiskGauge, ScoreCounter } from "./RiskGauge";
import { BasisBadge, RiskSignalCard, speakerLabel } from "./RiskSignalCard";
import { SectionLabel, bandTone, cn } from "./ui";

const CONTEXT_BADGE: Record<AnalysisResult["context"]["mode"], { label: string; cls: string }> = {
  none: { label: "No account history", cls: "border-white/15 text-fg-muted" },
  demo: { label: "Synthetic demo profile", cls: "border-caution/35 bg-caution/[0.07] text-caution" },
  user: { label: "Your saved recipients (unverified)", cls: "border-info/30 text-info" },
};

export function ContextBadge({ mode }: { mode: AnalysisResult["context"]["mode"] }) {
  const b = CONTEXT_BADGE[mode];
  return <span className={cn("chip", b.cls)}>{b.label}</span>;
}

export function ScoreMeaning({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button type="button" className="inline-flex items-center gap-1 text-[12px] text-fg-dim underline-offset-2 hover:text-fg-muted hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CircleHelp className="h-3.5 w-3.5" /> What does this score mean?
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-white/[0.07] bg-black/25 p-3 text-[12.5px] leading-relaxed text-fg-muted">
          <p>{SCORE_MEANING}</p>
          <p className="mt-2">
            Bands (provisional): low &lt; {POLICY.bands.caution} · caution {POLICY.bands.caution}–{POLICY.bands.elevated - 1} · elevated {POLICY.bands.elevated}–{POLICY.bands.high - 1} · high ≥ {POLICY.bands.high}. Thresholds were chosen on a synthetic benchmark and
            have not been validated on real-world data.
          </p>
          <p className="mt-2">It does not mean the sender is a criminal, and a low score does not prove a request is genuine — only that the submitted text does not match known manipulation patterns.</p>
        </div>
      )}
    </div>
  );
}

export function ScoreHero({ result, play = true, onDone }: { result: AnalysisResult; play?: boolean; onDone?: () => void }) {
  const tone = bandTone(result.band);
  const [settled, setSettled] = useState(!play);
  useEffect(() => setSettled(!play), [play, result.id]);
  const alarming = result.band === "high" || result.band === "elevated";
  return (
    <div className="panel-raised relative overflow-hidden p-5 md:p-6">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-opacity duration-700"
        style={{ background: tone.hex, opacity: settled ? 0.13 : 0.04 }}
      />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <RiskGauge
          value={result.riskScore}
          size={184}
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
                  className={cn("text-[52px] font-semibold leading-none tracking-tight", tone.text)}
                />
                <span className="font-mono text-sm text-fg-dim">/100</span>
              </div>
              <span className={cn("mt-1 font-mono text-[10px] uppercase tracking-[0.16em]", tone.text)}>{tone.label}</span>
            </div>
          }
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="label mb-2">Risk assessment</div>
          <motion.div
            initial={false}
            animate={{ opacity: settled ? 1 : 0.25 }}
            className={cn("flex items-start justify-center gap-2 text-lg font-semibold leading-snug sm:justify-start md:text-xl", tone.text)}
          >
            {alarming ? <ShieldAlert className="mt-1 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />}
            {result.headline}
          </motion.div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-[13px] font-medium">
            <span className={cn("h-2 w-2 rounded-full", tone.bg)} />
            {ACTION_LABEL[result.decision.action]}
          </div>
          <motion.p initial={false} animate={{ opacity: settled ? 1 : 0 }} transition={{ duration: 0.4 }} className="mt-3 text-[13.5px] leading-relaxed text-fg-muted">
            {result.explanation}
          </motion.p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="chip text-fg">{result.classification}</span>
            <ContextBadge mode={result.context.mode} />
            <span className="chip" title={result.engine === "llm" ? "An AI model reported signals; every quote was re-checked against the text and the deterministic engine computed the score." : "Pattern detectors and deterministic scoring; no AI model involved."}>
              <Cpu className="h-3 w-3" />
              {result.engine === "llm" ? `AI perception (${result.model}) + deterministic score` : "Local deterministic engine"}
            </span>
          </div>
          <ScoreMeaning className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export function DimensionGrid({ result, play = true, baseDelay = 0.2 }: { result: AnalysisResult; play?: boolean; baseDelay?: number }) {
  const dims = [
    { label: "Context", value: result.contextRisk, caption: "Identity claims & pretext" },
    { label: "Pressure", value: result.pressureRisk, caption: "Deadlines, threats, isolation" },
    { label: "Transaction", value: result.transactionRisk, caption: "The ask: amount, method, reason" },
    { label: "Recipient", value: result.recipientRisk, caption: result.context.mode === "none" ? "Destination (no history supplied)" : "Destination & saved recipients" },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {dims.map((d, i) => (
        <DimensionGauge key={d.label} {...d} play={play} delay={baseDelay + i * 0.12} />
      ))}
    </div>
  );
}

function KeyReasons({ result, onPick, activeId }: { result: AnalysisResult; onPick: (id: RiskSignal["id"]) => void; activeId: string | null }) {
  const top = result.signals.filter((s) => !s.mitigating).slice(0, 3);
  const mit = result.signals.filter((s) => s.mitigating);
  if (!top.length && !mit.length) return null;
  return (
    <div className="panel p-4">
      <div className="label mb-3">Key reasons</div>
      <ol className="flex flex-col gap-2.5">
        {top.map((s, i) => {
          const e = s.evidence.find((x) => x.kind !== "context") ?? s.evidence[0];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className={cn("flex w-full gap-3 rounded-md border px-3 py-2 text-left transition", activeId === s.id ? "border-white/25 bg-white/[0.04]" : "border-transparent hover:border-white/10")}
              >
                <span className="num mt-0.5 font-mono text-[11px] text-fg-dim">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                    {s.label} <BasisBadge basis={s.basis} />
                  </span>
                  {e && (
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">
                      <span className="text-fg-dim">{speakerLabel(e)}: </span>
                      {e.kind === "context" ? e.text : `“${e.text}”`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {mit.length > 0 && (
        <div className="mt-3 border-t border-white/[0.05] pt-3 text-[12.5px] text-fg-muted">
          <span className="text-safe">Reduces concern: </span>
          {mit.map((m) => m.label).join(" · ")}
        </div>
      )}
    </div>
  );
}

function EvidenceDetail({ signal }: { signal: RiskSignal }) {
  return (
    <div className="mt-3 rounded-md border border-white/[0.08] bg-black/25 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] font-medium">
        {signal.label} <BasisBadge basis={signal.basis} />
      </div>
      <p className="text-[12px] leading-snug text-fg-muted">Why it matters: {signal.explanation}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {signal.evidence.map((e, i) => (
          <li key={i} className="text-[12px] leading-snug">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">{speakerLabel(e)}</span>
            {e.kind !== "context" && (
              <span className="ml-2 font-mono text-[10px] text-fg-faint">
                {e.attribution === "attributed" ? "direct quote" : e.attribution === "reported" ? "quoted by you" : "sender unknown"} ·{" "}
                {e.support === "pattern" ? "matched pattern" : e.support === "rule" ? "rule" : "model only"}
              </span>
            )}
            <div className={cn("mt-0.5", e.kind === "context" ? "text-fg-muted" : "font-mono text-fg/85")}>{e.kind === "context" ? e.text : `“${e.text}”`}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextPanel({ result }: { result: AnalysisResult }) {
  const p = result.input.payment;
  const amt = amountAtStake(result.input.conversation, p);
  const recipient = p?.recipient || result.extractedEntities.find((e) => (e.type === "recipient" || e.type === "account") && e.source === "conversation")?.value;
  const status: Record<AnalysisResult["context"]["recipientStatus"], string> = {
    known: "In saved recipients",
    not_in_list: "Not in saved recipients",
    unknown: "Unknown — no history to compare",
    not_applicable: "No recipient identified",
  };
  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="label">Transaction & recipient</div>
        <ContextBadge mode={result.context.mode} />
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-fg-dim">Recipient</dt>
          <dd className="truncate text-right font-mono">{recipient ?? "Not identified"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-dim">Recipient status</dt>
          <dd className="text-right">{status[result.context.recipientStatus]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-dim">Amount</dt>
          <dd className="text-right font-mono">{amt ? formatINR(amt) : "Not stated"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-dim">Typical payment</dt>
          <dd className="text-right font-mono">{result.context.typicalOutgoing ? formatINR(result.context.typicalOutgoing) : "Unknown"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[12px] leading-snug text-fg-dim">{result.context.description}</p>
      <div className="mt-4">
        <DimensionGrid result={result} play={false} />
      </div>
    </div>
  );
}

function Uncertainty({ result }: { result: AnalysisResult }) {
  return (
    <div className="panel p-4">
      <div className="label mb-3 flex items-center gap-1.5">
        <Info className="h-3 w-3" /> What Sentinel cannot know
      </div>
      {result.decision.insufficientEvidence && (
        <p className="mb-3 rounded-md border border-caution/25 bg-caution/[0.06] px-3 py-2 text-[13px] text-caution">There is not enough evidence here for a confident assessment.</p>
      )}
      <ul className="flex flex-col gap-1.5 text-[12.5px] leading-snug text-fg-muted">
        {result.decision.uncertainties.map((u, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-dim" />
            {u}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DecisionWorkflow({ result }: { result: AnalysisResult }) {
  return (
    <div className="min-w-0">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3 w-3" /> Before you authorise
        </span>
      </SectionLabel>
      <ol className="panel divide-y divide-white/[0.05]">
        {result.decision.workflow.map((s, i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex gap-3">
              <span className="num mt-0.5 font-mono text-[11px] text-fg-dim">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-[12px] font-medium uppercase tracking-wide text-fg-dim">{s.question}</div>
                <p className="mt-0.5 text-[13.5px] leading-snug">{s.answer}</p>
                {s.evidence && s.evidence.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.evidence.slice(0, 3).map((e: Evidence, j) => (
                      <span key={j} className="max-w-full truncate rounded border border-white/[0.07] bg-black/20 px-2 py-0.5 font-mono text-[11px] text-fg-muted" title={e.text}>
                        {e.kind === "context" ? e.text : `“${e.text}”`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
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
                <span className={cn("font-mono text-[9.5px] uppercase tracking-wider", r.priority === "now" ? "text-risk-soft" : r.priority === "after" ? "text-fg-dim" : "text-warn")}>{pri[r.priority]}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{r.detail}</p>
              {r.because && r.because.length > 0 && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  Because: {r.because.map((b) => result.signals.find((s) => s.id === b)?.label ?? b).join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ScoreBreakdown({ result }: { result: AnalysisResult }) {
  const t = result.scoreTrace;
  return (
    <div className="min-w-0">
      <p className="mb-3 text-[12.5px] leading-snug text-fg-muted">
        Each dimension combines its signals with diminishing returns, then dimensions, interactions and mitigations add up in log-odds points. The score is 100 × sigmoid(total), then any policy floor. These rows are the
        calculation itself — identical input gives identical rows.
      </p>
      <div className="flex flex-col divide-y divide-white/[0.05] rounded border border-white/[0.06] bg-black/20">
        {t.terms.map((b, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-3 py-2 text-[12.5px]">
            <span className="min-w-0">
              <span className="text-fg">{b.label}</span>
              <span className="block text-[11.5px] leading-snug text-fg-dim">{b.detail}</span>
            </span>
            <span className={cn("num shrink-0 font-mono", b.points < 0 ? "text-safe" : "text-fg")}>{b.kind === "floor" ? `≥ ${t.floorApplied?.floor}` : `${b.points > 0 && b.kind !== "baseline" ? "+" : ""}${b.points.toFixed(2)}`}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
          <span className="text-fg-muted">Total (log-odds) → 100·sigmoid</span>
          <span className="num font-mono">
            {t.logit.toFixed(2)} → {t.rawScore}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertOctagon className="h-3.5 w-3.5" /> Risk score{t.floorApplied ? " (after floor)" : ""}
          </span>
          <span className={cn("num font-mono font-semibold", bandTone(result.band).text)}>{result.riskScore}</span>
        </div>
      </div>
    </div>
  );
}

function Disclosure({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <details className="panel group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium">
        <span className="flex items-center gap-2">
          {icon} {title} {count !== undefined && <span className="chip">{count}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-fg-dim transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.05] p-4">{children}</div>
    </details>
  );
}

function Provenance({ result }: { result: AnalysisResult }) {
  const p = result.provenance;
  const exportRecord = () => {
    const blob = new Blob([JSON.stringify(toDecisionRecord(result), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-decision-${p.inputHash}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 font-mono text-[11.5px] sm:grid-cols-3">
        {[
          ["Engine", p.engineVersion],
          ["Scoring policy", p.policyVersion],
          ["Signal catalogue", p.catalogVersion],
          ["Perception", p.perception === "llm" ? `LLM · ${p.model}` : "local patterns"],
          ["Input fingerprint", p.inputHash],
          ["Parse", `${result.parse.format}, ${result.parse.messageCount} msgs`],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
            <dt className="text-[9.5px] uppercase tracking-wider text-fg-dim">{k}</dt>
            <dd className="truncate">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost py-1.5" onClick={exportRecord}>
          <Download className="h-3.5 w-3.5" /> Export decision record (JSON)
        </button>
        <span className="text-[11.5px] text-fg-dim">The record contains excerpts and offsets, not the full conversation.</span>
      </div>
    </div>
  );
}

function FeedbackWidget({ result }: { result: AnalysisResult }) {
  const { feedback, setFeedback } = useSentinel();
  const f = feedback[result.id];
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="text-[12px] text-fg-dim">Stored only in this browser. It is an unverified self-report used to improve the product — never treated as ground truth.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fg-muted">Was this assessment useful?</span>
        <button type="button" className={cn("btn-ghost py-1", f?.useful === true && "border-safe/40 text-safe")} onClick={() => setFeedback(result.id, { useful: true })} aria-pressed={f?.useful === true}>
          <ThumbsUp className="h-3.5 w-3.5" /> Yes
        </button>
        <button type="button" className={cn("btn-ghost py-1", f?.useful === false && "border-risk/40 text-risk-soft")} onClick={() => setFeedback(result.id, { useful: false })} aria-pressed={f?.useful === false}>
          <ThumbsDown className="h-3.5 w-3.5" /> No
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fg-muted">What turned out to be true?</span>
        {(["was_scam", "was_legitimate", "unsure"] as const).map((o) => (
          <button key={o} type="button" className={cn("chip cursor-pointer normal-case tracking-normal", f?.outcome === o && "border-white/30 text-fg")} onClick={() => setFeedback(result.id, { outcome: o })} aria-pressed={f?.outcome === o}>
            {o === "was_scam" ? "It was a scam" : o === "was_legitimate" ? "It was genuine" : "Not sure"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EntityStrip({ result }: { result: AnalysisResult }) {
  if (!result.extractedEntities.length) return null;
  return (
    <div className="mt-4">
      <div className="label mb-2">Extracted details</div>
      <div className="flex flex-wrap gap-1.5">
        {result.extractedEntities.slice(0, 14).map((e, i) => (
          <span
            key={i}
            title={[e.note, e.source === "payment" ? "From payment details" : e.speakerRole === "user" ? "Mentioned by you" : undefined].filter(Boolean).join(" · ")}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-1 text-[11.5px]",
              e.flagged ? "border-warn/25 bg-warn/[0.05] text-fg" : "border-white/[0.07] bg-white/[0.02] text-fg-muted",
            )}
          >
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-fg-dim">{e.type.replace("_", " ")}</span>
            <span className="truncate">{e.value}</span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-fg-faint">Highlighted details were supplied by the other party and are unverified — not known to be fraudulent.</p>
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
    }, 1200 / Math.max(1, result.signals.length));
    return () => clearInterval(id);
  }, [play, result]);

  const active = useMemo(() => result.signals.find((s) => s.id === activeId), [activeId, result]);
  const allEvidence = useMemo(() => result.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence), [result]);
  const safeEvidence = useMemo(() => result.signals.filter((s) => s.mitigating).flatMap((s) => s.evidence), [result]);
  const pick = (id: RiskSignal["id"]) => setActiveId(activeId === id ? null : id);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ScoreHero result={result} play={play} />
        <KeyReasons result={result} onPick={pick} activeId={activeId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionLabel right={<span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">Select a signal to locate its evidence</span>}>Detected signals</SectionLabel>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {result.signals.map((s, i) => (
              <RiskSignalCard key={s.id} signal={s} index={i} lit={i < lit} active={activeId === s.id} onClick={() => pick(s.id)} />
            ))}
            {!result.signals.length && <div className="panel p-5 text-sm text-fg-muted">No manipulation signals were found in this input.</div>}
          </div>
        </div>
        <div className="min-w-0 lg:sticky lg:top-16 lg:self-start">
          <SectionLabel>Original conversation</SectionLabel>
          <ConversationView
            conversation={result.input.conversation || "(No conversation provided — payment details only.)"}
            highlights={allEvidence}
            active={active?.evidence ?? []}
            safe={safeEvidence}
            maxHeight={420}
          />
          {active && <EvidenceDetail signal={active} />}
          <EntityStrip result={result} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ContextPanel result={result} />
        <Uncertainty result={result} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <DecisionWorkflow result={result} />
        <Recommendations result={result} />
      </div>

      <div className="flex flex-col gap-3">
        <Disclosure title="How the score was calculated" icon={<Sigma className="h-4 w-4 text-fg-dim" />}>
          <ScoreBreakdown result={result} />
        </Disclosure>
        <Disclosure title="Rejected or discounted evidence" icon={<FileWarning className="h-4 w-4 text-fg-dim" />} count={result.rejectedEvidence.length}>
          {result.rejectedEvidence.length ? (
            <ul className="flex flex-col gap-2 text-[12.5px]">
              {result.rejectedEvidence.map((r, i) => (
                <li key={i} className="rounded border border-white/[0.06] bg-black/20 px-3 py-2">
                  <div className="font-mono text-fg/80">“{r.text.length > 140 ? r.text.slice(0, 137) + "…" : r.text}”</div>
                  <div className="mt-0.5 text-fg-dim">
                    {r.signalId ? `${r.signalId}: ` : r.entity ? `${r.entity}: ` : ""}
                    {r.reason}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-fg-muted">Nothing was rejected. Every excerpt passed the grounding and attribution checks.</p>
          )}
        </Disclosure>
        <Disclosure title="Analysis record" icon={<UserRound className="h-4 w-4 text-fg-dim" />}>
          <Provenance result={result} />
        </Disclosure>
        <Disclosure title="Was this useful?" icon={<ThumbsUp className="h-4 w-4 text-fg-dim" />}>
          <FeedbackWidget result={result} />
        </Disclosure>
      </div>

      {!compactActions && (result.band === "elevated" || result.band === "high") && (
        <div className="panel flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <div className="label mb-1">Next</div>
            <div className="text-sm text-fg">See how this pattern is constructed, and walk through the simulated payment check.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/attack-chain" className="btn-ghost">
              Attack chain <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/firewall" className="btn-risk">
              Payment check (simulation) <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
