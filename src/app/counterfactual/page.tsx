"use client";

import { useState } from "react";
import { CounterfactualLab } from "@/components/CounterfactualLab";
import { PageHeader, cn } from "@/components/ui";
import { SCENARIOS } from "@/lib/scenarios";

export default function CounterfactualPage() {
  const [id, setId] = useState("kyc");
  const scenario = SCENARIOS.find((s) => s.id === id)!;
  return (
    <div>
      <PageHeader
        eyebrow="Counterfactual lab"
        title="What if we change one thing?"
        description="Same sender. Same claim of authority. Change a single sentence and watch which signals disappear. The score moves because the context moved — not because of a guess."
        actions={
          <div className="flex gap-1 rounded-md border border-white/[0.08] bg-ink-900 p-1">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setId(s.id)}
                className={cn("rounded px-2.5 py-1 text-[12px] transition", id === s.id ? "bg-white/[0.08] text-fg" : "text-fg-dim hover:text-fg-muted")}
              >
                {s.short}
              </button>
            ))}
          </div>
        }
      />
      <CounterfactualLab key={id} pivot={scenario.pivot!} />
    </div>
  );
}
