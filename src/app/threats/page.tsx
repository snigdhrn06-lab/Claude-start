"use client";

import { motion } from "framer-motion";
import { Activity, IndianRupee, ScanLine, ShieldAlert, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { RiskGauge } from "@/components/RiskGauge";
import { DemoDataBadge, PageHeader, SectionLabel, cn, riskTone } from "@/components/ui";
import { ALERTS, KPIS } from "@/lib/threatData";

const loading = () => <div className="h-[220px] animate-pulse rounded bg-white/[0.02]" />;
const RiskTrendChart = dynamic(() => import("@/components/ThreatCharts").then((m) => m.RiskTrendChart), { ssr: false, loading });
const DailyScansChart = dynamic(() => import("@/components/ThreatCharts").then((m) => m.DailyScansChart), { ssr: false, loading });
const PatternChart = dynamic(() => import("@/components/ThreatCharts").then((m) => m.PatternChart), { ssr: false, loading });
const SeverityBar = dynamic(() => import("@/components/ThreatCharts").then((m) => m.SeverityBar), { ssr: false });

function Kpi({ icon: Icon, label, value, suffix, prefix, tone, i }: { icon: typeof Activity; label: string; value: number; suffix?: string; prefix?: string; tone?: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -2 }} className="panel p-4">
      <div className="label flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", tone)}>
        {prefix}
        <AnimatedNumber from={0} to={value} duration={1.2} />
        {suffix}
      </div>
    </motion.div>
  );
}

export default function ThreatsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Financial threat center"
        title="What manipulation looks like at scale."
        description="Aggregate view of scans, holds and attack patterns. Every figure on this page is synthetic demo data — not real Sentinel users."
        actions={<DemoDataBadge />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi i={0} icon={ScanLine} label="Scans completed" value={KPIS.scans} />
        <Kpi i={1} icon={ShieldAlert} label="High-risk interactions" value={KPIS.highRisk} tone="text-risk" />
        <Kpi i={2} icon={IndianRupee} label="Simulated losses prevented" value={KPIS.prevented} prefix="₹" tone="text-safe" />
        <Kpi i={3} icon={Activity} label="Average risk score" value={KPIS.avgRisk} />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="panel col-span-2 flex items-center gap-4 p-4 md:col-span-1">
          <RiskGauge value={KPIS.protection} size={70} stroke={5} ticks={false} center={<span className="num text-lg font-semibold text-safe">{KPIS.protection}</span>} color="#33d69f" />
          <div>
            <div className="label flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Protection score</div>
            <div className="mt-1 text-[12px] leading-snug text-fg-muted">{KPIS.holdRate}% of held payments cancelled after verification</div>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="panel p-4">
          <SectionLabel right={<DemoDataBadge />}>Risk trend · avg score, 14 days</SectionLabel>
          <RiskTrendChart />
        </div>
        <div className="panel p-4">
          <SectionLabel
            right={
              <div className="flex items-center gap-3 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#3d434d]" />Below threshold</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-risk" />High risk (held)</span>
              </div>
            }
          >
            Daily scans
          </SectionLabel>
          <DailyScansChart />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="panel p-4">
          <SectionLabel right={<DemoDataBadge />}>Most common attack patterns</SectionLabel>
          <PatternChart />
          <div className="mt-5 border-t border-white/[0.05] pt-4">
            <div className="label mb-3">Severity breakdown</div>
            <SeverityBar />
          </div>
        </div>
        <div className="panel p-4">
          <SectionLabel right={<span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-fg-dim"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-risk" />Live (simulated)</span>}>
            Recent alerts
          </SectionLabel>
          <ul className="flex flex-col divide-y divide-white/[0.05]">
            {ALERTS.map((a, i) => (
              <motion.li key={a.title} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="flex items-center gap-3 py-2.5">
                <span className={cn("num w-8 font-mono text-[13px] font-semibold", riskTone(a.score).text)}>{a.score}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{a.title}</div>
                  <div className="font-mono text-[10.5px] text-fg-dim">{a.channel}</div>
                </div>
                <span className="font-mono text-[11px] text-fg-dim">{a.t}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
