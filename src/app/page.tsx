"use client";

import { motion } from "framer-motion";
import { ArrowRight, Brain, GitBranch, Gauge, MessageSquareText, Play, ScanLine, ShieldCheck, Waypoints } from "lucide-react";
import Link from "next/link";
import { HeroField } from "@/components/HeroField";
import { RiskGauge } from "@/components/RiskGauge";
import { useSentinel } from "@/lib/store";

const PIPELINE = [
  { icon: MessageSquareText, label: "Message", sub: "Text, screenshot or payment" },
  { icon: Waypoints, label: "Context", sub: "Who, what, how much, how fast" },
  { icon: Brain, label: "AI Analysis", sub: "Manipulation signals + evidence" },
  { icon: GitBranch, label: "Attack Path", sub: "Reconstructed kill chain" },
  { icon: Gauge, label: "Risk", sub: "Transparent 0–100 score" },
  { icon: ShieldCheck, label: "Safe Decision", sub: "Pause, verify, decide" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function HomePage() {
  const { history } = useSentinel();
  const latest = history[0];
  return (
    <div className="-mx-4 -mt-6 md:-mx-8 md:-mt-8">
      <section className="relative overflow-hidden border-b border-white/[0.06] px-4 pb-16 pt-14 md:px-8 md:pb-20 md:pt-20">
        <HeroField />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="chip mb-6 border-risk/25 text-fg"
            >
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-risk" />
              The AI financial decision firewall
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.05 }}
              className="text-[40px] font-semibold uppercase leading-[0.98] tracking-[-0.02em] sm:text-[56px] xl:text-[68px]"
            >
              Money moves fast.
              <br />
              <span className="text-fg-muted">Sentinel makes</span> <span className="text-risk">you pause.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.15 }}
              className="mt-6 max-w-xl text-[16px] leading-relaxed text-fg-muted"
            >
              An AI financial decision firewall that detects the manipulation behind suspicious payments — before money leaves your account.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link href="/scan" className="btn-primary h-11 px-5">
                <ScanLine className="h-4 w-4" /> Run live scan
              </Link>
              <Link href="/judge" className="btn-ghost h-11 px-5">
                <Play className="h-3.5 w-3.5 fill-risk text-risk" /> Enter judge mode
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
              <span>The transaction isn&apos;t always the problem.</span>
              <span className="text-fg-faint">/</span>
              <span>Check the story.</span>
            </motion.div>
          </div>

          {/* Live specimen */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="panel-raised relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="label">Intercepted · specimen</span>
              <span className="chip border-risk/30 text-risk-soft">Held</span>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
              <RiskGauge value={94} size={132} stroke={7} center={<span className="num text-4xl font-semibold text-risk">94</span>} label="risk" />
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-fg-dim">UPI · verify-kyc@upi</div>
                <div className="num mt-0.5 text-2xl font-semibold">₹18,500</div>
                <div className="mt-1 text-[12.5px] text-fg-muted">Bank check: <span className="text-safe">pass</span> · Sentinel: <span className="text-risk-soft">manipulated decision</span></div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] px-5 py-4">
              <div className="rounded-md border border-white/[0.06] bg-black/30 p-3 text-[13px] leading-relaxed text-fg/85">
                “Your account will be <mark className="evidence">frozen within 30 minutes</mark> if verification is not completed.{" "}
                <mark className="evidence">Transfer ₹18,500 immediately</mark> to verify-kyc@upi.”
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Authority impersonation", "Artificial urgency", "Financial threat", "New beneficiary"].map((s) => (
                  <span key={s} className="chip border-risk/20 text-fg-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-8">
        <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <div className="label mb-2">How Sentinel thinks</div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Don&apos;t just check the payment. Check the story.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-fg-muted">
            Banks protect transactions. Sentinel protects the decision that caused them — reading the conversation that came first.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.06] md:grid-cols-3 xl:grid-cols-6">
          {PIPELINE.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
              className="group relative bg-ink-900 p-5 transition-colors hover:bg-ink-850"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                {i < PIPELINE.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-fg-faint transition group-hover:translate-x-0.5 group-hover:text-fg-dim" />}
              </div>
              <p.icon className={`mt-6 h-5 w-5 ${i === PIPELINE.length - 1 ? "text-safe" : i === 4 ? "text-risk" : "text-fg-muted"}`} strokeWidth={1.6} />
              <div className="mt-3 text-[13px] font-semibold uppercase tracking-wide">{p.label}</div>
              <div className="mt-1 text-[12px] leading-snug text-fg-dim">{p.sub}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { k: "What banks see", v: "A valid UPI ID, an amount under the limit, an authenticated user.", tone: "text-fg-muted" },
            { k: "What actually happened", v: "A fake KYC cell manufactured a 30-minute deadline and a threat to freeze the account.", tone: "text-fg" },
            { k: "What Sentinel does", v: "Holds the payment, shows the evidence, and routes the decision through verification.", tone: "text-safe" },
          ].map((c) => (
            <div key={c.k} className="panel p-5">
              <div className="label mb-2">{c.k}</div>
              <p className={`text-[14px] leading-relaxed ${c.tone}`}>{c.v}</p>
            </div>
          ))}
        </div>

        {latest && (
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 md:flex-row md:items-center">
            <p className="max-w-xl text-sm text-fg-muted">
              Synthetic demo environment. No real transactions are executed, and Sentinel never asks for passwords, OTPs, PINs or CVVs.
            </p>
            <Link href="/history" className="btn-ghost">
              View scan history <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
