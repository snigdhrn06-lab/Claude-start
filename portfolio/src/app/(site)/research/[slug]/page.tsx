/** Research detail page: question, motivation, data, methodology, findings, limitations, downloads. */
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { SplitWords } from "@/components/motion/SplitWords";
import { Markdown } from "@/components/shared/Markdown";
import { FindingViz } from "@/components/site/FindingViz";
import { getCurrentSession } from "@/lib/auth/session";
import { getResearchPreview, getSiteData } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = (await getSiteData()).research.find((x) => x.slug === slug);
  if (!r) return { title: "Research", robots: { index: false } };
  const description = (r.subtitle || r.abstract).replace(/[*_#>`]/g, "").slice(0, 200);
  return { title: r.title, description, alternates: { canonical: `/research/${r.slug}` }, openGraph: { title: r.title, description, type: "article" } };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal className="grid gap-4 border-t border-line/[0.08] py-10 md:grid-cols-12 md:gap-8">
      <h2 className="label md:col-span-3 md:pt-1.5">{title}</h2>
      <div className="md:col-span-9">{children}</div>
    </Reveal>
  );
}

export default async function ResearchPage({ params }: Params) {
  const { slug } = await params;
  const data = await getSiteData();
  let r = data.research.find((x) => x.slug === slug) ?? null;
  let media = data.media;
  let preview = false;
  if (!r && (await getCurrentSession())) {
    const p = await getResearchPreview(slug);
    if (p) {
      r = p.research;
      media = p.media;
      preview = p.research.status !== "published";
    }
  }
  if (!r) notFound();
  const paper = r.paperMediaId ? media[r.paperMediaId] : undefined;

  return (
    <article className="pb-24 pt-[calc(var(--nav-h)+2.5rem)]">
      <div className="container">
        {preview && <p className="mb-6 rounded-xl border border-dashed border-accent/50 px-4 py-3 text-sm text-accent">Draft preview: visible only to you.</p>}
        <Link href="/#research" className="label inline-flex items-center gap-2 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Research
        </Link>
        <header className="mt-10 max-w-5xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">{r.kind === "paper" ? "Working paper" : r.kind}{r.year ? ` · ${r.year}` : ""}</span>
            {r.venue && <span className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[11px] uppercase tracking-label text-accent">{r.venue}</span>}
          </div>
          <SplitWords as="h1" immediate text={r.title} className="display mt-8 text-[clamp(2.6rem,7vw,6.2rem)]" />
          {r.subtitle && <p className="mt-6 font-display text-2xl italic leading-snug text-muted md:text-3xl">{r.subtitle}</p>}
          {r.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {r.tags.map((t) => (
                <li key={t} className="rounded-full border border-line/15 px-3 py-1 font-mono text-[11px] text-muted">
                  {t}
                </li>
              ))}
            </ul>
          )}
          {(paper || r.externalUrl) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {paper && (
                <a href={paper.url} target="_blank" rel="noopener" className="btn btn-primary">
                  <FileText className="h-4 w-4" aria-hidden /> Read the paper (PDF)
                </a>
              )}
              {r.externalUrl && (
                <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  External link <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          )}
        </header>

        {r.findings.length > 0 && (
          <section aria-labelledby="findings" className="mt-16 overflow-hidden rounded-[2rem] border border-line/[0.09] bg-bg-2">
            <h2 id="findings" className="label border-b border-line/[0.08] px-6 py-4 md:px-10">
              Key findings
            </h2>
            <dl className="grid gap-px bg-line/[0.08] sm:grid-cols-2">
              {r.findings.map((f, i) => (
                <div key={i} className="bg-bg-2 p-6 md:p-10">
                  <dt className="text-sm font-medium text-fg">{f.label}</dt>
                  <dd>
                    <span className="mt-3 block font-display text-6xl leading-none text-accent">{f.value}</span>
                    <FindingViz value={f.value} />
                    {f.context && <span className="mt-4 block leading-relaxed text-muted">{f.context}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {r.readingNote && <p className="border-t border-line/[0.08] px-6 py-5 font-mono text-xs leading-relaxed text-dim md:px-10">{r.readingNote}</p>}
          </section>
        )}

        <div className="mt-16">
          {r.abstract && (
            <Block title="Abstract">
              <Markdown className="!text-lg">{r.abstract}</Markdown>
            </Block>
          )}
          {r.question && (
            <Block title="Research question">
              <p className="font-display text-[clamp(1.6rem,3vw,2.4rem)] italic leading-snug text-fg">{r.question.replace(/[*_]/g, "")}</p>
            </Block>
          )}
          {r.motivation && (
            <Block title="Motivation">
              <Markdown>{r.motivation}</Markdown>
            </Block>
          )}
          {r.dataSources && (
            <Block title="Data sources">
              <Markdown>{r.dataSources}</Markdown>
            </Block>
          )}
          {r.methodology && (
            <Block title="Methodology">
              <Markdown>{r.methodology}</Markdown>
            </Block>
          )}
          {r.limitations && (
            <Block title="Limitations">
              <Markdown>{r.limitations}</Markdown>
            </Block>
          )}
          {r.body && (
            <Block title="Notes">
              <Markdown>{r.body}</Markdown>
            </Block>
          )}
        </div>
      </div>
    </article>
  );
}
