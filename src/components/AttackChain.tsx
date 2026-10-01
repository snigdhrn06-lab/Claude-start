"use client";

import { AnimatePresence, motion } from "framer-motion";
import { IndianRupee, MousePointerClick, Quote, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import type { AttackNode, Evidence } from "@/lib/types";
import { SIGNAL_ICONS } from "./icons";
import { cn } from "./ui";

const STAGE_CODE: Record<AttackNode["stage"], string> = {
  actor: "Actor",
  pretext: "Pretext",
  urgency: "Urgency",
  leverage: "Leverage",
  ask: "Ask",
  destination: "Destination",
  impact: "Impact",
};

function nodeColor(node: AttackNode, i: number, n: number) {
  if (node.stage === "impact") return "#ff4a3d";
  if (node.stage === "actor") return "#c9ced6";
  const t = i / Math.max(1, n - 1);
  return t < 0.45 ? "#ff8c42" : t < 0.75 ? "#ff6b4a" : "#ff4a3d";
}

function NodeIcon({ node }: { node: AttackNode }) {
  if (node.stage === "actor") return <UserX className="h-4 w-4" strokeWidth={1.75} />;
  if (node.stage === "impact") return <IndianRupee className="h-4 w-4" strokeWidth={2} />;
  const Icon = SIGNAL_ICONS[node.signalIds[0]];
  return Icon ? <Icon className="h-4 w-4" strokeWidth={1.75} /> : null;
}

export function ThreatNode({
  node,
  index,
  total,
  visible,
  selected,
  onClick,
}: {
  node: AttackNode;
  index: number;
  total: number;
  visible: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const color = nodeColor(node, index, total);
  const impact = node.stage === "impact";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={false}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      whileHover={visible ? { y: -3 } : undefined}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative z-10 flex w-full flex-col items-start rounded-lg border px-3.5 py-3 text-left transition-colors lg:h-full lg:min-h-[148px]",
        selected ? "bg-ink-700" : "bg-ink-800/90 hover:bg-ink-750",
        impact && "bg-risk/[0.09]",
      )}
      style={{
        borderColor: selected ? color : `${color}${impact ? "80" : "33"}`,
        boxShadow: selected ? `0 0 0 1px ${color}, 0 0 36px -6px ${color}88` : impact ? `0 0 40px -12px ${color}` : undefined,
      }}
      aria-pressed={selected}
    >
      <div className="flex w-full items-center justify-between">
        <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-fg-dim">
          {String(index + 1).padStart(2, "0")} {STAGE_CODE[node.stage]}
        </span>
        {visible && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          </span>
        )}
      </div>
      <div
        className="mt-3 flex h-8 w-8 items-center justify-center rounded-md border transition-shadow group-hover:shadow-[0_0_18px_-2px_currentColor]"
        style={{ borderColor: `${color}55`, background: `${color}18`, color }}
      >
        <NodeIcon node={node} />
      </div>
      <div className={cn("mt-2.5 text-[12.5px] font-semibold uppercase leading-tight tracking-wide", impact ? "text-risk-soft" : "text-fg")}>
        {node.label}
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-dim">{node.sublabel}</div>
    </motion.button>
  );
}

function Connector({ visible, color, vertical }: { visible: boolean; color: string; vertical?: boolean }) {
  return (
    <div className={cn("relative", vertical ? "mx-auto h-6 w-px" : "h-px w-full")}>
      <div className={cn("absolute bg-white/[0.07]", vertical ? "inset-x-0 h-full" : "inset-y-0 w-full")} />
      <motion.div
        className={cn("absolute left-0 top-0", vertical ? "w-px" : "h-px")}
        style={{ background: `linear-gradient(${vertical ? "180deg" : "90deg"}, ${color}55, ${color})`, boxShadow: `0 0 8px ${color}` }}
        initial={false}
        animate={vertical ? { height: visible ? "100%" : "0%", width: 1 } : { width: visible ? "100%" : "0%", height: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
      {visible && (
        <motion.span
          className={cn("absolute h-1 w-1 rounded-full", vertical ? "-left-[1.5px]" : "-top-[1.5px]")}
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          initial={vertical ? { top: "0%" } : { left: "0%" }}
          animate={vertical ? { top: "100%" } : { left: "100%" }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: 0.4 }}
        />
      )}
    </div>
  );
}

function EvidenceBlock({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {evidence.slice(0, 4).map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex gap-2.5 rounded-md border border-white/[0.06] bg-black/25 px-3 py-2.5"
        >
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk/70" />
          <p className="text-[13px] leading-relaxed text-fg">
            {e.text}
            {e.source === "payment" && <span className="ml-2 chip">payment record</span>}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export function AttackChain({
  nodes,
  play = true,
  stagger = 420,
  selectedId,
  onSelect,
  onRevealed,
  showDetail = true,
}: {
  nodes: AttackNode[];
  play?: boolean;
  stagger?: number;
  selectedId?: string | null;
  onSelect?: (node: AttackNode | null) => void;
  onRevealed?: () => void;
  showDetail?: boolean;
}) {
  const [shown, setShown] = useState(play ? 0 : nodes.length);
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const sel = selectedId !== undefined ? selectedId : internalSel;

  useEffect(() => {
    if (!play) {
      setShown(nodes.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= nodes.length) {
        clearInterval(id);
        onRevealed?.();
      }
    }, stagger);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, nodes, stagger]);

  const select = (n: AttackNode) => {
    const next = sel === n.id ? null : n.id;
    setInternalSel(next);
    onSelect?.(next ? n : null);
  };
  const selected = nodes.find((n) => n.id === sel) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="panel relative overflow-hidden p-4 md:p-6">
        <div className="bg-grid-fine pointer-events-none absolute inset-0 opacity-50 mask-radial" />
        {/* Horizontal on large screens */}
        <div className="relative hidden lg:flex lg:items-stretch">
          {nodes.map((n, i) => (
            <div key={n.id} className="flex min-w-0 flex-1 items-stretch">
              {i > 0 && (
                <div className="w-5 shrink-0 self-center xl:w-7">
                  <Connector visible={i < shown} color={nodeColor(n, i, nodes.length)} />
                </div>
              )}
              <ThreatNode node={n} index={i} total={nodes.length} visible={i < shown} selected={sel === n.id} onClick={() => select(n)} />
            </div>
          ))}
        </div>
        {/* Vertical on small screens */}
        <div className="relative flex flex-col lg:hidden">
          {nodes.map((n, i) => (
            <div key={n.id}>
              {i > 0 && <Connector vertical visible={i < shown} color={nodeColor(n, i, nodes.length)} />}
              <ThreatNode node={n} index={i} total={nodes.length} visible={i < shown} selected={sel === n.id} onClick={() => select(n)} />
            </div>
          ))}
        </div>
      </div>

      {showDetail && (
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="panel grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]"
            >
              <div className="min-w-0">
                <div className="label mb-1">Extracted evidence · {STAGE_CODE[selected.stage]}</div>
                <div className="mb-3 text-lg font-semibold uppercase tracking-wide">{selected.label}</div>
                {selected.evidence.length ? (
                  <EvidenceBlock evidence={selected.evidence} />
                ) : (
                  <p className="text-sm text-fg-muted">{selected.sublabel}</p>
                )}
              </div>
              {selected.details && (
                <dl className="flex flex-col divide-y divide-white/[0.06] self-start rounded-md border border-white/[0.06] bg-black/20">
                  {selected.details.map((d) => (
                    <div key={d.label} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
                      <dt className="label text-[10px]">{d.label}</dt>
                      <dd className="text-right font-mono text-[12.5px] text-fg">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-wider text-fg-dim"
            >
              <MousePointerClick className="h-3.5 w-3.5" /> Select any node to see the evidence Sentinel extracted
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
