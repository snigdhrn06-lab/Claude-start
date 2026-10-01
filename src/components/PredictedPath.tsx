"use client";

import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import { useMemo } from "react";
import type { PathNode } from "@/lib/types";
import { cn } from "./ui";

const TONE = {
  neutral: { c: "#c9ced6", bg: "bg-ink-800" },
  risk: { c: "#ff8c42", bg: "bg-warn/[0.06]" },
  critical: { c: "#ff4a3d", bg: "bg-risk/[0.07]" },
  safe: { c: "#33d69f", bg: "bg-safe/[0.06]" },
};

function orderOf(root: PathNode) {
  // Depth-first along the risk branch first so escalation reads top to bottom.
  const order = new Map<string, number>();
  let i = 0;
  const walk = (n: PathNode) => {
    order.set(n.id, i++);
    n.children?.forEach(walk);
  };
  walk(root);
  return order;
}

function Box({ node, delay, play }: { node: PathNode; delay: number; play: boolean }) {
  const t = TONE[node.tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ delay: play ? delay : 0, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className={cn("relative w-full rounded-lg border px-3.5 py-3", t.bg)}
      style={{ borderColor: `${t.c}40`, boxShadow: node.tone === "critical" ? `0 0 28px -14px ${t.c}` : undefined }}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.c, boxShadow: `0 0 8px ${t.c}` }} />
        <span className="text-[12.5px] font-semibold uppercase leading-tight tracking-wide" style={{ color: node.tone === "neutral" ? undefined : t.c }}>
          {node.label}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-fg-muted">{node.description}</p>
    </motion.div>
  );
}

function VLine({ delay, play, color }: { delay: number; play: boolean; color: string }) {
  return (
    <div className="relative mx-auto h-5 w-px bg-white/[0.06]">
      <motion.div
        className="absolute left-0 top-0 w-px"
        style={{ background: color }}
        initial={{ height: 0 }}
        animate={{ height: play ? "100%" : 0 }}
        transition={{ delay: play ? delay : 0, duration: 0.2 }}
      />
    </div>
  );
}

function Branch({ node, order, play, step }: { node: PathNode; order: Map<string, number>; play: boolean; step: number }) {
  const d = (order.get(node.id) ?? 0) * step;
  const kids = node.children ?? [];
  return (
    <div className="flex w-full flex-col items-center">
      <Box node={node} delay={d} play={play} />
      {kids.length === 1 && (
        <>
          <VLine delay={d + step * 0.6} play={play} color={TONE[kids[0].tone].c} />
          <Branch node={kids[0]} order={order} play={play} step={step} />
        </>
      )}
      {kids.length > 1 && (
        <>
          <VLine delay={d + step * 0.6} play={play} color="#5b6371" />
          <div className="relative grid w-full gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="pointer-events-none absolute -top-px left-[25%] right-[25%] hidden h-px bg-white/[0.08] sm:block" />
            {kids.map((k) => (
              <div key={k.id} className="flex flex-col items-center">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: TONE[k.tone].c }}>
                  {k.tone === "safe" ? "If you verify" : "If you pay"}
                </div>
                <Branch node={k} order={order} play={play} step={step} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PredictedPath({ root, play = true, step = 0.32 }: { root: PathNode; play?: boolean; step?: number }) {
  const order = useMemo(() => orderOf(root), [root]);
  return (
    <div className="panel relative overflow-hidden p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded border border-caution/30 bg-caution/[0.07] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-caution">
          <FlaskConical className="h-3.5 w-3.5" />
          Hypothetical risk scenario
        </div>
        <p className="max-w-md text-[12px] leading-snug text-fg-dim">
          How this pattern commonly escalates. Sentinel does not know what this sender will do — this shows why the first payment is rarely the last.
        </p>
      </div>
      <div className="mx-auto max-w-3xl">
        <Branch node={root} order={order} play={play} step={step} />
      </div>
    </div>
  );
}
