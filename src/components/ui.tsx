"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Severity } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function riskTone(score: number) {
  if (score >= 80) return { text: "text-risk", bg: "bg-risk", hex: "#ff4a3d", label: "High risk" };
  if (score >= 55) return { text: "text-warn", bg: "bg-warn", hex: "#ff8c42", label: "Elevated" };
  if (score >= 25) return { text: "text-caution", bg: "bg-caution", hex: "#f2c14e", label: "Caution" };
  return { text: "text-safe", bg: "bg-safe", hex: "#33d69f", label: "Low risk" };
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="label mb-2 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-risk" />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-[28px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div className="label">{children}</div>
      {right}
    </div>
  );
}

const SEV: Record<Severity, string> = {
  critical: "border-risk/40 bg-risk/10 text-risk-soft",
  high: "border-warn/35 bg-warn/10 text-warn",
  medium: "border-caution/30 bg-caution/10 text-caution",
  low: "border-white/10 bg-white/5 text-fg-muted",
  info: "border-safe/30 bg-safe/10 text-safe",
};

export function SeverityBadge({ severity, children }: { severity: Severity; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider", SEV[severity])}>
      {children ?? severity}
    </span>
  );
}

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border border-caution/30 bg-caution/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-caution", className)}>
      <span className="h-1 w-1 rounded-full bg-caution" />
      Demo data
    </span>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="panel flex flex-col items-start gap-3 border-risk/25 p-5" role="alert">
      <div className="flex items-center gap-2 text-sm font-medium text-risk-soft">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <p className="text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Client-only time formatting to avoid server/client timezone mismatches. */
export function TimeLabel({ iso, mode = "time" }: { iso: string; mode?: "time" | "datetime" | "relative" }) {
  const mounted = useMounted();
  if (!mounted) return <span className="opacity-0">00:00</span>;
  const d = new Date(iso);
  if (mode === "relative") {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return <span>just now</span>;
    if (s < 3600) return <span>{Math.round(s / 60)}m ago</span>;
    if (s < 86400) return <span>{Math.round(s / 3600)}h ago</span>;
    return <span>{Math.round(s / 86400)}d ago</span>;
  }
  const t = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (mode === "time") return <span>{t}</span>;
  return <span>{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " · " + t}</span>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-px font-mono text-[10px] text-fg-muted">{children}</kbd>;
}
