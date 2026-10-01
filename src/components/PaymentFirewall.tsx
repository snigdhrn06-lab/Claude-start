"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  Hand,
  Lock,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLocal } from "@/lib/engine/analyze";
import { ACCOUNT_PROFILE } from "@/lib/engine/catalog";
import { formatINR } from "@/lib/engine/parse";
import { useSentinel } from "@/lib/store";
import type { AnalysisResult, PaymentDetails } from "@/lib/types";
import { SIGNAL_ICONS } from "./icons";
import { RiskBar } from "./RiskGauge";
import { cn, riskTone } from "./ui";

type Phase = "form" | "checking" | "cleared" | "intercepted" | "verify" | "verified" | "proceeded";

export interface FirewallHandle {
  phase: Phase;
}

const VERIFY_STEPS = [
  { icon: Phone, title: "Call the number printed on your card", detail: "Not the number in the message. Ask whether your KYC is actually pending." },
  { icon: ShieldCheck, title: "Open the official app yourself", detail: "Type the address or open the installed app — never a link from the sender." },
  { icon: Users, title: "Ask someone you trust", detail: "Share the conversation with your Sentinel Circle before deciding." },
];

export function PaymentFirewall({
  analysis,
  autoPay = false,
  onPhase,
}: {
  analysis: AnalysisResult;
  /** Judge mode: press PAY automatically after a short delay. */
  autoPay?: boolean;
  onPhase?: (p: Phase) => void;
}) {
  const router = useRouter();
  const { askCircle } = useSentinel();
  const initial: PaymentDetails = analysis.input.payment ?? {
    recipient: analysis.extractedEntities.find((e) => e.type === "recipient")?.value ?? "",
    amount: Number((analysis.extractedEntities.find((e) => e.type === "amount")?.value ?? "0").replace(/[^\d]/g, "")) || 0,
    method: "UPI",
    reason: "",
  };
  const [payment, setPayment] = useState<PaymentDetails>(initial);
  const [phase, setPhaseState] = useState<Phase>("form");
  const [assessment, setAssessment] = useState<AnalysisResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const phaseCb = useRef(onPhase);
  phaseCb.current = onPhase;

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
    setChecks([false, false, false]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.id]);

  const pay = () => {
    setPhase("checking");
    const result = analyzeLocal(
      { conversation: analysis.input.conversation, payment, source: "payment", title: analysis.title },
      { id: `${analysis.id}-gate` },
    );
    setAssessment(result);
    setTimeout(() => setPhase(result.riskScore >= 55 ? "intercepted" : "cleared"), 650);
  };

  useEffect(() => {
    if (!autoPay) return;
    const t = setTimeout(pay, 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPay, analysis.id]);

  const a = assessment ?? analysis;
  const top = useMemo(() => a.signals.filter((s) => !s.mitigating).slice(0, 5), [a]);
  const tone = riskTone(a.riskScore);

  const ask = () => {
    askCircle(a, `Sentinel detected a high-risk financial request (${a.riskScore}/100 — ${a.classification}). Can you review this before I pay ${formatINR(payment.amount)} to ${payment.recipient}?`);
    router.push("/circle");
  };

  return (
    <div className="relative">
      <div className="grid gap-5 lg:min-h-[620px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Simulated bank app */}
        <div className="panel-raised mx-auto w-full max-w-[420px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <ArrowLeft className="h-4 w-4 text-fg-dim" /> Send money
            </div>
            <span className="chip">
              <Lock className="h-3 w-3" /> Simulated
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] font-mono text-sm uppercase text-fg-muted">
                {(payment.recipient || "?").slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <label className="label text-[9.5px]" htmlFor="fw-recipient">
                  Recipient
                </label>
                <input
                  id="fw-recipient"
                  className="w-full bg-transparent font-mono text-[14px] text-fg outline-none"
                  value={payment.recipient}
                  onChange={(e) => setPayment({ ...payment, recipient: e.target.value })}
                  disabled={phase !== "form"}
                />
              </div>
              {ACCOUNT_PROFILE.knownBeneficiaries.includes(payment.recipient.trim().toLowerCase()) ? (
                <span className="shrink-0 rounded border border-safe/30 bg-safe/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-safe">Saved</span>
              ) : (
                <span className="shrink-0 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-warn">New</span>
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
                <input
                  aria-label="Payment note"
                  className="w-full bg-transparent text-[13px] outline-none"
                  value={payment.reason}
                  onChange={(e) => setPayment({ ...payment, reason: e.target.value })}
                  disabled={phase !== "form"}
                />
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={pay}
              disabled={phase !== "form" || !payment.amount}
              className="btn-primary h-12 w-full text-[15px]"
            >
              {phase === "checking" ? (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-ink-950" /> Sentinel checking context…
                </span>
              ) : (
                <>Pay {formatINR(payment.amount)}</>
              )}
            </motion.button>
            <p className="text-center font-mono text-[10px] uppercase tracking-wider text-fg-dim">Demo · no real payment will be executed</p>
          </div>
        </div>

        {/* Context panel */}
        <div className="panel flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-info" />
            <div className="text-sm font-medium">Sentinel is watching this payment</div>
          </div>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            Your bank will check whether this <em>transaction</em> looks normal. Sentinel checks whether the <em>decision</em> behind it was
            manipulated — using the conversation that led here.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
              <div className="label text-[9.5px]">Linked context</div>
              <div className="mt-1 text-[13px]">{analysis.title}</div>
              <div className="font-mono text-[11px] text-fg-dim">{analysis.input.conversation.split("\n").filter(Boolean).length} messages</div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
              <div className="label text-[9.5px]">What the bank sees</div>
              <div className="mt-1 text-[13px]">Valid UPI ID · within limit</div>
              <div className="font-mono text-[11px] text-safe">Transaction rules: PASS</div>
            </div>
          </div>
          <div className="mt-auto rounded-md border border-dashed border-white/[0.08] p-3 font-mono text-[11px] leading-relaxed text-fg-dim">
            Gate policy: payments with contextual risk ≥ 55 are held for verification. Edit the recipient or amount to see how the gate responds.
          </div>
        </div>
      </div>

      {/* Outcomes */}
      <AnimatePresence>
        {(phase === "intercepted" || phase === "verify" || phase === "verified" || phase === "proceeded" || phase === "cleared") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex items-start justify-center overflow-hidden rounded-lg bg-ink-950/90 p-0 backdrop-blur-sm"
          >
            {phase === "cleared" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-md p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-safe" />
                <div className="mt-3 text-lg font-semibold">No manipulation detected</div>
                <p className="mt-1 text-sm text-fg-muted">
                  Context risk {a.riskScore}/100. In production this payment would continue to your bank. Here, nothing is sent.
                </p>
                <button className="btn-ghost mt-5" onClick={() => setPhase("form")}>
                  Back to payment
                </button>
              </motion.div>
            )}

            {phase === "intercepted" && (
              <motion.div
                initial={{ scale: 1.03, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="relative h-full w-full overflow-y-auto rounded-lg border border-risk/40 bg-gradient-to-b from-risk/[0.12] via-ink-900 to-ink-900"
                style={{ boxShadow: "inset 0 0 120px -40px rgba(255,74,61,0.6)" }}
              >
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-lg border-2 border-risk"
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: [0.9, 0.15, 0.6, 0.1] }}
                  transition={{ duration: 1.6 }}
                />
                <div className="relative grid gap-6 p-5 md:p-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-risk-soft">
                      <Hand className="h-4 w-4" /> Payment paused by Sentinel
                    </div>
                    <motion.h2
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="mt-3 text-3xl font-semibold uppercase leading-[1.05] tracking-tight md:text-[44px]"
                    >
                      Pause before
                      <br />
                      you pay.
                    </motion.h2>
                    <div className={cn("mt-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", tone.text)}>
                      <ShieldAlert className="h-4 w-4" /> High contextual risk detected · {a.riskScore}/100
                    </div>
                    <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-fg-muted">
                      {formatINR(payment.amount)} to <span className="font-mono text-fg">{payment.recipient}</span> looks like an ordinary
                      transfer. The conversation behind it does not.
                    </p>
                    <div className="mt-5 grid max-w-lg gap-3">
                      <RiskBar label="Transaction Risk" value={a.transactionRisk} delay={0.15} />
                      <RiskBar label="Recipient Risk" value={a.recipientRisk} delay={0.25} />
                      <RiskBar label="Context Risk" value={a.contextRisk} delay={0.35} />
                      <RiskBar label="Pressure Risk" value={a.pressureRisk} delay={0.45} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-white/[0.08] bg-ink-850/90 p-4">
                      <div className="label mb-2.5 text-safe">Verify first</div>
                      <ul className="flex flex-col gap-2 text-[13px]">
                        {[
                          "Verify through the institution's official website or app",
                          "Do not use contact information from the message",
                          "Do not share OTP, PIN or CVV",
                          "Ask a trusted person to review the request",
                          "Wait before transferring — real deadlines survive a pause",
                        ].map((t, i) => (
                          <motion.li key={t} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }} className="flex gap-2">
                            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
                            <span className="text-fg/90">{t}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-safe h-11 flex-1" onClick={() => setPhase("verify")}>
                        <ShieldCheck className="h-4 w-4" /> Verify safely
                      </button>
                      <button className="btn-ghost h-11 flex-1" onClick={() => setConfirmOpen(true)}>
                        Proceed anyway
                      </button>
                    </div>
                    <button className="btn-ghost h-10 w-full border-info/25 text-info hover:border-info/50" onClick={ask}>
                      <Users className="h-4 w-4" /> Ask your Sentinel Circle
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "verify" && (
              <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full w-full overflow-y-auto rounded-lg border border-safe/30 bg-ink-900 p-5 md:p-8">
                <div className="label text-safe">Verification mode · payment on hold</div>
                <h3 className="mt-2 text-2xl font-semibold">Check the story, not just the payment.</h3>
                <p className="mt-1 max-w-xl text-sm text-fg-muted">Complete any of these independently. Sentinel keeps {formatINR(payment.amount)} on hold until you decide.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {VERIFY_STEPS.map((s, i) => (
                    <button
                      key={s.title}
                      onClick={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                      className={cn("panel flex flex-col items-start gap-2 p-4 text-left transition", checks[i] ? "border-safe/50 bg-safe/[0.06]" : "hover:border-white/20")}
                    >
                      <div className="flex w-full items-center justify-between">
                        <s.icon className={cn("h-5 w-5", checks[i] ? "text-safe" : "text-fg-muted")} />
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", checks[i] ? "border-safe bg-safe text-ink-950" : "border-white/20")}>
                          {checks[i] && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                      </div>
                      <div className="text-[13.5px] font-medium">{s.title}</div>
                      <div className="text-[12.5px] leading-snug text-fg-muted">{s.detail}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button className="btn-safe" onClick={() => setPhase("verified")}>
                    <Ban className="h-4 w-4" /> Cancel payment & block {payment.recipient.split("@")[0] || "recipient"}
                  </button>
                  <button className="btn-ghost" onClick={() => setPhase("intercepted")}>
                    Back
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "verified" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-lg border-safe/40 p-7 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}>
                  <ShieldCheck className="mx-auto h-12 w-12 text-safe" />
                </motion.div>
                <div className="mt-3 text-xl font-semibold">{formatINR(payment.amount)} protected</div>
                <p className="mt-1 text-sm text-fg-muted">Payment cancelled. {payment.recipient} blocked on this account (simulated). If you shared any details, call 1930.</p>
                <button className="btn-ghost mt-5" onClick={() => setPhase("form")}>
                  Reset demo
                </button>
              </motion.div>
            )}

            {phase === "proceeded" && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-raised m-auto max-w-lg p-7 text-center">
                <Lock className="mx-auto h-10 w-10 text-warn" />
                <div className="mt-3 text-lg font-semibold">Simulated payment recorded</div>
                <p className="mt-1 text-sm text-fg-muted">
                  No money moved — this is a demo environment. In production, Sentinel would apply a cooling-off delay and notify your Sentinel Circle.
                </p>
                <button className="btn-ghost mt-5" onClick={() => setPhase("form")}>
                  Reset demo
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proceed anyway confirmation */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ y: 16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, opacity: 0 }}
              className="panel-raised relative w-full max-w-lg border-risk/30 p-6"
            >
              <button aria-label="Close" className="absolute right-4 top-4 text-fg-dim hover:text-fg" onClick={() => setConfirmOpen(false)}>
                <X className="h-4 w-4" />
              </button>
              <div className="label text-risk-soft">Are you sure?</div>
              <h3 id="confirm-title" className="mt-1 text-xl font-semibold">
                You're about to send {formatINR(payment.amount)} despite {top.length} risk signals
              </h3>
              <ul className="mt-4 flex flex-col gap-2">
                {top.map((s) => {
                  const Icon = SIGNAL_ICONS[s.id];
                  return (
                    <li key={s.id} className="flex items-start gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-risk-soft" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">
                          {s.label} <span className="font-mono text-[11px] text-fg-dim">· {s.confidence}%</span>
                        </div>
                        {s.evidence[0] && <div className="truncate font-mono text-[11.5px] text-fg-muted">“{s.evidence[0].text}”</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-muted">
                <input type="checkbox" className="mt-0.5 accent-[#ff4a3d]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I understand UPI transfers are instant and usually cannot be reversed.
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
