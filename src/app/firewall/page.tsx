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
        eyebrow="Payment firewall"
        title="Banks protect transactions. Sentinel protects decisions."
        description="A simulated payment screen with Sentinel in the loop. Press pay to see the decision firewall intercept a manipulated transfer."
        actions={<AnalysisPicker />}
      />
      <PaymentFirewall analysis={current} />
    </div>
  );
}
