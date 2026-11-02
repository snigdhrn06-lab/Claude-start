/** Achievements: podium cards for featured awards, an invitation callout and the full record. */
import { Reveal } from "@/components/motion/Reveal";
import { Markdown } from "@/components/shared/Markdown";
import type { PublicAchievement } from "@/lib/content/queries";
import type { SiteSettings } from "@/lib/content/settings";
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { AchievementRecord } from "./AchievementRecord";
import { SectionHeader } from "./SectionHeader";

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

export function Achievements({ index, s, items, media }: { index: number; s: SiteSettings; items: PublicAchievement[]; media: Record<string, PublicMedia> }) {
  if (!items.length) return null;
  const copy = s.sectionCopy.achievements;
  const invitations = items.filter((a) => a.kind === "invitation");
  const podium = items.filter((a) => a.featured && a.kind !== "invitation");
  const record = items.filter((a) => a.kind !== "invitation");

  return (
    <section id="achievements" className="relative border-t border-line/[0.06] py-24 md:py-36">
      <div className="container">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Achievements"} title={copy.title} intro={copy.intro} />

        {podium.length > 0 && (
          <ol className="grid gap-4 md:grid-cols-6">
            {podium.map((a, i) => {
              const big = i < 2;
              // Fill rows of 6 columns: first two cards span 3; the rest span 2, widening the last row's cards to avoid gaps.
              const restCount = podium.length - 2;
              const posInRest = i - 2;
              const lastRowSize = restCount % 3;
              const inLastRow = !big && lastRowSize > 0 && posInRest >= restCount - lastRowSize;
              const span = big ? "md:col-span-3" : inLastRow ? (lastRowSize === 1 ? "md:col-span-6" : "md:col-span-3") : "md:col-span-2";
              return (
                <Reveal
                  as="li"
                  key={a.id}
                  delay={(i % 3) * 0.08}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] border border-line/[0.09] bg-surface/60 p-6 transition-colors duration-500 hover:border-accent/40 md:p-8",
                    span,
                    big ? "md:min-h-[22rem]" : "md:min-h-[18rem]",
                  )}
                >
                  <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/0 blur-3xl transition-colors duration-700 group-hover:bg-accent/10" aria-hidden />
                  <div className="flex items-start justify-between gap-4">
                    <p className={cn("display leading-none", big ? "text-[clamp(4.5rem,9vw,7.5rem)]" : "text-7xl")}>
                      {a.placement ? (
                        <>
                          {a.placement}
                          <span className="align-super text-[0.4em] italic text-accent">{ordinal(a.placement).replace(String(a.placement), "")}</span>
                        </>
                      ) : (
                        <span className="text-[0.55em] italic text-accent">{a.title}</span>
                      )}
                    </p>
                    {a.year && <span className="font-mono text-xs text-dim">{a.year}</span>}
                  </div>
                  <div className="mt-8">
                    {a.placement && <p className="label mb-2 text-accent">{a.title}</p>}
                    <h3 className={cn("font-medium leading-snug text-fg", big ? "text-xl md:text-2xl" : "text-lg")}>{a.event}</h3>
                    {a.institution && <p className="mt-1 text-sm text-muted">{a.institution}</p>}
                    {big && a.description && <p className="mt-4 text-sm leading-relaxed text-muted">{a.description}</p>}
                  </div>
                </Reveal>
              );
            })}
          </ol>
        )}

        {invitations.map((a) => (
          <Reveal key={a.id} className="mt-4">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-dashed border-accent/50 p-6 md:flex md:items-center md:justify-between md:gap-10 md:p-8">
              <div>
                <p className="label flex items-center gap-2 text-accent">
                  <span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent" aria-hidden /> {a.title}
                  {a.year ? ` · ${a.year}` : ""}
                </p>
                <h3 className="display mt-3 text-3xl md:text-4xl">{a.event}</h3>
                {a.institution && <p className="mt-1 text-sm text-muted">{a.institution}</p>}
              </div>
              {a.description && <Markdown className="mt-4 max-w-xl !text-sm md:mt-0">{a.description}</Markdown>}
            </div>
          </Reveal>
        ))}

        {record.length > 0 && (
          <div className="mt-20">
            <Reveal>
              <p className="label mb-6">Full record</p>
            </Reveal>
            <AchievementRecord
              items={record.map((a) => ({
                id: a.id,
                title: a.title,
                event: a.event,
                institution: a.institution,
                year: a.year,
                description: a.description,
                image: a.mediaId ? media[a.mediaId] ?? null : null,
                document: a.documentMediaId ? media[a.documentMediaId] ?? null : null,
                verificationUrl: a.verificationUrl,
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}
