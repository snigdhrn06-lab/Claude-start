/** Home page: hero, highlights ticker, then the sections in the order set in Admin → Site settings → Sections. */
import { headers } from "next/headers";
import { About } from "@/components/site/About";
import { Achievements } from "@/components/site/Achievements";
import { Contact } from "@/components/site/Contact";
import { Experience } from "@/components/site/Experience";
import { Hero } from "@/components/site/Hero";
import { Projects } from "@/components/site/Projects";
import { Research } from "@/components/site/Research";
import { Skills } from "@/components/site/Skills";
import { Ticker } from "@/components/site/Ticker";
import { getSiteData } from "@/lib/content/queries";
import type { SectionKey } from "@/lib/content/settings";
import { resolveSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getSiteData();
  const s = data.settings;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const hasResume = !!(s.resumeMediaId && data.media[s.resumeMediaId]);

  // Only render sections that are visible AND have content, then number them in order.
  const hasContent: Record<SectionKey, boolean> = {
    about: true,
    research: data.research.length > 0,
    projects: data.projects.length > 0,
    achievements: data.achievements.length > 0,
    experience: data.experience.length + data.education.length > 0,
    skills: data.skillCategories.some((c) => c.skills.length > 0),
    contact: true,
  };
  const order = s.sections.filter((x) => x.visible && hasContent[x.key]).map((x) => x.key);
  const n = (k: SectionKey) => order.indexOf(k) + 1;
  const has = (k: SectionKey) => order.includes(k);

  const sections: Record<SectionKey, React.ReactNode> = {
    about: <About key="about" index={n("about")} s={s} primary={s.portraitPrimaryId ? data.media[s.portraitPrimaryId] : undefined} secondary={s.portraitSecondaryId ? data.media[s.portraitSecondaryId] : undefined} />,
    research: <Research key="research" index={n("research")} s={s} items={data.research} />,
    projects: <Projects key="projects" index={n("projects")} s={s} projects={data.projects} media={data.media} />,
    achievements: <Achievements key="achievements" index={n("achievements")} s={s} items={data.achievements} media={data.media} />,
    experience: <Experience key="experience" index={n("experience")} s={s} experience={data.experience} education={data.education} />,
    skills: <Skills key="skills" index={n("skills")} s={s} categories={data.skillCategories} />,
    contact: <Contact key="contact" index={n("contact")} s={s} hasResume={hasResume} social={data.socialLinks} />,
  };

  const siteUrl = resolveSiteUrl(s);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: s.name,
    url: siteUrl,
    email: s.email ? `mailto:${s.email}` : undefined,
    jobTitle: s.roleLine.split("·")[0]?.trim() || undefined,
    address: s.location ? { "@type": "PostalAddress", addressLocality: s.location } : undefined,
    sameAs: [s.linkedinUrl, ...data.socialLinks.filter((l) => l.url.startsWith("http")).map((l) => l.url)].filter(Boolean),
    alumniOf: data.education.map((e) => ({ "@type": "EducationalOrganization", name: e.institution })),
    image: s.portraitPrimaryId && data.media[s.portraitPrimaryId] ? `${siteUrl}${data.media[s.portraitPrimaryId]!.url}` : undefined,
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero
        name={s.name}
        roleLine={s.roleLine}
        location={s.location}
        headline={s.headline || s.name}
        intro={s.heroIntro}
        stats={s.heroStats.filter((x) => x.value)}
        links={{ work: has("projects") ? "#projects" : has("research") ? "#research" : undefined, achievements: has("achievements") ? "#achievements" : undefined, contact: has("contact") ? "#contact" : undefined }}
      />
      {s.showTicker && <Ticker items={data.achievements.filter((a) => a.featured).map((a) => ({ title: a.title, event: a.event }))} />}
      {order.map((k) => sections[k])}
    </>
  );
}
