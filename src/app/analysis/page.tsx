"use client";

import { ScanLine } from "lucide-react";
import Link from "next/link";
import { AnalysisPicker } from "@/components/AnalysisPicker";
import { AnalysisView } from "@/components/AnalysisView";
import { PageHeader } from "@/components/ui";
import { useSentinel } from "@/lib/store";

export default function AnalysisPage() {
  const { current } = useSentinel();
  return (
    <div>
      <PageHeader
        eyebrow="Analysis result"
        title="Risk detected before money moves."
        description="Every signal is tied to the exact words that triggered it. Select a signal to locate it in the conversation."
        actions={
          <>
            <AnalysisPicker />
            <Link href="/scan" className="btn-ghost py-1.5">
              <ScanLine className="h-3.5 w-3.5" /> New scan
            </Link>
          </>
        }
      />
      <AnalysisView key={current.id} result={current} />
    </div>
  );
}
