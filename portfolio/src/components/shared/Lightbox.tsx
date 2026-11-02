"use client";
/** Accessible image lightbox with keyboard navigation (←/→/Esc) and focus return. */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { PublicMedia } from "@/lib/media-url";

export type LightboxItem = { media: PublicMedia; caption?: string };

export function Lightbox({ items, index, onClose, onIndex }: { items: LightboxItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = index !== null && !!items[index];
  const go = useCallback((d: number) => index !== null && onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      returnFocus.current?.focus();
    };
  }, [open, onClose, go]);

  const item = index !== null ? items[index] : null;
  return (
    <AnimatePresence>
      {open && item && (
        <motion.div
          className="fixed inset-0 z-[95] flex flex-col bg-black/90 p-4 backdrop-blur-md sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between text-sm text-muted" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs">
              {index! + 1} / {items.length}
            </span>
            <button ref={closeRef} type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 hover:border-white/50" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
            <motion.img
              key={item.media.id}
              src={item.media.url}
              srcSet={item.media.srcSet || undefined}
              sizes="100vw"
              alt={item.media.alt || item.caption || ""}
              className="max-h-full max-w-full rounded-lg object-contain"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              onClick={(e) => e.stopPropagation()}
            />
            {items.length > 1 && (
              <>
                <button type="button" onClick={(e) => (e.stopPropagation(), go(-1))} className="absolute left-0 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/40 hover:border-white/50" aria-label="Previous image">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={(e) => (e.stopPropagation(), go(1))} className="absolute right-0 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/40 hover:border-white/50" aria-label="Next image">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {item.caption && (
            <p className="mx-auto max-w-2xl text-center text-sm text-muted" onClick={(e) => e.stopPropagation()}>
              {item.caption}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
