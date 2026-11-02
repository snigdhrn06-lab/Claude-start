"use client";
/** Counts up to a verified figure when visible. Non-numeric values render as-is. */
import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function parse(value: string) {
  const m = value.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const num = Number(m[2]!.replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const decimals = (m[2]!.split(".")[1] ?? "").length;
  return { prefix: m[1]!, num, suffix: m[3]!, decimals, grouped: m[2]!.includes(",") || num >= 1000 };
}

export function Counter({ value, className, duration = 1.6 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const parsed = parse(value);
  const format = (n: number) =>
    parsed ? `${parsed.prefix}${n.toLocaleString("en-IN", { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals, useGrouping: parsed.grouped })}${parsed.suffix}` : value;
  const [display, setDisplay] = useState(() => (parsed ? format(0) : value));

  useEffect(() => {
    if (!parsed) return;
    if (!inView) return;
    if (reduce) {
      setDisplay(format(parsed.num));
      return;
    }
    const controls = animate(0, parsed.num, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(format(v)) });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
