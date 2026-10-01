"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import type { RiskSignal } from "@/lib/types";
import { SIGNAL_ICONS } from "./icons";
import { SeverityBadge, cn } from "./ui";

export function RiskSignalCard({
  signal,
  active,
  lit = true,
  onClick,
  index = 0,
  compact,
}: {
  signal: RiskSignal;
  active?: boolean;
  lit?: boolean;
  onClick?: () => void;
  index?: number;
  compact?: boolean;
}) {
  const Icon = SIGNAL_ICONS[signal.id];
  const mitigating = !!signal.mitigating;
  const accent = mitigating ? "#33d69f" : signal.severity === "critical" ? "#ff4a3d" : signal.severity === "high" ? "#ff8c42" : "#f2c14e";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: lit ? 1 : 0.28, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "panel group relative w-full overflow-hidden p-4 text-left transition-colors",
        active ? "border-white/25 bg-ink-750" : "hover:border-white/[0.14]",
      )}
      style={active ? { boxShadow: `0 0 0 1px ${accent}55, 0 0 32px -8px ${accent}66` } : undefined}
      aria-pressed={active}
    >
      <span className="absolute left-0 top-0 h-full w-[2px]" style={{ background: lit ? accent : "transparent", boxShadow: lit ? `0 0 12px ${accent}` : undefined }} />
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `${accent}40`, background: `${accent}14`, color: accent }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold uppercase tracking-wide">{signal.label}</span>
            <SeverityBadge severity={signal.severity}>{mitigating ? "mitigating" : signal.severity}</SeverityBadge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: accent }}
                initial={{ width: 0 }}
                animate={{ width: lit ? `${signal.confidence}%` : 0 }}
                transition={{ delay: 0.15 + index * 0.06, duration: 0.7 }}
              />
            </div>
            <span className="num font-mono text-[11px] text-fg-muted">{signal.confidence}% confidence</span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-fg-muted">{signal.explanation}</p>
          {!compact && signal.evidence[0] && (
            <div className="mt-2.5 flex gap-2 rounded border border-white/[0.05] bg-black/20 px-2.5 py-2">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-fg-dim" />
              <p className="line-clamp-2 font-mono text-[11.5px] leading-relaxed text-fg/80">{signal.evidence[0].text}</p>
            </div>
          )}
          {!compact && signal.evidence.length > 1 && (
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim">+{signal.evidence.length - 1} more excerpt{signal.evidence.length > 2 ? "s" : ""}</div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
