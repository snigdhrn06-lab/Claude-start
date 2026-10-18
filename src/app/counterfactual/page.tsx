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
        title="Which evidence drives the decision?"
        description="Change one controlled thing — a sentence, a recipient, the account context — and re-run the same engine on both versions. Edits can lower risk, raise it, or change nothing; the result depends only on the mechanism that remains."
        actions={
          <div className="flex flex-wrap gap-1 rounded-md border border-white/[0.08] bg-ink-900 p-1">
            {SCENARIOS.map((s) => (
              <button key={s.id} onClick={() => setId(s.id)} className={cn("rounded px-2.5 py-1 text-[12px] transition", id === s.id ? "bg-white/[0.08] text-fg" : "text-fg-dim hover:text-fg-muted")} aria-pressed={id === s.id}>
                {s.short}
              </button>
            ))}
          </div>
        }
      />
      <CounterfactualLab key={id} scenario={scenario} />
    </div>
  );
}
