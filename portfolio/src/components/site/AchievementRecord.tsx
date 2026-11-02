"use client";
/** Expandable list of every achievement, with certificates, documents and verification links. */
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Image as ImageIcon, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { Lightbox } from "@/components/shared/Lightbox";
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; event: string; institution: string; year: string; description: string; image: PublicMedia | null; document: PublicMedia | null; verificationUrl: string | null };

export function AchievementRecord({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PublicMedia | null>(null);

  return (
    <>
      <ul className="border-t border-line/[0.08]">
        {items.map((a) => {
          const expandable = !!(a.description || a.image || a.document || a.verificationUrl);
          const isOpen = open === a.id;
          const row = (
            <>
              <span className="font-mono text-xs text-dim md:col-span-1">{a.year || "—"}</span>
              <span className="text-sm font-medium text-accent md:col-span-3">{a.title}</span>
              <span className="text-[1.02rem] text-fg md:col-span-5">{a.event}</span>
              <span className="text-sm text-muted md:col-span-2">{a.institution}</span>
              <span className="hidden justify-self-end md:col-span-1 md:block">
                {expandable && <Plus className={cn("h-4 w-4 text-dim transition-transform duration-300", isOpen && "rotate-45 text-fg")} aria-hidden />}
              </span>
            </>
          );
          const cls = "grid w-full gap-1 py-5 text-left md:grid-cols-12 md:items-baseline md:gap-4";
          return (
            <li key={a.id} className="border-b border-line/[0.08]">
              {expandable ? (
                <button type="button" className={cn(cls, "group")} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.id)}>
                  {row}
                </button>
              ) : (
                <div className={cls}>{row}</div>
              )}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <div className="grid gap-4 pb-6 md:grid-cols-12 md:gap-4">
                      <div className="md:col-span-7 md:col-start-5">
                        {a.description && <p className="leading-relaxed text-muted">{a.description}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {a.image && (
                            <button type="button" onClick={() => setLightbox(a.image)} className="btn btn-ghost !py-2 !text-xs">
                              <ImageIcon className="h-3.5 w-3.5" aria-hidden /> View certificate / photo
                            </button>
                          )}
                          {a.document && (
                            <a href={a.document.url} target="_blank" rel="noopener" className="btn btn-ghost !py-2 !text-xs">
                              <FileText className="h-3.5 w-3.5" aria-hidden /> Supporting document
                            </a>
                          )}
                          {a.verificationUrl && (
                            <a href={a.verificationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-2 !text-xs">
                              <Link2 className="h-3.5 w-3.5" aria-hidden /> Verify
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <Lightbox items={lightbox ? [{ media: lightbox }] : []} index={lightbox ? 0 : null} onClose={() => setLightbox(null)} onIndex={() => {}} />
    </>
  );
}
