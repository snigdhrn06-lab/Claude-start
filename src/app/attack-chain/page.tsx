"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AnalysisPicker } from "@/components/AnalysisPicker";
import { AttackChain } from "@/components/AttackChain";
import { ConversationView } from "@/components/ConversationView";
import { PredictedPath } from "@/components/PredictedPath";
import { PageHeader, SectionLabel } from "@/components/ui";
import { useSentinel } from "@/lib/store";
import type { AttackNode } from "@/lib/types";

export default function AttackChainPage() {
  const { current } = useSentinel();
  const [run, setRun] = useState(0);
  const [selected, setSelected] = useState<AttackNode | null>(null);
  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          eyebrow="Attack chain"
          title="How the attack works."
          description="Sentinel reconstructs the manipulation as a chain: who claims what, how pressure is applied, and where the money is meant to go."
          actions={
            <>
              <AnalysisPicker />
              <button className="btn-ghost py-1.5" onClick={() => { setRun((r) => r + 1); setSelected(null); }}>
                <RotateCcw className="h-3.5 w-3.5" /> Replay
              </button>
            </>
          }
        />
        <AttackChain key={`${current.id}-${run}`} nodes={current.attackChain} onSelect={setSelected} />
        {selected && selected.evidence.some((e) => e.start >= 0) && (
          <div className="mt-4">
            <SectionLabel>Located in conversation</SectionLabel>
            <ConversationView
              conversation={current.input.conversation}
              highlights={current.signals.filter((s) => !s.mitigating).flatMap((s) => s.evidence)}
              active={selected.evidence}
              maxHeight={300}
            />
          </div>
        )}
      </div>

      <div>
        <SectionLabel>What happens next? · Predicted attack path</SectionLabel>
        <PredictedPath key={`${current.id}-p-${run}`} root={current.hypotheticalNextSteps} />
      </div>

      <div className="panel flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
        <p className="text-sm text-fg-muted">The chain only works if the payment goes through. That&apos;s where Sentinel steps in.</p>
        <Link href="/firewall" className="btn-risk">
          Open payment firewall <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
