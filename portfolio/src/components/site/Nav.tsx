"use client";
/**
 * Site navigation: fixed, hides on scroll down / returns on scroll up, tracks the active section,
 * and becomes a full-screen menu on mobile.
 */
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { key: string; label: string };

export function Nav({ name, shortName, items, resumeLabel, hasResume }: { name: string; shortName: string; items: NavItem[]; resumeLabel: string; hasResume: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [active, setActive] = useState<string>("");
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      if (y > 400 && y > lastY + 4) setHidden(true);
      else if (y < lastY - 4 || y <= 400) setHidden(false);
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!onHome) return;
    const els = items.map((i) => document.getElementById(i.key)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    const onTop = () => window.scrollY < 200 && setActive("");
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [items, onHome]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const href = (key: string) => (onHome ? `#${key}` : `/#${key}`);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-500 ease-expo",
          hidden && !open ? "-translate-y-full" : "translate-y-0",
          scrolled && !open ? "border-b border-line/[0.07] bg-bg/70 backdrop-blur-xl" : "border-b border-transparent",
        )}
      >
        <nav className="container flex h-[var(--nav-h)] items-center justify-between gap-6" aria-label="Main">
          <Link href="/" className="group flex items-center gap-3" aria-label={`${name}, home`} onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-line/15 font-mono text-[10px] tracking-wider transition-colors group-hover:border-accent group-hover:text-accent">
              {shortName}
            </span>
            <span className="hidden text-sm font-medium tracking-tight sm:block">{name}</span>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <li key={item.key}>
                <a
                  href={href(item.key)}
                  className={cn("relative rounded-full px-3.5 py-2 text-[0.8125rem] transition-colors", active === item.key ? "text-fg" : "text-muted hover:text-fg")}
                  aria-current={active === item.key ? "location" : undefined}
                >
                  {active === item.key && <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-full bg-white/[0.06]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {hasResume && (
              <a href="/resume" className="btn btn-ghost hidden !py-2 !text-[0.8125rem] sm:inline-flex" target="_blank" rel="noopener">
                {resumeLabel}
                <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-line/15 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-bg px-5 pb-10 pt-[calc(var(--nav-h)+2rem)] lg:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <ul className="flex flex-1 flex-col justify-center gap-1">
              {items.map((item, i) => (
                <motion.li key={item.key} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                  <a href={href(item.key)} onClick={() => setOpen(false)} className="flex items-baseline gap-4 border-b border-line/[0.07] py-3">
                    <span className="font-mono text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
                    <span className="display text-[2.6rem]">{item.label}</span>
                  </a>
                </motion.li>
              ))}
            </ul>
            {hasResume && (
              <a href="/resume" target="_blank" rel="noopener" className="btn btn-primary mt-8 justify-center">
                Download {resumeLabel} <ArrowDownToLine className="h-4 w-4" aria-hidden />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
