"use client";

import { AnalysisPicker } from "@/components/AnalysisPicker";
import { PaymentFirewall } from "@/components/PaymentFirewall";
import { PageHeader } from "@/components/ui";
import { useSentinel } from "@/lib/store";

export default function FirewallPage() {
  const { current } = useSentinel();
  return (
    <div>
      <PageHeader
        eyebrow="Payment check · simulation"
        title="Banks protect transactions. Sentinel protects decisions."
        description="A simulated payment screen with Sentinel in the loop. The assessment is real; the hold and the payment are not — Sentinel has no bank or UPI connection."
        actions={<AnalysisPicker />}
      />
      <PaymentFirewall analysis={current} />
    </div>
  );
}
