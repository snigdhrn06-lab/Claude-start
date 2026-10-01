"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Counts from one value to another. */
export function AnimatedNumber({ from, to, duration = 1.2, className, delay = 0 }: { from: number; to: number; duration?: number; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(from);
  const prev = useRef(from);
  useEffect(() => {
    if (reduce) {
      setV(to);
      return;
    }
    const c = animate(prev.current, to, {
      duration,
      delay,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (x) => setV(Math.round(x)),
    });
    prev.current = to;
    return () => c.stop();
  }, [to, duration, delay, reduce]);
  return <span className={`num ${className ?? ""}`}>{v.toLocaleString("en-IN")}</span>;
}
