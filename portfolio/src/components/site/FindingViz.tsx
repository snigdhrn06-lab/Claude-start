"use client";
/**
 * Minimal visual for a reported research figure, derived ONLY from the figure itself:
 *  - "6.25×" → two bars in a 6.25 : 1 ratio
 *  - "85%"   → a split bar, 85 / 15
 * Anything else renders nothing. No other data is implied.
 */
import { motion } from "framer-motion";

export function FindingViz({ value }: { value: string }) {
  const ratio = value.match(/^\s*([\d.]+)\s*[×x]\s*$/i);
  const pct = value.match(/^\s*([\d.]+)\s*%\s*$/);
  if (ratio) {
    const r = Number(ratio[1]);
    if (!Number.isFinite(r) || r <= 1 || r > 100) return null;
    return (
      <div className="mt-4 space-y-2" aria-hidden>
        <Bar width={100} label={`${ratio[1]}×`} strong />
        <Bar width={100 / r} label="1×" />
      </div>
    );
  }
  if (pct) {
    const p = Number(pct[1]);
    if (!Number.isFinite(p) || p < 0 || p > 100) return null;
    return (
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line/10" aria-hidden>
        <motion.span className="block h-full bg-accent" initial={{ width: 0 }} whileInView={{ width: `${p}%` }} viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    );
  }
  return null;
}

function Bar({ width, label, strong }: { width: number; label: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/[0.06]">
        <motion.span
          className={`block h-full rounded-full ${strong ? "bg-accent" : "bg-fg/50"}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-12 text-right font-mono text-[11px] text-muted">{label}</span>
    </div>
  );
}
