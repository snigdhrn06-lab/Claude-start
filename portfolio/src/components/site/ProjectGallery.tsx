"use client";
import { Maximize2 } from "lucide-react";
import { useState } from "react";
import { Lightbox } from "@/components/shared/Lightbox";
import { MediaImage } from "@/components/shared/MediaImage";
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function ProjectGallery({ items }: { items: { media: PublicMedia; caption: string }[] }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((it, i) => {
          const portrait = (it.media.height ?? 0) > (it.media.width ?? 1);
          return (
            <li key={it.media.id} className={cn(i === 0 && items.length > 2 && !portrait && "md:col-span-2", portrait && "md:row-span-2")}>
              <figure>
                <button type="button" onClick={() => setIndex(i)} data-cursor="Zoom" className="group relative block w-full overflow-hidden rounded-2xl border border-line/10 bg-surface" aria-label={`Open image${it.caption ? `: ${it.caption}` : ""}`}>
                  <MediaImage media={it.media} sizes="(min-width: 768px) 50vw, 100vw" className={cn("w-full object-cover object-top transition-transform duration-700 ease-expo group-hover:scale-[1.02]", portrait ? "max-h-[46rem]" : "aspect-[16/10]")} />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100" aria-hidden>
                    <Maximize2 className="h-4 w-4" />
                  </span>
                </button>
                {it.caption && <figcaption className="mt-3 text-sm text-muted">{it.caption}</figcaption>}
              </figure>
            </li>
          );
        })}
      </ul>
      <Lightbox items={items} index={index} onClose={() => setIndex(null)} onIndex={setIndex} />
    </>
  );
}
