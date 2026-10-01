"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DAILY, PATTERNS, SEVERITY } from "@/lib/threatData";

const AXIS = { stroke: "rgba(255,255,255,0.12)", tick: { fill: "#626a77", fontSize: 11, fontFamily: "var(--font-geist-mono)" } };

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-ink-800/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur">
      {label && <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-fg-muted">{p.name}</span>
          <span className="num ml-auto pl-4 font-mono text-fg">
            {p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RiskTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={DAILY} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="rt" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff4a3d" stopOpacity={0.3} />
            <stop offset="1" stopColor="#ff4a3d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="day" {...AXIS} tickLine={false} interval={2} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} domain={[0, 60]} />
        <Tooltip content={<Tip />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
        <Area type="monotone" dataKey="avgRisk" name="Avg risk score" stroke="#ff4a3d" strokeWidth={2} fill="url(#rt)" activeDot={{ r: 5, stroke: "#08090b", strokeWidth: 2 }} animationDuration={1100} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyScansChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={DAILY} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="day" {...AXIS} tickLine={false} interval={2} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="other" name="Below threshold" stackId="a" fill="#3d434d" stroke="#0c0d10" strokeWidth={1} animationDuration={900} />
        <Bar dataKey="high" name="High risk (held)" stackId="a" fill="#ff4a3d" stroke="#0c0d10" strokeWidth={1} radius={[3, 3, 0, 0]} animationDuration={900} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PatternChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={PATTERNS} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="30%">
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={170} tick={{ fill: "#9aa1ad", fontSize: 11.5 }} tickLine={false} axisLine={false} />
        <Tooltip content={<Tip unit=" scans" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar
          dataKey="value"
          name="Detected"
          fill="#ff8c42"
          radius={[0, 3, 3, 0]}
          animationDuration={1000}
          label={{ position: "right", fill: "#9aa1ad", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeverityBar() {
  const total = SEVERITY.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
        {SEVERITY.map((s) => (
          <div key={s.name} title={`${s.name}: ${s.value}`} className="h-full transition-[filter] hover:brightness-125" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SEVERITY.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            <span className="text-fg-muted">{s.name}</span>
            <span className="num ml-auto font-mono text-fg">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

