"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn, riskTone } from "./ui";

/** Keyframes for the score reveal: fast climb, brief overshoot, settle. */
function keyframesFor(v: number) {
  if (v === 94) return [0, 18, 41, 63, 78, 91, 96, 94];
  if (v < 10) return [0, v];
  const k = [0, 0.19, 0.44, 0.67, 0.83, 0.97].map((x) => Math.round(x * v));
  return v >= 50 ? [...k, Math.min(100, v + 2), v] : [...k, v];
}

export function ScoreCounter({
  value,
  play = true,
  duration = 1900,
  onDone,
  className,
}: {
  value: number;
  play?: boolean;
  duration?: number;
  onDone?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(play && reduce ? value : 0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!play) {
      setShown(0);
      return;
    }
    if (reduce) {
      setShown(value);
      done.current?.();
      return;
    }
    const frames = keyframesFor(value);
    // segment durations: quick early steps, longer settle
    const weights = frames.slice(1).map((_, i, a) => (i === a.length - 1 ? 2.2 : 1 + i * 0.12));
    const total = weights.reduce((x, y) => x + y, 0);
    const bounds: number[] = [];
    weights.reduce((acc, w) => {
      bounds.push(acc + (w / total) * duration);
      return acc + (w / total) * duration;
    }, 0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      let i = bounds.findIndex((b) => t < b);
      if (i === -1) {
        setShown(value);
        done.current?.();
        return;
      }
      const s0 = i === 0 ? 0 : bounds[i - 1];
      const p = (t - s0) / (bounds[i] - s0);
      const eased = 1 - Math.pow(1 - p, 2);
      setShown(Math.round(frames[i] + (frames[i + 1] - frames[i]) * eased));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, play, duration, reduce]);

  return <span className={cn("num", className)}>{shown}</span>;
}

const ARC = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

export function RiskGauge({
  value,
  size = 120,
  stroke = 6,
  play = true,
  delay = 0,
  label,
  center,
  ticks = true,
  className,
  color,
}: {
  color?: string;
  value: number;
  size?: number;
  stroke?: number;
  play?: boolean;
  delay?: number;
  label?: string;
  center?: React.ReactNode;
  ticks?: boolean;
  className?: string;
}) {
  const tone = { ...riskTone(value), ...(color ? { hex: color } : {}) };
  const c = size / 2;
  const r = c - stroke - (ticks ? 6 : 1);
  const start = -ARC / 2;
  const end = ARC / 2;
  const path = arcPath(c, c, r, start, end);
  const tickMarks = ticks
    ? Array.from({ length: 28 }, (_, i) => {
        const deg = start + (ARC * i) / 27;
        const p1 = polar(c, c, c - 2, deg);
        const p2 = polar(c, c, c - (i % 9 === 0 ? 7 : 4.5), deg);
        return { p1, p2, major: i % 9 === 0, lit: i / 27 <= value / 100 };
      })
    : [];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={size > 160 ? 6 : 3} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {tickMarks.map((t, i) => (
          <motion.line
            key={i}
            x1={t.p1.x}
            y1={t.p1.y}
            x2={t.p2.x}
            y2={t.p2.y}
            strokeWidth={t.major ? 1.4 : 1}
            initial={{ stroke: "rgba(255,255,255,0.12)" }}
            animate={{ stroke: play && t.lit ? tone.hex : "rgba(255,255,255,0.12)" }}
            transition={{ delay: delay + (i / 27) * 1.4, duration: 0.2 }}
          />
        ))}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round" />
        <motion.path
          d={path}
          fill="none"
          stroke={tone.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          filter={`url(#glow-${size})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: play ? Math.max(0.001, value / 100) : 0 }}
          transition={{ delay, duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {center}
        {label && <div className="label mt-1 text-[9.5px]">{label}</div>}
      </div>
    </div>
  );
}

/** Compact dimension gauge with counter. */
export function DimensionGauge({ label, value, play = true, delay = 0, caption }: { label: string; value: number; play?: boolean; delay?: number; caption?: string }) {
  const tone = riskTone(value);
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!play) return setGo(false);
    const t = setTimeout(() => setGo(true), delay * 1000);
    return () => clearTimeout(t);
  }, [play, delay]);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="panel flex items-center gap-4 p-4 transition-colors hover:border-white/[0.14]"
    >
      <RiskGauge
        value={value}
        size={76}
        stroke={5}
        ticks={false}
        play={go}
        center={<ScoreCounter value={value} play={go} duration={1300} className={cn("text-xl font-semibold", tone.text)} />}
      />
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className={cn("mt-1 text-sm font-medium", tone.text)}>{tone.label}</div>
        {caption && <div className="mt-0.5 text-xs leading-snug text-fg-dim">{caption}</div>}
      </div>
    </motion.div>
  );
}

/** Horizontal meter used inside dense panels. */
export function RiskBar({ label, value, play = true, delay = 0 }: { label: string; value: number; play?: boolean; delay?: number }) {
  const tone = riskTone(value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className={cn("num font-mono text-sm font-medium", tone.text)}>
          <ScoreCounter value={value} play={play} duration={1100} />
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone.hex, boxShadow: `0 0 12px ${tone.hex}` }}
          initial={{ width: 0 }}
          animate={{ width: play ? `${value}%` : 0 }}
          transition={{ delay, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
    </div>
  );
}
