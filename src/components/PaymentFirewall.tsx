"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Ban, CheckCircle2, ChevronRight, Hand, Lock, PlugZap, ShieldAlert, ShieldCheck, TriangleAlert, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLocal } from "@/lib/engine/analyze";
import { contextProvider } from "@/lib/engine/context";
import { ACTION_LABEL } from "@/lib/engine/decision";
import { amountAtStake } from "@/lib/engine/narrative";
import { formatINR } from "@/lib/engine/parse";
import { useSentinel } from "@/lib/store";
import type { AnalysisResult, PaymentDetails } from "@/lib/types";
import { SIGNAL_ICONS } from "./icons";
import { RiskBar } from "./RiskGauge";
import { bandTone, cn } from "./ui";

/**
 * Payment check — SIMULATION.
 *
 * Sentinel is not connected to any bank, UPI app or payment rail. This screen
 * shows the decision flow a partner integration could offer: the analysis
 * runs for real on the entered details; the "hold", "cancel" and "proceed"
 * outcomes are simulated and move no money.
 */
type Phase = "form" | "proceed" | "care" | "verify" | "stop" | "cancelled" | "proceeded";

export function PaymentFirewall({ analysis, autoPay = false, onPhase }: { analysis: AnalysisResult; autoPay?: boolean; onPhase?: (p: Phase) => void }) {
  const router = useRouter();
  const { askCircle } = useSentinel();
  const initial: PaymentDetails = analysis.input.payment ?? {
    recipient: analysis.extractedEntities.find((e) => e.type === "recipient" && e.source === "conversation")?.value ?? "",
    amount: amountAtStake(analysis.input.conversation),
    method: "UPI",
    reason: "",
  };
  const [payment, setPayment] = useState<PaymentDetails>(initial);
  const [phase, setPhaseState] = useState<Phase>("form");
  const [assessment, setAssessment] = useState<AnalysisResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const phaseCb = useRef(onPhase);
  phaseCb.current = onPhase;
  const ctx = useMemo(() => contextProvider(analysis.input.accountContext), [analysis.input.accountContext]);

  const setPhase = (p: Phase) => {
    setPhaseState(p);
    phaseCb.current?.(p);
  };

  useEffect(() => {
    setPayment(initial);
    setPhaseState("form");
    setAssessment(null);
    setConfirmOpen(false);
    setAck(false);
    setChecks({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.id]);

  const pay = () => {
    // The real part: the same engine assesses conversation + the details entered here.
    const result = analyzeLocal({ conversation: analysis.input.conversation, payment, source: "payment", title: analysis.title, accountContext: analysis.input.accountContext }, { id: `${analysis.id}-gate` });
    setAssessment(result);
    const next: Record<AnalysisResult["decision"]["action"], Phase> = { stop: "stop", verify_first: "verify", proceed_with_care: "care", proceed: "proceed" };
    setPhase(next[result.decision.action]);
  };

  useEffect(() => {
    if (!autoPay) return;
    const t = setTimeout(pay, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPay, analysis.id]);

  const a = assessment ?? analysis;
  const top = useMemo(() => a.signals.filter((s) => !s.mitigating).slice(0, 5), [a]);
  const tone = bandTone(a.band);
  const steps = a.recommendedActions.filter((r) => r.priority !== "after").slice(0, 4);
  const lookup = payment.recipient.trim() ? ctx.lookupBeneficiary(payment.recipient) : { status: "unknown" as const };

  const ask = () => {
    askCircle(a, `Sentinel rated this request ${a.riskScore}/100 (${bandTone(a.band).label.toLowerCase()}: ${a.classification}). Can you look at it before I pay ${formatINR(payment.amount)} to ${payment.recipient}?`);
    router.push("/circle");
  };

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-caution/30 bg-caution/[0.06] px-3 py-2 text-[12.5px] text-caution" role="note">
        <PlugZap className="h-4 w-4 shrink-0" />
        Simulation only. Sentinel is not connected to any bank or UPI app; nothing here can send, hold or stop a real payment.
      </div>
      <div className="grid gap-5 lg:min-h-[600px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Simulated payment app */}
        <div className="panel-raised mx-auto w-full max-w-[420px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <ArrowLeft className="h-4 w-4 text-fg-dim" /> Send money
            </div>
            <span className="chip">
              <Lock className="h-3 w-3" /> Simulated app
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] font-mono text-sm uppercase text-fg-muted">{(payment.recipient || "?").slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <label className="label text-[9.5px]" htmlFor="fw-recipient">
                  Recipient
                </label>
                <input id="fw-recipient" className="w-full bg-transparent font-mono text-[14px] text-fg outline-none" value={payment.recipient} onChange={(e) => setPayment({ ...payment, recipient: e.target.value })} disabled={phase !== "form"} />
              </div>
              {lookup.status === "known" ? (
                <span className="shrink-0 rounded border border-safe/30 bg-safe/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-safe" title={ctx.describe()}>
                  Saved
                </span>
              ) : lookup.status === "not_in_list" ? (
                <span className="shrink-0 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-warn" title={ctx.describe()}>
                  Not saved
                </span>
              ) : (
                <span className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-fg-dim" title={ctx.describe()}>
                  No history
                </span>
              )}
            </div>
            <div className="text-center">
              <label className="label" htmlFor="fw-amount">
                Amount
              </label>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-2xl text-fg-dim">₹</span>
                <input
                  id="fw-amount"
                  inputMode="numeric"
                  className="num w-44 bg-transparent text-center text-[44px] font-semibold tracking-tight text-fg outline-none"
                  value={payment.amount ? payment.amount.toLocaleString("en-IN") : ""}
                  onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                  disabled={phase !== "form"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                <div className="label text-[9.5px]">Method</div>
                <div className="text-[13px]">{payment.method || "UPI"}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                <div className="label text-[9.5px]">Note</div>
                <input aria-label="Payment note" className="w-full bg-transparent text-[13px] outline-none" value={payment.reason} onChange={(e) => setPayment({ ...payment, reason: e.target.value })} disabled={phase !== "form"} />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={pay} disabled={phase !== "form" || !payment.amount} className="btn-primary h-12 w-full text-[15px]">
              Pay {formatINR(payment.amount)} (simulated)
            </motion.button>
            <p className="text-center font-mono text-[10px] uppercase tracking-wider text-fg-dim">No real payment will be executed</p>
          </div>
        </div>

        {/* Explanation panel */}
        <div className="panel flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-info" />
            <div className="text-sm font-medium">How a decision check would work</div>
          </div>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            A bank&apos;s rules check whether the <em>transaction</em> looks normal. Sentinel checks whether the <em>decision</em> behind it shows signs of manipulation, using the conversation that led here. Pressing pay runs a real analysis of the
            details above; everything after that is a simulation.
          </p>
          <div className="grid gap-2 text-[12.5px] sm:grid-cols-2">
            {[
              { k: "Warning", v: "Shown to you here. Real.", tone: "text-fg" },
              { k: "Recommended action", v: "From the analysis. Real.", tone: "text-fg" },
              { k: "Proposed hold", v: "What a partner app could do. Simulated.", tone: "text-caution" },
              { k: "Bank / UPI integration", v: "Does not exist in this prototype.", tone: "text-fg-dim" },
            ].map((x) => (
              <div key={x.k} className="rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="label text-[9.5px]">{x.k}</div>
                <div className={cn("mt-1", x.tone)}>{x.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-md border border-dashed border-white/[0.08] p-3 font-mono text-[11px] leading-relaxed text-fg-dim">
            Policy: high → recommend stopping · elevated → verify first · caution → proceed with specific checks · low → proceed. Account context: {ctx.label.toLowerCase()}. Edit the recipient or amount to see how the assessment
            responds.
          </div>
        </div>
      </div>

      {/* Outcomes */}
      <AnimatePresence>
        {phase !== "form" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-20 flex items-start justify-center overflow-hidden rounded-lg bg-ink-950/90 backdrop-blur-sm">
            {(phase === "proceed" || phase === "care") && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-lg p-6">
                {phase === "proceed" ? <CheckCircle2 className="mx-auto h-10 w-10 text-safe" /> : <TriangleAlert className="mx-auto h-10 w-10 text-caution" />}
                <div className="mt-3 text-center text-lg font-semibold">{ACTION_LABEL[a.decision.action]}</div>
                <p className="mt-1 text-center text-sm text-fg-muted">
                  Risk {a.riskScore}/100. {a.decision.summary}
                </p>
                {phase === "care" && (
                  <ul className="mt-4 flex flex-col gap-2 text-[13px]">
                    {steps.map((s) => (
                      <li key={s.id} className="flex gap-2">
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
                        <span>
                          <span className="font-medium">{s.title}.</span> <span className="text-fg-muted">{s.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-center text-[12px] text-fg-dim">In a real integration the payment would now continue in your bank app. Here, nothing is sent.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button className="btn-ghost" onClick={() => setPhase("form")}>
                    Back to payment
                  </button>
                  {phase === "care" && (
                    <button className="btn-primary" onClick={() => setPhase("proceeded")}>
                      Continue (simulated)
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {phase === "stop" && (
              <motion.div
                initial={{ scale: 1.03, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="relative h-full w-full overflow-y-auto rounded-lg border border-risk/40 bg-gradient-to-b from-risk/[0.12] via-ink-900 to-ink-900"
                style={{ boxShadow: "inset 0 0 120px -40px rgba(255,74,61,0.6)" }}
              >
                <div className="relative grid gap-6 p-5 md:p-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-risk-soft">
                      <Hand className="h-4 w-4" /> Simulated hold · Sentinel recommends stopping
                    </div>
                    <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mt-3 text-3xl font-semibold uppercase leading-[1.05] tracking-tight md:text-[42px]">
                      Pause before
                      <br />
                      you pay.
                    </motion.h2>
                    <div className={cn("mt-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", tone.text)}>
                      <ShieldAlert className="h-4 w-4" /> {tone.label} · {a.riskScore}/100
                    </div>
                    <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-fg-muted">{a.decision.summary} The details below are the evidence Sentinel found — not proof that the recipient is a criminal.</p>
                    <div className="mt-5 grid max-w-lg gap-3">
                      <RiskBar label="Context" value={a.contextRisk} delay={0.15} />
                      <RiskBar label="Pressure" value={a.pressureRisk} delay={0.25} />
                      <RiskBar label="Transaction" value={a.transactionRisk} delay={0.35} />
                      <RiskBar label="Recipient" value={a.recipientRisk} delay={0.45} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-white/[0.08] bg-ink-850/90 p-4">
                      <div className="label mb-2.5 text-safe">Do this instead</div>
                      <ul className="flex flex-col gap-2 text-[13px]">
                        {steps.map((t, i) => (
                          <motion.li key={t.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }} className="flex gap-2">
                            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
                            <span className="text-fg/90">{t.title}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-safe h-11 flex-1" onClick={() => setPhase("verify")}>
                        <ShieldCheck className="h-4 w-4" /> Verify first
                      </button>
                      <button className="btn-ghost h-11 flex-1" onClick={() => setConfirmOpen(true)}>
                        Proceed anyway
                      </button>
                    </div>
                    <button className="btn-ghost h-10 w-full border-info/25 text-info hover:border-info/50" onClick={ask}>
                      <Users className="h-4 w-4" /> Ask someone you trust (simulated)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "verify" && (
              <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full w-full overflow-y-auto rounded-lg border border-safe/30 bg-ink-900 p-5 md:p-8">
                <div className="label text-safe">Verify before paying · simulated hold</div>
                <h3 className="mt-2 text-2xl font-semibold">Resolve what Sentinel could not.</h3>
                <p className="mt-1 max-w-2xl text-sm text-fg-muted">{a.decision.workflow[3]?.answer}</p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {steps.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setChecks((c) => ({ ...c, [s.id]: !c[s.id] }))}
                      className={cn("panel flex flex-col items-start gap-2 p-4 text-left transition", checks[s.id] ? "border-safe/50 bg-safe/[0.06]" : "hover:border-white/20")}
                      aria-pressed={!!checks[s.id]}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="text-[13.5px] font-medium">{s.title}</div>
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border", checks[s.id] ? "border-safe bg-safe text-ink-950" : "border-white/20")}>{checks[s.id] && <CheckCircle2 className="h-3 w-3" />}</span>
                      </div>
                      <div className="text-[12.5px] leading-snug text-fg-muted">{s.detail}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[12px] text-fg-dim">Ticking a box records your own check; Sentinel cannot confirm it happened.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-safe" onClick={() => setPhase("cancelled")}>
                    <Ban className="h-4 w-4" /> Don&apos;t pay (simulated)
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmOpen(true)}>
                    Verified — proceed (simulated)
                  </button>
                  <button className="btn-ghost" onClick={() => setPhase("form")}>
                    Back
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "cancelled" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-lg border-safe/40 p-7 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-safe" />
                <div className="mt-3 text-xl font-semibold">Payment not sent (simulation)</div>
                <p className="mt-1 text-sm text-fg-muted">No money moved — none could have from this screen. If you already shared a code or paid, contact your bank using the number on your card or its official app.</p>
                <button className="btn-ghost mt-5" onClick={() => setPhase("form")}>
                  Reset
                </button>
              </motion.div>
            )}

            {phase === "proceeded" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-lg p-7 text-center">
                <Lock className="mx-auto h-10 w-10 text-warn" />
                <div className="mt-3 text-lg font-semibold">Simulated payment recorded</div>
                <p className="mt-1 text-sm text-fg-muted">No money moved — this is a demo. A partner integration could add a cooling-off period or a trusted-contact check at this point; none exists here.</p>
                <button className="btn-ghost mt-5" onClick={() => setPhase("form")}>
                  Reset
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmOpen && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-labelledby="confirm-title" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, opacity: 0 }} className="panel-raised relative w-full max-w-lg border-risk/30 p-6">
              <button aria-label="Close" className="absolute right-4 top-4 text-fg-dim hover:text-fg" onClick={() => setConfirmOpen(false)}>
                <X className="h-4 w-4" />
              </button>
              <div className="label text-risk-soft">Are you sure?</div>
              <h3 id="confirm-title" className="mt-1 text-xl font-semibold">
                Send {formatINR(payment.amount)} despite {top.length} risk signal{top.length === 1 ? "" : "s"}?
              </h3>
              <ul className="mt-4 flex flex-col gap-2">
                {top.map((s) => {
                  const Icon = SIGNAL_ICONS[s.id];
                  const e = s.evidence.find((x) => x.kind !== "context") ?? s.evidence[0];
                  return (
                    <li key={s.id} className="flex items-start gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-risk-soft" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{s.label}</div>
                        {e && <div className="truncate font-mono text-[11.5px] text-fg-muted">{e.kind === "context" ? e.text : `“${e.text}”`}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-muted">
                <input type="checkbox" className="mt-0.5 accent-[#ff4a3d]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I understand UPI transfers settle instantly and recovery is not guaranteed.
              </label>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="btn-ghost" onClick={() => setConfirmOpen(false)}>
                  Go back
                </button>
                <button
                  className="btn-risk"
                  disabled={!ack}
                  onClick={() => {
                    setConfirmOpen(false);
                    setAck(false);
                    setPhase("proceeded");
                  }}
                >
                  Proceed (simulated) <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
