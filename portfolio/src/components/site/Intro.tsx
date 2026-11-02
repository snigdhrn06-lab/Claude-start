"use client";
/**
 * Opening sequence (~1.8 s): a market line draws while a counter runs, then the curtain lifts.
 * Shown once per browser session, skippable (button, click, Esc/Enter/Space), and never shown to
 * reduced-motion visitors. The inline script in the site layout hides it before first paint when
 * it should be skipped, so there is no flash.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSite } from "./SiteProvider";

const KEY = "srn-intro-seen";

export function Intro({ name }: { name: string }) {
  const { setIntroDone } = useSite();
  const [visible, setVisible] = useState(true);
  const [count, setCount] = useState(0);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setVisible(false);
    setTimeout(() => setIntroDone(true), 350);
  }, [setIntroDone]);

  useEffect(() => {
    if (document.documentElement.dataset.intro === "skip") {
      finished.current = true;
      setVisible(false);
      setIntroDone(true);
      return;
    }
    document.documentElement.style.overflow = "hidden";
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1300);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(finish, 1850);
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "Enter", " "].includes(e.key)) finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, setIntroDone]);

  useEffect(() => {
    if (!visible) document.documentElement.style.overflow = "";
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro-overlay fixed inset-0 z-[100] flex flex-col justify-between bg-bg p-6 sm:p-10"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          onClick={finish}
          role="presentation"
        >
          <div className="flex items-center justify-between">
            <span className="label">{name}</span>
            <button type="button" onClick={finish} className="label rounded-full border border-line/15 px-3 py-1.5 hover:text-fg">
              Skip intro
            </button>
          </div>
          <svg viewBox="0 0 1000 240" className="mx-auto w-full max-w-4xl" aria-hidden>
            <motion.path
              d="M0 190 L80 170 L140 182 L210 130 L270 148 L340 96 L400 120 L470 70 L540 98 L600 60 L680 84 L750 38 L820 56 L900 22 L1000 30"
              fill="none"
              stroke="rgb(var(--accent))"
              strokeWidth={2.5}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.3, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>
          <div className="flex items-end justify-between">
            <motion.span
              className="display text-5xl sm:text-7xl"
              initial={{ y: "40%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              {name}
            </motion.span>
            <span className="font-mono text-4xl tabular-nums text-accent sm:text-6xl" aria-hidden>
              {String(count).padStart(3, "0")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
