/** Research section: featured paper panel with headline findings, plus a list of further research. */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/shared/Markdown";
import { Reveal } from "@/components/motion/Reveal";
import type { PublicResearch } from "@/lib/content/queries";
import type { SiteSettings } from "@/lib/content/settings";
import { FindingViz } from "./FindingViz";
import { SectionHeader } from "./SectionHeader";

export function Research({ index, s, items }: { index: number; s: SiteSettings; items: PublicResearch[] }) {
  if (!items.length) return null;
  const copy = s.sectionCopy.research;
  const [lead, ...rest] = items;
  return (
    <section id="research" className="relative overflow-hidden border-t border-line/[0.06] bg-bg-2 py-24 md:py-36">
      <div className="pointer-events-none absolute -right-40 top-20 h-[36rem] w-[36rem] rounded-full bg-accent/[0.05] blur-[120px]" aria-hidden />
      <div className="container relative">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Research"} title={copy.title} intro={copy.intro} />

        <article className="relative overflow-hidden rounded-[2rem] border border-line/[0.09] bg-bg/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.08] px-6 py-4 md:px-10">
            <span className="label flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {lead!.kind === "paper" ? "Working paper" : lead!.kind}
            </span>
            {lead!.venue && <span className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[11px] uppercase tracking-label text-accent">{lead!.venue}</span>}
          </div>
          <div className="grid lg:grid-cols-12">
            <div className="border-line/[0.08] p-6 md:p-10 lg:col-span-7 lg:border-r">
              <Reveal>
                <h3 className="display text-[clamp(2rem,4.2vw,3.6rem)]">{lead!.title}</h3>
              </Reveal>
              {lead!.subtitle && (
                <Reveal delay={0.05}>
                  <p className="mt-4 font-display text-xl italic leading-snug text-muted md:text-2xl">{lead!.subtitle}</p>
                </Reveal>
              )}
              <Reveal delay={0.1} className="mt-8">
                <Markdown>{lead!.abstract}</Markdown>
              </Reveal>
              {lead!.tags.length > 0 && (
                <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                  {lead!.tags.map((t) => (
                    <li key={t} className="font-mono text-[11px] uppercase tracking-label text-dim">
                      #{t.replace(/\s+/g, "")}
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/research/${lead!.slug}`} className="btn btn-primary mt-10" data-cursor="Read">
                Read the research brief <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="lg:col-span-5">
              <p className="label border-b border-line/[0.08] px-6 py-4 md:px-10">Key findings</p>
              <dl>
                {lead!.findings.map((f, i) => (
                  <Reveal key={i} delay={i * 0.06} className="border-b border-line/[0.08] px-6 py-6 last:border-b-0 md:px-10">
                    <dt className="text-sm font-medium text-fg">{f.label}</dt>
                    <dd>
                      <span className="mt-2 block font-display text-5xl leading-none text-accent">{f.value}</span>
                      <FindingViz value={f.value} />
                      {f.context && <span className="mt-3 block text-sm leading-relaxed text-muted">{f.context}</span>}
                    </dd>
                  </Reveal>
                ))}
              </dl>
              {lead!.readingNote && <p className="border-t border-line/[0.08] px-6 py-5 font-mono text-[11px] leading-relaxed text-dim md:px-10">{lead!.readingNote}</p>}
            </div>
          </div>
        </article>

        {rest.length > 0 && (
          <ul className="mt-12 border-t border-line/[0.08]">
            {rest.map((r) => (
              <li key={r.id}>
                <Link href={`/research/${r.slug}`} className="group grid gap-2 border-b border-line/[0.08] py-6 md:grid-cols-12 md:items-baseline">
                  <span className="label md:col-span-2">{r.kind}{r.year ? ` · ${r.year}` : ""}</span>
                  <span className="display text-2xl transition-colors group-hover:text-accent md:col-span-7 md:text-3xl">{r.title}</span>
                  <span className="text-sm text-muted md:col-span-3 md:text-right">{r.venue}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
