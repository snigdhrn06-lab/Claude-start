"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, BadgePercent, HeartPulse, Landmark, RotateCcw } from "lucide-react";
import { formatINR } from "@/lib/engine/parse";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import { cn } from "./ui";

const ICON = { kyc: Landmark, investment: BadgePercent, refund: RotateCcw, medical: HeartPulse } as Record<string, typeof Landmark>;

export function DemoScenarioSelector({
  onSelect,
  selectedId,
  layout = "grid",
  filter,
}: {
  onSelect: (s: Scenario) => void;
  selectedId?: string;
  layout?: "grid" | "stack";
  filter?: Scenario["nature"];
}) {
  const list = filter ? SCENARIOS.filter((s) => s.nature === filter) : SCENARIOS;
  return (
    <div className={cn("grid gap-3", layout === "grid" ? (list.length > 3 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3") : "grid-cols-1")}>
      {list.map((s, i) => {
        const Icon = ICON[s.id] ?? Landmark;
        const sel = selectedId === s.id;
        return (
          <motion.button
            key={s.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => onSelect(s)}
            aria-pressed={sel}
            className={cn("panel group flex flex-col gap-3 p-4 text-left transition-colors", sel ? (s.nature === "scam" ? "border-risk/50 bg-risk/[0.05]" : "border-safe/50 bg-safe/[0.05]") : "hover:border-white/[0.16]")}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                <Icon className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
              </div>
              <span className={cn("chip", s.nature === "scam" ? "border-risk/25 text-risk-soft" : "border-safe/25 text-safe")}>{s.nature === "scam" ? "Synthetic scam" : "Synthetic genuine"}</span>
              <ArrowUpRight className="h-4 w-4 text-fg-faint transition group-hover:text-fg-muted" />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold">{s.title}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-fg-dim">{s.description}</div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] pt-3 font-mono text-[11px]">
              <span className="text-fg-dim">{s.channel}</span>
              <span className="num text-fg">{formatINR(s.payment.amount)}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
