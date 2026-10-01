"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DimensionGrid, ScoreHero } from "@/components/AnalysisView";
import { AttackChain } from "@/components/AttackChain";
import { ConversationView } from "@/components/ConversationView";
import { CounterfactualLab } from "@/components/CounterfactualLab";
import { DemoScenarioSelector } from "@/components/DemoScenarioSelector";
import { SentinelMark } from "@/components/icons";
import { PaymentFirewall } from "@/components/PaymentFirewall";
import { PredictedPath } from "@/components/PredictedPath";
import { RiskSignalCard } from "@/components/RiskSignalCard";
import { ScanProgress } from "@/components/ScanProgress";
import { Kbd, cn } from "@/components/ui";
import { analyzeLocal } from "@/lib/engine/analyze";
import { parseConversation, formatINR } from "@/lib/engine/parse";
import { SCENARIOS } from "@/lib/scenarios";
import { useSentinel } from "@/lib/store";

const STEPS = [
  { id: "intro", label: "Setup", caption: "Let's test Sentinel." },
  { id: "conversation", label: "The story", caption: "A realistic scam conversation. Watch what the bank would see." },
  { id: "scan", label: "Scan", caption: "Sentinel reads the story behind the payment." },
  { id: "score", label: "Risk", caption: "Manipulation signals extracted, each tied to evidence." },
  { id: "chain", label: "Attack chain", caption: "How the attack works — reconstructed node by node." },
  { id: "path", label: "What next", caption: "A hypothetical view of how this pattern escalates." },
  { id: "firewall", label: "Firewall", caption: "The user presses pay. Sentinel intervenes." },
  { id: "counterfactual", label: "Counterfactual", caption: "Change one sentence. Watch the risk collapse." },
  { id: "close", label: "Close", caption: "Banks protect transactions. Sentinel protects financial decisions." },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export default function JudgePage() {
  const router = useRouter();
  const { addResult } = useSentinel();
  const [scenarioId, setScenarioId] = useState("kyc");
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const analysis = useMemo(
    () =>
      analyzeLocal(
        { conversation: scenario.conversation, payment: scenario.payment, source: "scenario", scenarioId: scenario.id, title: scenario.short },
        { id: `judge-${scenario.id}` },
      ),
    [scenario],
  );
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [replay, setReplay] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [chainSel, setChainSel] = useState<string | null>(null);
  const [barVisible, setBarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const id: StepId = STEPS[step].id;
  const messages = useMemo(() => parseConversation(scenario.conversation), [scenario]);

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

  // Register the analysis so the rest of the product shows it after the demo.
  useEffect(() => {
    if (step === 2) addResult(analysis);
  }, [step, analysis, addResult]);

  // Conversation typing.
  useEffect(() => {
    if (id !== "conversation") return;
    setRevealed(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= messages.length) {
        clearInterval(t);
        setStepDone(true);
      }
    }, 520);
    return () => clearInterval(t);
  }, [id, replay, messages.length]);

  // Auto demo timing.
  useEffect(() => {
    if (!auto || id === "intro" || id === "close" || id === "scan") return;
    const dwell: Partial<Record<StepId, number>> = {
      conversation: 2600,
      score: 5600,
      chain: 4200,
      path: 5200,
      firewall: 7200,
      counterfactual: 3000,
    };
    const needsDone = id === "conversation" || id === "chain" || id === "counterfactual";
    if (needsDone && !stepDone) return;
    const t = setTimeout(next, dwell[id] ?? 5000);
    return () => clearTimeout(t);
  }, [auto, id, stepDone, next, replay]);

  // Keyboard control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
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

  // Presenter bar fades when idle.
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

  const startAuto = () => {
    setAuto(true);
    go(1);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950">
      <div className="bg-grid pointer-events-none fixed inset-0 opacity-40 mask-radial" />
      {/* Header */}
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
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-fg-dim lg:inline">Synthetic data · no real transactions</span>
      </header>

      {/* Caption */}
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

      {/* Stage */}
      <main className="relative z-10 flex-1 px-5 pb-28 pt-5 md:px-8">
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${id}-${replay}-${scenarioId}`}
              initial={{ opacity: 0, y: 10, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {id === "intro" && (
                <div className="mx-auto max-w-4xl py-6 text-center md:py-10">
                  <SentinelMark className="mx-auto h-10 w-10" />
                  <h2 className="mt-6 text-4xl font-semibold uppercase tracking-tight md:text-6xl">Let&apos;s test Sentinel.</h2>
                  <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
                    A 90-second walkthrough: one realistic scam, from the first message to the moment money would have moved.
                  </p>
                  <div className="mt-10 text-left">
                    <div className="label mb-3">Choose a scenario</div>
                    <DemoScenarioSelector selectedId={scenarioId} onSelect={(s) => setScenarioId(s.id)} />
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <button className="btn-primary h-12 px-7 text-[15px]" onClick={() => go(1)}>
                      Start <ChevronRight className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost h-12 px-7 text-[15px]" onClick={startAuto}>
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

              {id === "conversation" && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <ConversationView conversation={scenario.conversation} reveal={revealed} maxHeight={560} />
                  <div className="flex flex-col gap-4">
                    <div className="panel p-5">
                      <div className="label mb-3">What the bank sees</div>
                      <dl className="flex flex-col divide-y divide-white/[0.05]">
                        {[
                          ["Recipient", scenario.payment.recipient],
                          ["Amount", formatINR(scenario.payment.amount)],
                          ["Method", scenario.payment.method],
                          ["Authentication", "Valid PIN, own device"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4 py-2 text-[13px]">
                            <dt className="text-fg-dim">{k}</dt>
                            <dd className="truncate text-right font-mono">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-safe/25 bg-safe/[0.06] px-3 py-2 font-mono text-[12px] text-safe">
                        <ShieldCheck className="h-4 w-4" /> Transaction rules: PASS
                      </div>
                    </div>
                    <AnimatePresence>
                      {stepDone && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel-raised p-5">
                          <p className="text-xl font-semibold leading-snug">
                            The transaction looks normal.
                            <br />
                            <span className="text-risk">The decision behind it isn&apos;t.</span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {id === "scan" && (
                <div className="mx-auto max-w-4xl pt-4">
                  <ScanProgress result={analysis} input={scenario.conversation} stepMs={380} onComplete={() => go(3)} />
                </div>
              )}

              {id === "score" && (
                <div className="flex flex-col gap-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <ScoreHero result={analysis} />
                    <DimensionGrid result={analysis} baseDelay={0.3} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {analysis.signals.slice(0, 4).map((s, i) => (
                      <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.35 }}>
                        <RiskSignalCard signal={s} index={i} compact />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {id === "chain" && (
                <AttackChain
                  nodes={analysis.attackChain}
                  stagger={480}
                  selectedId={chainSel}
                  onSelect={(n) => setChainSel(n?.id ?? null)}
                  onRevealed={() =>
                    setTimeout(() => {
                      setChainSel(analysis.attackChain.find((n) => n.stage === "urgency")?.id ?? null);
                      setStepDone(true);
                    }, 500)
                  }
                />
              )}

              {id === "path" && <PredictedPath root={analysis.hypotheticalNextSteps} step={0.38} />}

              {id === "firewall" && <PaymentFirewall analysis={analysis} autoPay />}

              {id === "counterfactual" && <CounterfactualLab pivot={scenario.pivot!} autoplay onDone={() => setStepDone(true)} />}

              {id === "close" && (
                <div className="mx-auto max-w-4xl py-8 text-center md:py-14">
                  <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold uppercase leading-[1.05] tracking-tight md:text-[56px]">
                    Banks protect transactions.
                    <br />
                    <span className="text-risk">Sentinel protects financial decisions.</span>
                  </motion.h2>
                  <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
                    {[
                      { k: "Risk detected", v: `${analysis.riskScore}/100`, s: `${analysis.signals.filter((x) => !x.mitigating).length} evidence-linked signals` },
                      { k: "Money protected", v: formatINR(scenario.payment.amount), s: "Held before it left the account" },
                      { k: "Explainable", v: `${analysis.riskScore} → ${analysisCf(scenario)}`, s: "One sentence changed the verdict" },
                    ].map((c, i) => (
                      <motion.div key={c.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="panel p-5">
                        <div className="label">{c.k}</div>
                        <div className="num mt-2 text-2xl font-semibold">{c.v}</div>
                        <div className="mt-1 text-[12.5px] text-fg-muted">{c.s}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-10 flex flex-wrap justify-center gap-3">
                    <button className="btn-ghost" onClick={() => { setAuto(false); go(0); }}>
                      <RotateCcw className="h-4 w-4" /> Run again
                    </button>
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

      {/* Presenter control bar */}
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

function analysisCf(s: (typeof SCENARIOS)[number]) {
  const p = s.pivot!;
  return analyzeLocal({ conversation: `${p.context} ${p.safe}`, source: "text" }).riskScore;
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
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

