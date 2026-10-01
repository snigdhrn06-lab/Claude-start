"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ClipboardPaste, CreditCard, FileImage, Layers, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageHeader, TimeLabel, cn, riskTone, useMounted } from "@/components/ui";
import { formatINR } from "@/lib/engine/parse";
import { amountAtStake } from "@/lib/engine/narrative";
import { useSentinel } from "@/lib/store";
import type { AnalysisResult } from "@/lib/types";

const SOURCE_ICON = { text: ClipboardPaste, image: FileImage, payment: CreditCard, scenario: Layers };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

export default function HistoryPage() {
  const { history, setCurrent, clearHistory } = useSentinel();
  const router = useRouter();
  const mounted = useMounted();
  const groups = useMemo(() => {
    const m = new Map<string, AnalysisResult[]>();
    for (const h of history) {
      const k = mounted ? dayLabel(h.createdAt) : "Recent";
      m.set(k, [...(m.get(k) ?? []), h]);
    }
    return [...m.entries()];
  }, [history, mounted]);

  const open = (id: string) => {
    setCurrent(id);
    router.push("/analysis");
  };
  const userCount = history.filter((h) => !h.id.startsWith("seed-")).length;

  return (
    <div>
      <PageHeader
        eyebrow="Scan history"
        title="Every decision Sentinel has reviewed."
        description="Open any scan to see its complete analysis, attack chain and firewall decision. Seeded entries are synthetic examples."
        actions={
          <>
            {userCount > 0 && (
              <button className="btn-ghost py-1.5" onClick={clearHistory}>
                <Trash2 className="h-3.5 w-3.5" /> Clear my scans
              </button>
            )}
            <Link href="/scan" className="btn-primary py-1.5">
              New scan
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-8">
        {groups.map(([label, items]) => (
          <section key={label}>
            <div className="label mb-3">{label}</div>
            <div className="panel divide-y divide-white/[0.05] overflow-hidden">
              {items.map((h, i) => {
                const tone = riskTone(h.riskScore);
                const Icon = SOURCE_ICON[h.input.source] ?? Layers;
                const amt = amountAtStake(h.input.conversation, h.input.payment);
                return (
                  <motion.button
                    key={h.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => open(h.id)}
                    className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025]"
                  >
                    <div className="relative flex w-14 shrink-0 flex-col items-start">
                      <span className={cn("num text-xl font-semibold leading-none", tone.text)}>{h.riskScore}</span>
                      <span className="font-mono text-[10px] text-fg-dim">/ 100</span>
                    </div>
                    <div className="hidden h-8 w-1 shrink-0 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                      <div className="w-full rounded-full" style={{ height: `${h.riskScore}%`, marginTop: `${100 - h.riskScore}%`, background: tone.hex }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{h.title}</span>
                        <span className="chip">{h.classification}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-fg-dim">{h.explanation}</div>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end gap-0.5 md:flex">
                      <span className="num font-mono text-[13px]">{amt ? formatINR(amt) : "—"}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fg-dim">
                        <Icon className="h-3 w-3" /> <TimeLabel iso={h.createdAt} />
                      </span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-faint transition group-hover:text-fg" />
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
