"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, DoorOpen, Eye, FileSearch, LifeBuoy, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { ErrorState, PageHeader, SectionLabel, cn, riskTone } from "@/components/ui";
import { AUTOPSY_EXAMPLE, runAutopsy, type AutopsyEvent, type AutopsyInput, type AutopsyReport } from "@/lib/engine/autopsy";
import { SIGNALS } from "@/lib/engine/catalog";
import { formatINR } from "@/lib/engine/parse";

const STAGE_TONE: Record<AutopsyEvent["stage"], string> = {
  MESSAGE: "#9aa1ad",
  PRETEXT: "#f2c14e",
  PRESSURE: "#ff8c42",
  "PAYMENT REQUEST": "#ff6b4a",
  PAYMENT: "#ff4a3d",
  "FOLLOW-UP": "#ff6b4a",
  "SECOND REQUEST": "#ff4a3d",
  REPLY: "#8fb4ff",
};

function RiskCurve({ events, exit, first }: { events: AutopsyEvent[]; exit: number; first: number }) {
  const w = 600;
  const h = 120;
  const n = Math.max(1, events.length - 1);
  const pts = events.map((e, i) => [16 + (i / n) * (w - 32), h - 14 - (e.risk / 100) * (h - 28)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0]},${h - 14} L${pts[0][0]},${h - 14} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Risk over the course of the conversation">
      <defs>
        <linearGradient id="ac" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ff4a3d" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff4a3d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 55, 80].map((t) => (
        <line key={t} x1="16" x2={w - 16} y1={h - 14 - (t / 100) * (h - 28)} y2={h - 14 - (t / 100) * (h - 28)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
      ))}
      <motion.path d={area} fill="url(#ac)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} />
      <motion.path d={d} fill="none" stroke="#ff4a3d" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      {pts.map((p, i) => (
        <motion.circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={i === exit ? 6 : 3}
          fill={i === exit ? "#33d69f" : i === first ? "#f2c14e" : "#ff4a3d"}
          stroke="#08090b"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15 + i * 0.08 }}
        />
      ))}
    </svg>
  );
}

export default function AutopsyPage() {
  const [form, setForm] = useState<AutopsyInput>(AUTOPSY_EXAMPLE);
  const [report, setReport] = useState<AutopsyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    if (!form.conversation.trim()) return setError("Add the conversation that led to the payment.");
    if (!form.amount || form.amount <= 0) return setError("Enter the amount that was paid.");
    setLoading(true);
    setReport(null);
    setTimeout(() => {
      try {
        setReport(runAutopsy(form));
      } catch (e) {
        setError((e as Error).message || "Autopsy failed.");
      } finally {
        setLoading(false);
      }
    }, 900);
  };

  const exitEvent = report && report.safeExitIndex >= 0 ? report.events[report.safeExitIndex] : null;
  const firstEvent = report && report.firstVisibleIndex >= 0 ? report.events[report.firstVisibleIndex] : null;

  return (
    <div>
      <PageHeader
        eyebrow="Money autopsy"
        title="What went wrong — and where it could have stopped."
        description="Already paid? Sentinel reconstructs the decision after the fact: when the risk first became visible, the earliest safe exit, and what to do now."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="panel flex flex-col gap-3 self-start p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="a-amt" className="label mb-1.5 block">
                Amount paid (₹)
              </label>
              <input id="a-amt" className="input num font-mono" inputMode="numeric" value={form.amount ? form.amount.toLocaleString("en-IN") : ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} />
            </div>
            <div>
              <label htmlFor="a-date" className="label mb-1.5 block">
                Date
              </label>
              <input id="a-date" type="date" className="input font-mono" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="a-rec" className="label mb-1.5 block">
              Recipient
            </label>
            <input id="a-rec" className="input font-mono" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          </div>
          <div>
            <label htmlFor="a-reason" className="label mb-1.5 block">
              Reason given
            </label>
            <input id="a-reason" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <label htmlFor="a-conv" className="label mb-1.5 block">
              Conversation before paying
            </label>
            <textarea id="a-conv" rows={7} className="input resize-y font-mono text-[12px] leading-relaxed" value={form.conversation} onChange={(e) => setForm({ ...form, conversation: e.target.value })} />
          </div>
          <div>
            <label htmlFor="a-after" className="label mb-1.5 block">
              What happened afterward
            </label>
            <textarea id="a-after" rows={4} className="input resize-y text-[12.5px] leading-relaxed" value={form.afterward} onChange={(e) => setForm({ ...form, afterward: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Run money autopsy
            </button>
            <button className="btn-ghost" onClick={() => { setForm(AUTOPSY_EXAMPLE); setReport(null); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Example
            </button>
          </div>
          {error && <ErrorState title="Can't run autopsy" message={error} />}
        </div>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel relative flex h-[420px] flex-col items-center justify-center overflow-hidden">
                <div className="pointer-events-none absolute inset-0 animate-scan">
                  <div className="h-px w-full bg-risk/50 shadow-[0_0_14px_#ff4a3d]" />
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted">Replaying the conversation message by message…</div>
              </motion.div>
            )}
            {!loading && !report && (
              <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel flex h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
                <FileSearch className="h-8 w-8 text-fg-dim" />
                <div className="text-sm font-medium">No autopsy yet</div>
                <p className="max-w-sm text-[13px] text-fg-muted">Run the example or describe a completed transaction. Sentinel replays the conversation to find the earliest intervention point.</p>
              </motion.div>
            )}
            {!loading && report && (
              <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="panel p-4">
                    <div className="label">Loss</div>
                    <div className="num mt-1 text-2xl font-semibold text-risk">{formatINR(report.totalLoss)}</div>
                    {report.followUpDemand && <div className="mt-0.5 text-[12px] text-fg-muted">+ {report.followUpDemand} demanded afterward</div>}
                  </div>
                  <div className="panel p-4">
                    <div className="label flex items-center gap-1.5"><Eye className="h-3 w-3" /> Risk first visible</div>
                    <div className="mt-1 text-2xl font-semibold text-caution">{firstEvent ? `Message ${report.firstVisibleIndex + 1}` : "—"}</div>
                    {firstEvent && <div className={cn("mt-0.5 font-mono text-[12px]", riskTone(firstEvent.risk).text)}>risk {firstEvent.risk}/100</div>}
                  </div>
                  <div className="panel border-safe/30 p-4">
                    <div className="label flex items-center gap-1.5 text-safe"><DoorOpen className="h-3 w-3" /> Earliest safe exit</div>
                    <div className="mt-1 text-2xl font-semibold text-safe">{exitEvent ? `Message ${report.safeExitIndex + 1}` : "Before paying"}</div>
                    <div className="mt-0.5 text-[12px] text-fg-muted">before any money moved</div>
                  </div>
                </div>

                <div className="panel p-4">
                  <SectionLabel right={<span className="font-mono text-[10px] text-fg-dim">cumulative risk per event</span>}>Risk timeline</SectionLabel>
                  <RiskCurve events={report.events} exit={report.safeExitIndex} first={report.firstVisibleIndex} />
                </div>

                <div className="rounded-lg border border-safe/30 bg-safe/[0.05] p-4 text-[14px] leading-relaxed">
                  <span className="font-semibold text-safe">Earliest safe exit: </span>
                  The earliest intervention point was {report.safeExitReason}.
                  {exitEvent && <span className="mt-2 block font-mono text-[12px] text-fg-muted">“{exitEvent.text}”</span>}
                </div>

                <div>
                  <SectionLabel>Money autopsy · timeline</SectionLabel>
                  <ol className="relative flex flex-col gap-3 pl-6">
                    <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/[0.08]" />
                    {report.events.map((e, i) => (
                      <motion.li key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative">
                        <span className="absolute -left-6 top-3 h-3.5 w-3.5 rounded-full border-2 border-ink-950" style={{ background: e.isSafeExit ? "#33d69f" : STAGE_TONE[e.stage] }} />
                        <div className={cn("panel p-3", e.isSafeExit && "border-safe/40", e.stage === "PAYMENT" && "border-risk/40 bg-risk/[0.05]")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: STAGE_TONE[e.stage] }}>{e.stage}</span>
                            <span className="text-[11.5px] text-fg-dim">{e.actor}</span>
                            {e.isFirstVisible && <span className="chip border-caution/30 text-caution">Risk first visible</span>}
                            {e.isSafeExit && <span className="chip border-safe/30 text-safe">Earliest safe exit</span>}
                            <span className={cn("num ml-auto font-mono text-[11px]", riskTone(e.risk).text)}>{e.risk}</span>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-fg/90">{e.text}</p>
                          {e.newSignals.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {e.newSignals.map((s) => (
                                <span key={s} className="chip border-risk/20">{SIGNALS[s].shortName}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="panel p-4">
                    <div className="label mb-2 flex items-center gap-1.5"><XCircle className="h-3 w-3 text-risk" /> What went wrong?</div>
                    <ul className="flex flex-col gap-2 text-[13px] leading-snug text-fg/90">
                      {report.whatWentWrong.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                  <div className="panel p-4">
                    <div className="label mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-safe" /> What could have prevented it?</div>
                    <ul className="flex flex-col gap-2 text-[13px] leading-snug text-fg/90">
                      {report.prevention.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                  <div className="panel border-caution/25 p-4">
                    <div className="label mb-2 flex items-center gap-1.5 text-caution"><LifeBuoy className="h-3 w-3" /> Do this now</div>
                    <ol className="flex list-decimal flex-col gap-2 pl-4 text-[13px] leading-snug text-fg/90">
                      {report.recovery.map((w) => <li key={w}>{w}</li>)}
                    </ol>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 font-mono text-[10.5px] text-fg-dim">
                  <AlertTriangle className="h-3 w-3" /> Guidance only. Helpline and portal details are for India; confirm with your bank.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
