"use client";
/**
 * Desktop cursor follower: a ring that trails the pointer and expands over interactive elements.
 * The native cursor stays visible (no usability cost). Elements can set data-cursor="View" to show a label.
 * Disabled on touch devices and for reduced-motion visitors.
 */
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [accent, setAccent] = useState("200, 245, 96");
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.5 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    setEnabled(mq.matches);
    const a = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().split(/\s+/).join(", ");
    if (a) setAccent(a);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [data-cursor], input, textarea, select, label");
      setHover(!!el && !el.matches("input, textarea, select"));
      setLabel(el?.dataset.cursor ?? null);
    };
    const leave = () => {
      x.set(-100);
      y.set(-100);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;
  const size = label ? 84 : hover ? 46 : 26;
  return (
    <motion.div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[90]" style={{ x: sx, y: sy }}>
      <motion.div
        className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border"
        animate={{
          width: size,
          height: size,
          backgroundColor: label ? `rgba(${accent}, 1)` : `rgba(${accent}, 0)`,
          borderColor: label ? `rgba(${accent}, 1)` : hover ? `rgba(${accent}, 0.9)` : "rgba(236, 234, 228, 0.35)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {label && <span className="font-mono text-[10px] uppercase tracking-label text-accent-ink">{label}</span>}
      </motion.div>
    </motion.div>
  );
}
