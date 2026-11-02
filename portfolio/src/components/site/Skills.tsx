/** Skills grouped by category, each with the evidence behind it. No ratings. */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import type { SiteData } from "@/lib/content/queries";
import type { SiteSettings } from "@/lib/content/settings";
import { SectionHeader } from "./SectionHeader";

export function Skills({ index, s, categories }: { index: number; s: SiteSettings; categories: SiteData["skillCategories"] }) {
  const cats = categories.filter((c) => c.skills.length);
  if (!cats.length) return null;
  const copy = s.sectionCopy.skills;
  return (
    <section id="skills" className="relative border-t border-line/[0.06] py-24 md:py-36">
      <div className="container">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Skills"} title={copy.title} intro={copy.intro} />
        <div className="border-t border-line/[0.08]">
          {cats.map((c, ci) => (
            <div key={c.id} className="grid gap-6 border-b border-line/[0.08] py-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-4">
                <p className="font-mono text-xs text-accent">{String(ci + 1).padStart(2, "0")}</p>
                <h3 className="display mt-3 text-4xl">{c.name}</h3>
                {c.description && <p className="mt-3 max-w-xs text-sm text-muted">{c.description}</p>}
              </Reveal>
              <ul className="grid gap-x-8 sm:grid-cols-2 lg:col-span-8">
                {c.skills.map((sk, i) => (
                  <Reveal as="li" key={sk.id} delay={(i % 4) * 0.04} className="border-t border-line/[0.06] py-4 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                    <p className="text-[1.02rem] text-fg">{sk.name}</p>
                    {sk.evidence && <p className="mt-1 text-sm leading-snug text-muted">{sk.evidence}</p>}
                    {sk.project && (
                      <Link href={`/projects/${sk.project.slug}`} className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-label text-dim transition-colors hover:text-accent">
                        Seen in: {sk.project.title} <ArrowUpRight className="h-3 w-3" aria-hidden />
                      </Link>
                    )}
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
