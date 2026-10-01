"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock3,
  FileSearch,
  GitBranch,
  Home,
  LayoutDashboard,
  Menu,
  Play,
  Radar,
  ScanLine,
  ShieldHalf,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSentinel } from "@/lib/store";
import { SentinelMark } from "./icons";
import { cn } from "./ui";

const NAV = [
  {
    group: "Decide",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/scan", label: "Live Scan", icon: ScanLine },
      { href: "/analysis", label: "Analysis Result", icon: Radar },
      { href: "/attack-chain", label: "Attack Chain", icon: GitBranch },
      { href: "/firewall", label: "Payment Firewall", icon: ShieldHalf },
      { href: "/counterfactual", label: "Counterfactual Lab", icon: SlidersHorizontal },
    ],
  },
  {
    group: "Recover & Protect",
    items: [
      { href: "/autopsy", label: "Money Autopsy", icon: FileSearch },
      { href: "/circle", label: "Sentinel Circle", icon: Users },
      { href: "/history", label: "Scan History", icon: Clock3 },
      { href: "/threats", label: "Threat Center", icon: LayoutDashboard },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items);

function EngineChip({ compact = false }: { compact?: boolean }) {
  const { aiStatus } = useSentinel();
  const on = aiStatus.ai;
  return (
    <div
      className="chip whitespace-nowrap"
      title={on ? `LLM perception via ${aiStatus.model}; deterministic scoring` : "Deterministic local engine — no API key configured"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", !aiStatus.checked ? "bg-fg-dim" : on ? "bg-info animate-pulseDot" : "bg-safe")} />
      {!aiStatus.checked ? "Engine…" : on ? (compact ? "AI" : `AI · ${aiStatus.model}`) : compact ? "Local" : "Local engine"}
    </div>
  );
}

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-6">
      {NAV.map((g) => (
        <div key={g.group}>
          {!collapsed && <div className="label mb-2 px-3 text-[10px]">{g.group}</div>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                      collapsed && "justify-center px-0",
                      active ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:bg-white/[0.03] hover:text-fg",
                    )}
                  >
                    {active && <motion.span layoutId="nav-active" className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[2px] rounded-full bg-risk" />}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-fg" : "text-fg-dim group-hover:text-fg-muted")} strokeWidth={1.75} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function JudgeButton({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/judge"
      title="Enter Judge Mode"
      className={cn(
        "group relative flex items-center gap-2.5 overflow-hidden rounded-md border border-risk/30 bg-risk/[0.08] px-3 py-2.5 text-[13px] font-medium text-fg transition hover:border-risk/60 hover:bg-risk/[0.14]",
        collapsed && "justify-center px-0",
      )}
    >
      <Play className="h-3.5 w-3.5 fill-risk text-risk" />
      {!collapsed && (
        <>
          <span>Judge Mode</span>
          <span className="ml-auto font-mono text-[10px] text-fg-dim">90s</span>
        </>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  if (pathname.startsWith("/judge")) return <>{children}</>;
  const current = ALL.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — full on lg, icon rail on md */}
      <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/80 px-2 py-4 backdrop-blur md:flex lg:w-[236px] lg:px-3">
        <Link href="/" className="mb-7 flex items-center gap-2.5 px-2 lg:px-3">
          <SentinelMark className="h-6 w-6 text-fg" />
          <div className="hidden lg:block">
            <div className="text-[13px] font-semibold tracking-[0.18em]">SENTINEL</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-fg-dim">Decision firewall</div>
          </div>
        </Link>
        <div className="hidden flex-1 flex-col lg:flex">
          <NavLinks />
        </div>
        <div className="flex flex-1 flex-col lg:hidden">
          <NavLinks collapsed />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="hidden lg:block">
            <JudgeButton />
          </div>
          <div className="lg:hidden">
            <JudgeButton collapsed />
          </div>
          <p className="hidden px-1 font-mono text-[10px] leading-relaxed text-fg-dim lg:block">
            Demo environment — no real transactions are executed.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute left-0 top-0 flex h-full w-[264px] flex-col gap-4 border-r border-white/10 bg-ink-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SentinelMark className="h-5 w-5" />
                  <span className="text-[13px] font-semibold tracking-[0.18em]">SENTINEL</span>
                </div>
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded p-1 text-fg-muted hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
              <JudgeButton />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-md md:px-6">
          <button aria-label="Open menu" className="rounded p-1 text-fg-muted hover:text-fg md:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
            <span className="hidden sm:inline">Sentinel</span>
            <span className="hidden sm:inline text-fg-faint">/</span>
            <span className="truncate text-fg-muted">{current?.label ?? "Sentinel"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-fg-dim xl:inline">Synthetic demo · no real money moves</span>
            <EngineChip />
          </div>
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
