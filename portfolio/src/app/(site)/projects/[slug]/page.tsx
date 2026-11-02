/** Project detail page. Drafts are visible only to a signed-in admin (preview mode). */
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { SplitWords } from "@/components/motion/SplitWords";
import { Markdown } from "@/components/shared/Markdown";
import { ProjectCover, coverMediaFor } from "@/components/site/ProjectCover";
import { ProjectGallery } from "@/components/site/ProjectGallery";
import { getCurrentSession } from "@/lib/auth/session";
import { getProjectPreview, getSiteData } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const data = await getSiteData();
  const idx = data.projects.findIndex((p) => p.slug === slug);
  if (idx >= 0) return { project: data.projects[idx]!, media: data.media, next: data.projects[(idx + 1) % data.projects.length], preview: false };
  // Not published: allow an admin preview.
  if (await getCurrentSession()) {
    const preview = await getProjectPreview(slug);
    if (preview) return { project: preview.project, media: preview.media, next: undefined, preview: preview.project.status !== "published" };
  }
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteData();
  const p = data.projects.find((x) => x.slug === slug);
  if (!p) return { title: "Project", robots: { index: false } };
  const cover = coverMediaFor(p, data.media);
  return {
    title: p.title,
    description: p.summary,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { title: p.title, description: p.summary, type: "article", images: cover ? [{ url: cover.variants.at(-1)?.url ?? cover.url, width: cover.width ?? undefined, height: cover.height ?? undefined, alt: cover.alt }] : undefined },
  };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal className="grid gap-4 border-t border-line/[0.08] py-10 md:grid-cols-12 md:gap-8">
      <h2 className="label md:col-span-3 md:pt-1.5">{title}</h2>
      <div className="md:col-span-9">{children}</div>
    </Reveal>
  );
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const loaded = await load(slug);
  if (!loaded) notFound();
  const { project: p, media, next, preview } = loaded;
  const accent = p.accent || undefined;
  const gallery = p.gallery.map((g) => ({ media: media[g.mediaId]!, caption: g.caption })).filter((g) => g.media);

  return (
    <article style={accent ? ({ "--p-accent": accent } as React.CSSProperties) : undefined} className="pb-24 pt-[calc(var(--nav-h)+2.5rem)]">
      {preview && (
        <div className="container mb-6">
          <p className="rounded-xl border border-dashed border-accent/50 px-4 py-3 text-sm text-accent">Draft preview: only you can see this page because you&apos;re signed in to the admin portal.</p>
        </div>
      )}
      <div className="container">
        <Link href="/#projects" className="label inline-flex items-center gap-2 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All projects
        </Link>
        <header className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            {p.category && <p className="label mb-6" style={{ color: accent }}>{p.category}</p>}
            <SplitWords as="h1" immediate text={p.title} className="display text-[clamp(2.8rem,8vw,7rem)]" />
          </div>
          {p.summary && <p className="text-lg leading-relaxed text-muted lg:col-span-4 lg:pb-3">{p.summary}</p>}
        </header>

        <dl className="mt-12 grid grid-cols-2 gap-6 border-y border-line/[0.08] py-6 text-sm md:grid-cols-4">
          {p.role && (
            <div>
              <dt className="label">Role</dt>
              <dd className="mt-1.5 text-fg/90">{p.role}</dd>
            </div>
          )}
          {p.year && (
            <div>
              <dt className="label">Year</dt>
              <dd className="mt-1.5 text-fg/90">{p.year}</dd>
            </div>
          )}
          {(p.liveUrl || p.repoUrl) && (
            <div className="col-span-2">
              <dt className="label">Links</dt>
              <dd className="mt-1.5 flex flex-wrap gap-4">
                {p.liveUrl && (
                  <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg underline decoration-line/30 underline-offset-4 hover:decoration-accent">
                    Live site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
                {p.repoUrl && (
                  <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg underline decoration-line/30 underline-offset-4 hover:decoration-accent">
                    Source code <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
              </dd>
            </div>
          )}
        </dl>

        <Reveal className="mt-12 overflow-hidden rounded-[2rem] border border-line/10">
          <div className="aspect-[16/9]">
            <ProjectCover project={p} media={media} sizes="100vw" priority />
          </div>
        </Reveal>

        {p.disclaimer && (
          <p className="mt-6 flex items-start gap-3 rounded-xl border border-line/10 bg-surface/60 px-4 py-3 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {p.disclaimer}
          </p>
        )}

        <div className="mt-16">
          {p.description && (
            <Block title="Overview">
              <Markdown className="!text-lg">{p.description}</Markdown>
            </Block>
          )}
          {p.problem && (
            <Block title="The problem">
              <Markdown>{p.problem}</Markdown>
            </Block>
          )}
          {p.solution && (
            <Block title="What I built">
              <Markdown>{p.solution}</Markdown>
            </Block>
          )}
          {p.contribution && (
            <Block title="My contribution">
              <Markdown>{p.contribution}</Markdown>
            </Block>
          )}
          {p.outcomes.length > 0 && (
            <Block title="Outcomes">
              <ul className="space-y-3">
                {p.outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-3 text-[1.05rem] text-fg/90">
                    <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: accent ?? "rgb(var(--accent))" }} aria-hidden /> {o}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {gallery.length > 0 && (
            <Block title="Gallery">
              <ProjectGallery items={gallery} />
            </Block>
          )}
          {p.caseStudy && (
            <Block title="Case study">
              <Markdown>{p.caseStudy}</Markdown>
            </Block>
          )}
          {p.techStack.length > 0 && (
            <Block title="Technology">
              <ul className="flex flex-wrap gap-2">
                {p.techStack.map((t) => (
                  <li key={t} className="rounded-full border border-line/15 px-3.5 py-1.5 font-mono text-xs text-muted">
                    {t}
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>

        {next && next.id !== p.id && (
          <Link href={`/projects/${next.slug}`} className="group mt-20 block border-t border-line/[0.08] pt-10" data-cursor="Next">
            <p className="label">Next project</p>
            <p className="display mt-4 flex items-center gap-4 text-[clamp(2.2rem,6vw,5rem)] transition-colors group-hover:text-accent">
              {next.title} <ArrowRight className="h-8 w-8 transition-transform group-hover:translate-x-2 md:h-12 md:w-12" aria-hidden />
            </p>
          </Link>
        )}
      </div>
    </article>
  );
}
