"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

/** Image reveal: the frame opens from the centre and the photo settles from a slight zoom. */
export function ClipReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clip = useTransform(scrollYProgress, [0, 1], reduce ? ["inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] : ["inset(18% 14% 18% 14% round 24px)", "inset(0% 0% 0% 0% round 24px)"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.18, 1]);
  return (
    <motion.div ref={ref} style={{ clipPath: clip }} className={className}>
      <motion.div style={{ scale }}>{children}</motion.div>
    </motion.div>
  );
}

/** Vertical milestone timeline with a progress line that fills as you scroll. */
export function MilestoneRail({ items }: { items: { year: string; title: string; text: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const height = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <ol ref={ref} className="relative space-y-7 pl-8">
      <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line/10" aria-hidden />
      <motion.span style={{ height }} className="absolute left-[5px] top-2 w-px origin-top bg-accent" aria-hidden />
      {items.map((m, i) => (
        <motion.li
          key={i}
          className="relative"
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: 0.7, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="absolute -left-8 top-1.5 h-[11px] w-[11px] rounded-full border border-accent bg-bg" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-label text-accent">{m.year}</p>
          <p className="mt-1 text-[1.05rem] font-medium text-fg">{m.title}</p>
          {m.text && <p className="mt-1 text-sm leading-relaxed text-muted">{m.text}</p>}
        </motion.li>
      ))}
    </ol>
  );
}
