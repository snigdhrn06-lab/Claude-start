/** Projects: featured projects as large editorial rows; the rest as an index with hover previews. */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import type { PublicProject } from "@/lib/content/queries";
import type { SiteSettings } from "@/lib/content/settings";
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { ProjectCover } from "./ProjectCover";
import { ProjectIndex } from "./ProjectIndex";
import { SectionHeader } from "./SectionHeader";

export function Projects({ index, s, projects, media }: { index: number; s: SiteSettings; projects: PublicProject[]; media: Record<string, PublicMedia> }) {
  if (!projects.length) return null;
  const copy = s.sectionCopy.projects;
  const featured = projects.filter((p) => p.featured);
  const others = projects.filter((p) => !p.featured);
  const lead = featured.length ? featured : projects.slice(0, 2);
  const rest = featured.length ? others : projects.slice(2);

  return (
    <section id="projects" className="relative py-24 md:py-36">
      <div className="container">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Projects"} title={copy.title} intro={copy.intro} />

        <ol className="space-y-24 md:space-y-36">
          {lead.map((p, i) => {
            const flip = i % 2 === 1;
            const accent = p.accent || undefined;
            return (
              <li key={p.id} style={accent ? ({ "--p-accent": accent } as React.CSSProperties) : undefined}>
                <article className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
                  <Reveal className={cn("lg:col-span-7", flip && "lg:order-2 lg:col-start-6")}>
                    <Link href={`/projects/${p.slug}`} data-cursor="View" className="group relative block overflow-hidden rounded-[1.75rem] border border-line/10 bg-surface" aria-label={`${p.title}: view project`}>
                      <div className="aspect-[16/10] overflow-hidden transition-transform duration-[1.2s] ease-expo group-hover:scale-[1.035]">
                        <ProjectCover project={p} media={media} sizes="(min-width: 1024px) 58vw, 100vw" />
                      </div>
                      <span className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-transparent transition duration-500 group-hover:ring-[color:var(--p-accent,rgb(var(--accent)))]" aria-hidden />
                    </Link>
                  </Reveal>
                  <div className={cn("lg:col-span-5", flip ? "lg:order-1 lg:col-span-4 lg:col-start-1" : "lg:col-start-8 lg:col-span-5")}>
                    <Reveal>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs" style={{ color: accent ?? "rgb(var(--accent))" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="h-px w-8 bg-line/20" aria-hidden />
                        <span className="label">{p.category}</span>
                      </div>
                    </Reveal>
                    <Reveal delay={0.05}>
                      <h3 className="display mt-5 text-[clamp(2.2rem,4vw,3.5rem)]">
                        <Link href={`/projects/${p.slug}`} className="transition-colors hover:text-[color:var(--p-accent,rgb(var(--accent)))]">
                          {p.title}
                        </Link>
                      </h3>
                    </Reveal>
                    <Reveal delay={0.1}>
                      <p className="mt-5 leading-relaxed text-muted">{p.summary}</p>
                    </Reveal>
                    <Reveal delay={0.15}>
                      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line/[0.08] pt-6 text-sm">
                        {p.role && (
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="label">Role</dt>
                            <dd className="mt-1 text-fg/90">{p.role}</dd>
                          </div>
                        )}
                        {p.year && (
                          <div>
                            <dt className="label">Year</dt>
                            <dd className="mt-1 text-fg/90">{p.year}</dd>
                          </div>
                        )}
                        {p.techStack.length > 0 && (
                          <div className="col-span-2">
                            <dt className="label">Stack</dt>
                            <dd className="mt-1 font-mono text-xs leading-relaxed text-muted">{p.techStack.join("  /  ")}</dd>
                          </div>
                        )}
                      </dl>
                    </Reveal>
                    <Reveal delay={0.2} className="mt-8 flex flex-wrap items-center gap-3">
                      <Link href={`/projects/${p.slug}`} className="btn btn-ghost">
                        Read the case study <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                      {p.liveUrl && (
                        <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-3 text-sm text-muted hover:text-fg">
                          Live site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </Reveal>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>

        {rest.length > 0 && (
          <div className="mt-28 md:mt-40">
            <Reveal>
              <p className="label mb-6">More work</p>
            </Reveal>
            <ProjectIndex
              items={rest.map((p, i) => ({
                id: p.id,
                n: lead.length + i + 1,
                slug: p.slug,
                title: p.title,
                category: p.category,
                year: p.year,
                summary: p.summary,
                visual: p.visual,
                accent: p.accent,
                coverMediaId: p.coverMediaId,
                gallery: p.gallery,
              }))}
              media={media}
            />
          </div>
        )}
      </div>
    </section>
  );
}
