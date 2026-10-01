"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Background visualization for the home hero: a ledger of payment flows.
 * Most transfers pass through; one is caught and held at the firewall line.
 */
const ROWS = 9;

export function HeroField() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="bg-grid absolute inset-0 mask-radial opacity-70" />
      {/* Firewall line */}
      <div className="absolute bottom-0 top-0 left-[62%] w-px bg-gradient-to-b from-transparent via-risk/40 to-transparent" />
      <div className="absolute bottom-0 top-0 left-[62%] w-20 -translate-x-1/2 bg-gradient-to-r from-transparent via-risk/[0.05] to-transparent" />
      {Array.from({ length: ROWS }).map((_, r) => {
        const caught = (tick + r * 3) % 7 === 0;
        const top = 8 + r * 10;
        const dur = 3.6 + ((r * 37) % 10) / 6;
        return (
          <div key={r} className="absolute left-0 right-0" style={{ top: `${top}%` }}>
            <div className="h-px w-full bg-white/[0.03]" />
            {!reduce && (
              <motion.div
                key={`${tick}-${r}`}
                className="absolute -top-[2px] h-[5px] rounded-full"
                style={{
                  width: 46,
                  background: caught
                    ? "linear-gradient(90deg, transparent, #ff4a3d)"
                    : "linear-gradient(90deg, transparent, rgba(220,226,235,0.55))",
                  boxShadow: caught ? "0 0 14px #ff4a3d" : undefined,
                }}
                initial={{ left: "-6%", opacity: 0 }}
                animate={caught ? { left: ["-6%", "58.5%", "58.5%"], opacity: [0, 1, 0] } : { left: ["-6%", "104%"], opacity: [0, 0.8, 0] }}
                transition={{ duration: dur, ease: caught ? "easeOut" : "linear", delay: (r * 0.23) % 1.4, times: caught ? [0, 0.6, 1] : undefined }}
              />
            )}
          </div>
        );
      })}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}
