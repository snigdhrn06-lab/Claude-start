/**
 * About: layered portrait composition (Fig. 01), story, interests, a cinematic second photograph
 * (Fig. 02) and a milestone timeline. Content: Admin → Site settings → About.
 */
import { Markdown } from "@/components/shared/Markdown";
import { MediaImage } from "@/components/shared/MediaImage";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import type { PublicMedia } from "@/lib/media-url";
import type { SiteSettings } from "@/lib/content/settings";
import { cn } from "@/lib/utils";
import { ClipReveal, MilestoneRail } from "./AboutClient";
import { SectionHeader } from "./SectionHeader";

export function About({ index, s, primary, secondary }: { index: number; s: SiteSettings; primary?: PublicMedia; secondary?: PublicMedia }) {
  const copy = s.sectionCopy.about;
  return (
    <section id="about" className="relative overflow-x-clip py-24 md:py-36">
      <div className="container">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "About"} title={copy.title} intro={copy.intro} />

        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          {/* Fig. 01 — portrait composition */}
          <figure className="relative lg:col-span-5">
            <div className="relative mx-auto max-w-[30rem]">
              <Parallax offset={30} className="relative">
                <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-line/10", "bg-[radial-gradient(90%_70%_at_50%_30%,rgb(var(--accent)/0.22),transparent_65%),linear-gradient(180deg,#141518,#0b0c0e)]")}>
                  <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--line)/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line)/0.07)_1px,transparent_1px)] [background-size:40px_40px]" aria-hidden />
                  <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-label text-fg/50">Fig. 01</span>
                  <span className="absolute right-5 top-5 font-mono text-[10px] uppercase tracking-label text-fg/50">{s.location}</span>
                  {primary && !s.portraitPrimaryCutout && (
                    <MediaImage media={primary} sizes="(min-width: 1024px) 30rem, 90vw" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
              </Parallax>
              {primary && s.portraitPrimaryCutout && (
                <Parallax offset={-25} className="pointer-events-none absolute inset-x-[-6%] bottom-0 top-[-12%]">
                  <MediaImage
                    media={primary}
                    sizes="(min-width: 1024px) 34rem, 100vw"
                    className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 object-contain object-bottom drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] [mask-image:linear-gradient(180deg,#000_82%,transparent)]"
                  />
                </Parallax>
              )}
              {!primary && (
                <div className="absolute inset-0 grid place-items-center text-sm text-dim">Add a portrait in Admin → Site settings → About</div>
              )}
            </div>
            {s.portraitPrimaryCaption && <figcaption className="label mx-auto mt-14 max-w-[30rem]">{s.portraitPrimaryCaption}</figcaption>}
          </figure>

          {/* Story */}
          <div className="lg:col-span-6 lg:col-start-7">
            {s.aboutLead && (
              <Reveal>
                <p className="font-display text-[clamp(1.7rem,2.8vw,2.4rem)] leading-[1.18] text-fg">{s.aboutLead}</p>
              </Reveal>
            )}
            <Reveal delay={0.1} className="mt-8">
              <Markdown>{s.aboutBody}</Markdown>
            </Reveal>
            {s.interests.length > 0 && (
              <div className="mt-12">
                <Reveal>
                  <p className="label mb-4">What I&apos;m drawn to</p>
                </Reveal>
                <ol className="grid border-t border-line/[0.08] sm:grid-cols-2 sm:gap-x-8">
                  {s.interests.map((it, i) => (
                    <Reveal as="li" key={it} delay={i * 0.04} className="flex items-baseline gap-4 border-b border-line/[0.08] py-4">
                      <span className="font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[0.98rem] text-fg/90">{it}</span>
                    </Reveal>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Fig. 02 + milestones */}
        {(secondary || s.milestones.length > 0) && (
          <div className="mt-24 grid gap-14 md:mt-36 lg:grid-cols-12 lg:gap-10">
            {secondary && (
              <figure className="lg:col-span-7">
                <ClipReveal className="relative overflow-hidden rounded-[1.5rem] border border-line/10">
                  <MediaImage media={secondary} sizes="(min-width: 1024px) 56vw, 100vw" className="aspect-[16/9] h-full w-full object-cover grayscale" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-bg/70 via-transparent to-transparent" aria-hidden />
                  <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-label text-fg/70">Fig. 02</span>
                </ClipReveal>
                {s.portraitSecondaryCaption && <figcaption className="label mt-5">{s.portraitSecondaryCaption}</figcaption>}
              </figure>
            )}
            {s.milestones.length > 0 && (
              <div className={cn(secondary ? "lg:col-span-5" : "lg:col-span-12")}>
                <Reveal>
                  <p className="label mb-6">Milestones</p>
                </Reveal>
                <MilestoneRail items={s.milestones} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
