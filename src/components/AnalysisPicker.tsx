"use client";

import { ChevronDown } from "lucide-react";
import { useSentinel } from "@/lib/store";
import { cn, riskTone } from "./ui";

/** Compact selector for which analysis the page is showing. */
export function AnalysisPicker() {
  const { history, current, setCurrent } = useSentinel();
  const tone = riskTone(current.riskScore);
  return (
    <label className="relative flex items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.02] py-1.5 pl-3 pr-8 text-[13px] transition hover:border-white/20">
      <span className={cn("num font-mono text-[12px] font-semibold", tone.text)}>{current.riskScore}</span>
      <span className="max-w-[200px] truncate text-fg">{current.title}</span>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-fg-dim" />
      <select
        aria-label="Choose analysis"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={current.id}
        onChange={(e) => setCurrent(e.target.value)}
      >
        {history.map((h) => (
          <option key={h.id} value={h.id}>
            {h.riskScore} · {h.title}
          </option>
        ))}
      </select>
    </label>
  );
}
