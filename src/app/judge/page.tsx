"use client";

/**
 * Judge Mode — presentation orchestration only.
 *
 * Every number on these screens comes from analyzeLocal() on synthetic
 * scenario inputs, the same deterministic pipeline used everywhere else; this
 * file only sequences what is shown. Nothing here feeds back into scoring.
 */
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleSlash, FastForward, LogOut, Pause, Play, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DecisionWorkflow, ScoreHero } from "@/components/AnalysisView";
import { AttackChain } from "@/components/AttackChain";
import { ConversationView } from "@/components/ConversationView";
import { CounterfactualLab } from "@/components/CounterfactualLab";
import { DemoScenarioSelector } from "@/components/DemoScenarioSelector";
import { SentinelMark } from "@/components/icons";
import { PaymentFirewall } from "@/components/PaymentFirewall";
import { RiskSignalCard } from "@/components/RiskSignalCard";
import { Kbd, bandTone, cn } from "@/components/ui";
import { analyzeLocal } from "@/lib/engine/analyze";
import { SIGNALS } from "@/lib/engine/catalog";
import { applyEdits, compareAnalyses } from "@/lib/engine/counterfactual";
import { ACTION_LABEL } from "@/lib/engine/decision";
import { formatINR, parseConversation } from "@/lib/engine/parse";
import { SCENARIOS, getScenario, scenarioInput } from "@/lib/scenarios";
import { useSentinel } from "@/lib/store";
import type { SignalId } from "@/lib/types";

const STEPS = [
  { id: "intro", label: "Setup", demo: "", caption: "Three demonstrations, all on synthetic data, all computed live." },
  { id: "a-story", label: "A · Story", demo: "A", caption: "Demo A — a scam conversation that ends in a normal-looking payment." },
  { id: "a-analysis", label: "A · Evidence", demo: "A", caption: "Each signal is tied to the exact words — and to who said them." },
  { id: "a-chain", label: "A · Chain", demo: "A", caption: "Observed stages link to quotes; the impact stage is labelled hypothetical." },
  { id: "a-check", label: "A · Check", demo: "A", caption: "The user presses pay. A simulated decision check responds." },
  { id: "b-legit", label: "B · Legit", demo: "B", caption: "Demo B — urgent, unusually large, and genuine. Sentinel should not panic." },
  { id: "c-cf", label: "C · Counterfactual", demo: "C", caption: "Demo C — change one thing and re-run. Which evidence drives the decision?" },
  { id: "close", label: "Close", demo: "", caption: "Banks protect transactions. Sentinel protects financial decisions." },
] as const;
type StepId = (typeof STEPS)[number]["id"];

/** Manipulation markers checked in Demo B, shown as found / not found. */
const MARKERS: SignalId[] = ["authority", "identity_change", "threat", "isolation", "credentials", "reversal", "new_beneficiary", "unofficial_channel"];

export default function JudgePage() {
  const router = useRouter();
  const { addResult } = useSentinel();
  const [scenarioId, setScenarioId] = useState("kyc");
  const scenario = SCENARIOS.find((s) => s.id === scenarioId && s.nature === "scam") ?? SCENARIOS[0];
  const legit = getScenario("medical")!;
  const cfPreset = "new-number";

  const analysis = useMemo(() => analyzeLocal(scenarioInput(scenario), { id: `judge-${scenario.id}` }), [scenario]);
  const legitAnalysis = useMemo(() => analyzeLocal(scenarioInput(legit), { id: "judge-medical" }), [legit]);
  const cf = useMemo(() => {
    const base = scenarioInput(legit, false);
    const p = legit.counterfactuals.find((x) => x.id === cfPreset)!;
    return compareAnalyses(analyzeLocal(base), analyzeLocal(applyEdits(base, p.edits).input));
  }, [legit]);

  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [replay, setReplay] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [chainSel, setChainSel] = useState<string | null>(null);
  const [barVisible, setBarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const id: StepId = STEPS[step].id;
  const messages = useMemo(() => parseConversation(scenario.conversation).filter((m) => m.role !== "reported"), [scenario]);

  const go = useCallback((n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    setStepDone(false);
    setChainSel(null);
  }, []);
  const next = useCallback(() => go(step + 1), [go, step]);
  const back = useCallback(() => go(step - 1), [go, step]);
  const doReplay = useCallback(() => {
    setReplay((r) => r + 1);
    setStepDone(false);
    setChainSel(null);
  }, []);

  // After the demo, the analyses are available in the rest of the product.
  useEffect(() => {
    if (id === "a-analysis") addResult(analysis);
    if (id === "b-legit") addResult(legitAnalysis);
  }, [id, analysis, legitAnalysis, addResult]);

  // Conversation reveal (presentation pacing only; the analysis is already computed).
  useEffect(() => {
    if (id !== "a-story") return;
    setRevealed(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= messages.length) {
        clearInterval(t);
        setStepDone(true);
      }
    }, 480);
    return () => clearInterval(t);
  }, [id, replay, messages.length]);

  useEffect(() => {
    if (!auto || id === "intro" || id === "close") return;
    const dwell: Partial<Record<StepId, number>> = { "a-story": 2400, "a-analysis": 7000, "a-chain": 5200, "a-check": 7000, "b-legit": 8000, "c-cf": 6500 };
    const needsDone = id === "a-story" || id === "a-chain" || id === "c-cf";
    if (needsDone && !stepDone) return;
    const t = setTimeout(next, dwell[id] ?? 5000);
    return () => clearTimeout(t);
  }, [auto, id, stepDone, next, replay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") back();
      else if (e.key.toLowerCase() === "r") doReplay();
      else if (e.key.toLowerCase() === "a") setAuto((a) => !a);
      else if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, doReplay, router]);

  useEffect(() => {
    const show = () => {
      setBarVisible(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setBarVisible(false), 3200);
    };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("keydown", show);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("keydown", show);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const legitIds = new Set(legitAnalysis.signals.map((s) => s.id));

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950">
      <div className="bg-grid pointer-events-none fixed inset-0 opacity-40 mask-radial" />
      <header className="relative z-10 flex items-center gap-4 border-b border-white/[0.06] px-5 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <SentinelMark className="h-5 w-5" />
          <span className="text-[12px] font-semibold tracking-[0.2em]">SENTINEL</span>
        </Link>
        <span className="chip border-risk/30 text-risk-soft">
          <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-risk" /> Judge mode
        </span>
        <div className="hidden flex-1 items-center gap-1 md:flex">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => go(i)} className="group flex flex-1 flex-col gap-1.5" aria-label={`Go to ${s.label}`}>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div className="h-full bg-fg" initial={false} animate={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }} transition={{ duration: 0.4 }} />
              </div>
              <span className={cn("text-left font-mono text-[9.5px] uppercase tracking-wider transition", i === step ? "text-fg" : "text-fg-faint group-hover:text-fg-dim")}>{s.label}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-fg-dim lg:inline">Synthetic data · local engine · no real payments</span>
      </header>

      <div className="relative z-10 px-5 pt-6 md:px-8">
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="flex items-baseline gap-4">
              <span className="num font-mono text-[11px] text-fg-dim">
                {String(step).padStart(2, "0")} / {String(STEPS.length - 1).padStart(2, "0")}
              </span>
              <h1 className="text-lg font-medium tracking-tight text-fg md:text-xl">{STEPS[step].caption}</h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <main className="relative z-10 flex-1 px-5 pb-28 pt-5 md:px-8">
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence mode="wait">
            <motion.div key={`${id}-${replay}-${scenarioId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              {id === "intro" && (
                <div className="mx-auto max-w-4xl py-6 text-center md:py-10">
                  <SentinelMark className="mx-auto h-10 w-10" />
                  <h2 className="mt-6 text-4xl font-semibold uppercase tracking-tight md:text-5xl">Detect manipulation. Don&apos;t punish urgency.</h2>
                  <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                    <strong className="text-fg">A</strong> a scam, from first message to the payment screen · <strong className="text-fg">B</strong> a genuine urgent payment · <strong className="text-fg">C</strong> a controlled counterfactual. Every
                    number is computed live by the deterministic engine — no API key, no scripted outcomes.
                  </p>
                  <div className="mt-10 text-left">
                    <div className="label mb-3">Scam scenario for demo A</div>
                    <DemoScenarioSelector selectedId={scenario.id} onSelect={(s) => setScenarioId(s.id)} filter="scam" />
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <button className="btn-primary h-12 px-7 text-[15px]" onClick={() => go(1)}>
                      Start <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      className="btn-ghost h-12 px-7 text-[15px]"
                      onClick={() => {
                        setAuto(true);
                        go(1);
                      }}
                    >
                      <Play className="h-4 w-4 fill-risk text-risk" /> Auto demo
                    </button>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-4 font-mono text-[10.5px] text-fg-dim">
                    <span><Kbd>→</Kbd> next</span>
                    <span><Kbd>←</Kbd> back</span>
                    <span><Kbd>R</Kbd> replay</span>
                    <span><Kbd>A</Kbd> auto</span>
                    <span><Kbd>Esc</Kbd> exit</span>
                  </div>
                </div>
              )}

              {id === "a-story" && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <ConversationView conversation={scenario.conversation} reveal={revealed} maxHeight={560} />
                  <div className="flex flex-col gap-4">
                    <div className="panel p-5">
                      <div className="label mb-3">What the payment looks like on its own</div>
                      <dl className="flex flex-col divide-y divide-white/[0.05]">
                        {[
                          ["Recipient", scenario.payment.recipient],
                          ["Amount", formatINR(scenario.payment.amount)],
                          ["Method", scenario.payment.method],
                          ["Authorised by", "The account holder, on their own device"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4 py-2 text-[13px]">
                            <dt className="text-fg-dim">{k}</dt>
                            <dd className="truncate text-right font-mono">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 text-[12px] leading-snug text-fg-dim">Illustrative: nothing in these fields alone reveals the manipulation. Sentinel has no view of any bank&apos;s actual checks.</p>
                    </div>
                    <AnimatePresence>
                      {stepDone && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel-raised p-5">
                          <p className="text-xl font-semibold leading-snug">
                            The transaction looks ordinary.
                            <br />
                            <span className="text-risk">The conversation behind it isn&apos;t.</span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {id === "a-analysis" && (
                <div className="flex flex-col gap-5">
                  <ScoreHero result={analysis} />
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {analysis.signals
                      .filter((s) => s.basis === "observed")
                      .slice(0, 4)
                      .map((s, i) => (
                        <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.25 }}>
                          <RiskSignalCard signal={s} index={i} />
                        </motion.div>
                      ))}
                  </div>
                </div>
              )}

              {id === "a-chain" && (
                <AttackChain
                  nodes={analysis.attackChain}
                  stagger={420}
                  selectedId={chainSel}
                  onSelect={(n) => setChainSel(n?.id ?? null)}
                  onRevealed={() =>
                    setTimeout(() => {
                      setChainSel(analysis.attackChain.find((n) => n.stage === "ask")?.id ?? null);
                      setStepDone(true);
                    }, 400)
                  }
                />
              )}

              {id === "a-check" && <PaymentFirewall analysis={analysis} autoPay />}

              {id === "b-legit" && (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="flex flex-col gap-4">
                    <ConversationView conversation={legit.conversation} maxHeight={300} highlights={legitAnalysis.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence)} />
                    <div className="panel p-4 text-[13px]">
                      <div className="label mb-2">Payment</div>
                      {formatINR(legit.payment.amount)} to <span className="font-mono">{legit.payment.recipient}</span> · {legit.payment.reason}
                      <p className="mt-1 text-[12px] text-caution">Recipient history comes from the synthetic demo profile.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <ScoreHero result={legitAnalysis} />
                    <div className="panel grid gap-4 p-4 sm:grid-cols-2">
                      <div>
                        <div className="label mb-2 text-warn">Present — worth noting</div>
                        <ul className="flex flex-col gap-1.5 text-[13px]">
                          {legitAnalysis.signals
                            .filter((s) => !s.mitigating)
                            .map((s) => (
                              <li key={s.id} className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                                {s.label}
                              </li>
                            ))}
                          {legitAnalysis.signals
                            .filter((s) => s.mitigating)
                            .map((s) => (
                              <li key={s.id} className="flex gap-2 text-safe">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {s.label}
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <div className="label mb-2 text-safe">Manipulation markers — not found</div>
                        <ul className="flex flex-col gap-1.5 text-[13px] text-fg-muted">
                          {MARKERS.filter((m) => !legitIds.has(m)).map((m) => (
                            <li key={m} className="flex gap-2">
                              <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-dim" />
                              {SIGNALS[m].label}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[12px] leading-snug text-fg-dim sm:col-span-2">
                        Urgency and a large amount are recorded, but without an identity claim, threat, secrecy, credential request or unfamiliar destination they do not form a manipulation pattern. The remaining uncertainty is
                        stated, not hidden: {legitAnalysis.decision.uncertainties[0]}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {id === "c-cf" && <CounterfactualLab scenario={legit} autoplayPresetId={cfPreset} onDone={() => setStepDone(true)} />}

              {id === "close" && (
                <div className="mx-auto max-w-5xl py-8 text-center md:py-12">
                  <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold uppercase leading-[1.05] tracking-tight md:text-[52px]">
                    Banks protect transactions.
                    <br />
                    <span className="text-risk">Sentinel protects financial decisions.</span>
                  </motion.h2>
                  <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
                    {[
                      { k: "A · Scam", v: `${analysis.riskScore}/100`, s: `${ACTION_LABEL[analysis.decision.action]} · ${analysis.signals.filter((x) => x.basis === "observed" && !x.mitigating).length} observed, quoted signals`, tone: bandTone(analysis.band).text },
                      { k: "B · Genuine urgent payment", v: `${legitAnalysis.riskScore}/100`, s: `${ACTION_LABEL[legitAnalysis.decision.action]} — urgency alone is not treated as fraud`, tone: bandTone(legitAnalysis.band).text },
                      { k: "C · Counterfactual", v: `${cf.scoreBefore} → ${cf.scoreAfter}`, s: `Same request from a “new number”: ${ACTION_LABEL[cf.actionAfter].toLowerCase()}`, tone: "text-fg" },
                    ].map((c, i) => (
                      <motion.div key={c.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="panel p-5">
                        <div className="label">{c.k}</div>
                        <div className={cn("num mt-2 text-2xl font-semibold", c.tone)}>{c.v}</div>
                        <div className="mt-1 text-[12.5px] text-fg-muted">{c.s}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mx-auto mt-6 max-w-2xl text-left">
                    <DecisionWorkflow result={analysis} />
                  </div>
                  <p className="mx-auto mt-6 max-w-2xl text-[12.5px] text-fg-dim">
                    Scores are a versioned risk ranking, not probabilities of fraud. Measured on a 124-case synthetic benchmark — see the Evaluation page for results and limitations.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setAuto(false);
                        go(0);
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Run again
                    </button>
                    <Link href="/evaluation" className="btn-ghost">
                      <ShieldCheck className="h-4 w-4" /> Evaluation results
                    </Link>
                    <Link href="/scan" className="btn-primary">
                      Try your own message <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <motion.div
        initial={false}
        animate={{ opacity: barVisible ? 1 : 0.18, y: 0 }}
        whileHover={{ opacity: 1 }}
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-ink-850/90 p-1.5 shadow-2xl backdrop-blur-md"
        role="toolbar"
        aria-label="Presenter controls"
      >
        <BarBtn onClick={back} disabled={step === 0} label="Back" icon={<ChevronLeft className="h-4 w-4" />} />
        <BarBtn onClick={doReplay} label="Replay" icon={<RotateCcw className="h-3.5 w-3.5" />} />
        <BarBtn
          onClick={() => {
            if (!auto && step === 0) go(1);
            setAuto((a) => !a);
          }}
          label={auto ? "Pause" : "Auto"}
          active={auto}
          icon={auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        />
        <BarBtn onClick={() => go(STEPS.length - 1)} label="Skip" icon={<FastForward className="h-3.5 w-3.5" />} />
        <button onClick={next} disabled={step === STEPS.length - 1} className="btn-primary h-9 px-4 py-0 text-[13px]">
          Next <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <BarBtn onClick={() => router.push("/")} label="Exit" icon={<LogOut className="h-3.5 w-3.5" />} />
      </motion.div>
    </div>
  );
}

function BarBtn({ onClick, label, icon, disabled, active }: { onClick: () => void; label: string; icon: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] uppercase tracking-wider transition active:scale-95 disabled:opacity-30",
        active ? "bg-risk/15 text-risk-soft" : "text-fg-muted hover:bg-white/[0.06] hover:text-fg",
      )}
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
