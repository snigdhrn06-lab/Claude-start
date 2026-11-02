/** Experience: sticky heading with grouped timelines (work & positions, leadership & sport, education). */
import { Reveal } from "@/components/motion/Reveal";
import { Markdown } from "@/components/shared/Markdown";
import type { PublicEducation, PublicExperience } from "@/lib/content/queries";
import type { SiteSettings } from "@/lib/content/settings";
import { formatRange } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";

function Entry({ when, title, org, meta, summary, highlights }: { when: string; title: string; org: string; meta?: string; summary?: string; highlights?: string[] }) {
  return (
    <Reveal as="li" className="relative grid gap-3 border-b border-line/[0.08] py-8 md:grid-cols-12 md:gap-6">
      <p className="font-mono text-xs uppercase tracking-label text-accent md:col-span-3 md:pt-1.5">{when}</p>
      <div className="md:col-span-9">
        <h4 className="text-xl font-medium leading-snug text-fg md:text-[1.45rem]">{title}</h4>
        <p className="mt-1 text-muted">
          {org}
          {meta ? <span className="text-dim"> · {meta}</span> : null}
        </p>
        {summary && <Markdown className="mt-3 !text-[0.95rem]">{summary}</Markdown>}
        {highlights && highlights.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {highlights.map((h, i) => (
              <li key={i} className="relative pl-6 text-[0.95rem] leading-relaxed text-muted">
                <span className="absolute left-0 top-[0.75em] h-px w-3 bg-accent" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Reveal>
  );
}

export function Experience({ index, s, experience, education }: { index: number; s: SiteSettings; experience: PublicExperience[]; education: PublicEducation[] }) {
  if (!experience.length && !education.length) return null;
  const copy = s.sectionCopy.experience;
  const work = experience.filter((e) => e.kind === "work" || e.kind === "position");
  const lead = experience.filter((e) => e.kind === "leadership" || e.kind === "sport");
  const groups = [
    { title: "Work & positions", items: work },
    { title: "Leadership, events & sport", items: lead },
  ].filter((g) => g.items.length);

  return (
    <section id="experience" className="relative border-t border-line/[0.06] bg-bg-2 py-24 md:py-36">
      <div className="container">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Experience"} title={copy.title} intro={copy.intro} />
        <div className="space-y-20">
          {groups.map((g) => (
            <div key={g.title} className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <h3 className="label sticky top-[calc(var(--nav-h)+1.5rem)]">{g.title}</h3>
              </div>
              <ol className="border-t border-line/[0.08] lg:col-span-9">
                {g.items.map((e) => (
                  <Entry key={e.id} when={formatRange(e.startDate, e.endDate)} title={e.role} org={e.organization} meta={e.location} summary={e.summary} highlights={e.highlights} />
                ))}
              </ol>
            </div>
          ))}
          {education.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <h3 className="label sticky top-[calc(var(--nav-h)+1.5rem)]">Education</h3>
              </div>
              <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-9">
                {education.map((e) => (
                  <Reveal as="li" key={e.id} className="flex flex-col justify-between rounded-[1.5rem] border border-line/[0.09] bg-bg/50 p-6 md:p-8">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-label text-accent">{formatRange(e.startDate, e.endDate)}</p>
                      <h4 className="display mt-4 text-3xl">{e.qualification}</h4>
                      {e.field && <p className="mt-1 text-fg/90">{e.field}</p>}
                      <p className="mt-3 text-sm text-muted">{e.institution}</p>
                      {e.description && <Markdown className="mt-4 !text-sm">{e.description}</Markdown>}
                    </div>
                    {e.score && (
                      <p className="mt-8 flex items-baseline gap-3 border-t border-line/[0.08] pt-5">
                        <span className="font-display text-4xl text-fg">{e.score}</span>
                        <span className="label">Score</span>
                      </p>
                    )}
                  </Reveal>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
