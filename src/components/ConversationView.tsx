"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { parseConversation } from "@/lib/engine/parse";
import type { Evidence } from "@/lib/types";
import { cn } from "./ui";

interface Range {
  start: number;
  end: number;
  active: boolean;
  safe: boolean;
}

function segments(text: string, offset: number, ranges: Range[]) {
  const local = ranges
    .map((r) => ({ ...r, start: Math.max(r.start - offset, 0), end: Math.min(r.end - offset, text.length) }))
    .filter((r) => r.end > r.start);
  if (!local.length) return [{ text, mark: null as null | Range }];
  const cuts = new Set<number>([0, text.length]);
  local.forEach((r) => {
    cuts.add(r.start);
    cuts.add(r.end);
  });
  const pts = [...cuts].sort((a, b) => a - b);
  const out: { text: string; mark: null | Range }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const covering = local.filter((r) => r.start <= a && r.end >= b);
    const mark = covering.length
      ? { start: a, end: b, active: covering.some((c) => c.active), safe: covering.every((c) => c.safe) }
      : null;
    out.push({ text: text.slice(a, b), mark });
  }
  return out;
}

export function ConversationView({
  conversation,
  highlights = [],
  active = [],
  safe = [],
  reveal,
  className,
  maxHeight = 520,
  title,
}: {
  conversation: string;
  highlights?: Evidence[];
  active?: Evidence[];
  safe?: Evidence[];
  /** Number of messages to show (for typed-in reveal). Undefined = all. */
  reveal?: number;
  className?: string;
  maxHeight?: number;
  title?: React.ReactNode;
}) {
  const messages = useMemo(() => parseConversation(conversation), [conversation]);
  const ranges: Range[] = useMemo(() => {
    const key = (e: Evidence) => `${e.start}:${e.end}`;
    const activeKeys = new Set(active.map(key));
    const all = [...highlights, ...active, ...safe].filter((e) => e.start >= 0);
    const seen = new Set<string>();
    return all
      .filter((e) => (seen.has(key(e)) ? false : (seen.add(key(e)), true)))
      .map((e) => ({ start: e.start, end: e.end, active: activeKeys.has(key(e)), safe: safe.some((s) => key(s) === key(e)) }));
  }, [highlights, active, safe]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const mark = el.querySelector("mark.active") as HTMLElement | null;
    if (mark) {
      const top = mark.offsetTop - el.offsetTop - el.clientHeight / 3;
      el.scrollTo({ top, behavior: "smooth" });
    } else if (reveal !== undefined) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [active, reveal]);

  const shown = reveal === undefined ? messages : messages.slice(0, reveal);
  const sender = messages.find((m) => !m.self)?.sender ?? "Unknown";

  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-fg-muted">
            {sender.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{title ?? sender}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">Unverified sender · inbound</div>
          </div>
        </div>
        <span className="chip shrink-0">{messages.length} msgs</span>
      </div>
      <div ref={scroller} className="relative flex flex-col gap-2.5 overflow-y-auto px-4 py-4" style={{ maxHeight }}>
        <AnimatePresence initial={reveal !== undefined}>
          {shown.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={cn("flex flex-col", m.self ? "items-end" : "items-start")}
            >
              {!m.self && (i === 0 || shown[i - 1]?.sender !== m.sender) && (
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">{m.sender}</div>
              )}
              <div
                className={cn(
                  "max-w-[88%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  m.self ? "rounded-br-sm bg-info/[0.12] text-fg" : "rounded-bl-sm border border-white/[0.06] bg-ink-750 text-fg/90",
                )}
              >
                {segments(m.text, m.offset, ranges).map((s, j) =>
                  s.mark ? (
                    <mark key={j} className={cn("evidence", s.mark.active && "active", s.mark.safe && "safe")}>
                      {s.text}
                    </mark>
                  ) : (
                    <span key={j}>{s.text}</span>
                  ),
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
