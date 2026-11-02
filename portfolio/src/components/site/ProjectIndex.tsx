"use client";
/** Project index rows. On desktop a preview follows the pointer while hovering a row. */
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PublicMedia } from "@/lib/media-url";
import { ProjectCover } from "./ProjectCover";

type Item = { id: string; n: number; slug: string; title: string; category: string; year: string; summary: string; visual: string; accent: string; coverMediaId: string | null; gallery: { mediaId: string; caption: string }[] };

export function ProjectIndex({ items, media }: { items: Item[]; media: Record<string, PublicMedia> }) {
  const [hover, setHover] = useState<Item | null>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 30 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 30 });

  return (
    <div
      className="relative"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        x.set(e.clientX + 24);
        y.set(e.clientY - 120);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <ul className="border-t border-line/[0.08]">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/projects/${it.slug}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(it)}
              onFocus={() => setHover(null)}
              className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 gap-y-2 border-b border-line/[0.08] py-6 transition-colors md:grid-cols-[3rem_1fr_16rem_5rem_2rem] md:py-8"
            >
              <span className="font-mono text-xs text-dim">{String(it.n).padStart(2, "0")}</span>
              <span className="display text-[1.9rem] leading-tight transition-[color,transform] duration-500 ease-expo group-hover:translate-x-2 group-hover:text-[color:var(--h)] md:text-[2.6rem]" style={{ ["--h" as string]: it.accent || "rgb(var(--accent))" }}>
                {it.title}
              </span>
              <ArrowUpRight className="h-5 w-5 text-dim transition-all group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-fg md:order-last" aria-hidden />
              <span className="col-span-3 col-start-2 text-sm text-muted md:col-span-1 md:col-start-auto">{it.category}</span>
              <span className="hidden font-mono text-xs text-dim md:block">{it.year}</span>
            </Link>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {hover && (
          <motion.div
            key={hover.id}
            className="pointer-events-none fixed left-0 top-0 z-30 hidden w-[22rem] overflow-hidden rounded-2xl border border-line/15 shadow-2xl lg:block"
            style={{ x, y }}
            initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden
          >
            <div className="aspect-[16/10]">
              <ProjectCover project={hover} media={media} sizes="22rem" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
