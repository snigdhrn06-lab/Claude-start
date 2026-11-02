/**
 * Public read layer. Everything the public site renders comes from getSiteData().
 *
 * Freshness: public pages query PostgreSQL on every request (about ten small queries run in
 * parallel, typically a few milliseconds). Results are memoised per request with React's cache(),
 * so the layout, page and metadata share one load. There is deliberately no persistent data cache:
 * admin edits, database restores and redeploys are reflected immediately on every instance.
 * Only PUBLISHED rows are ever returned from here.
 */
import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/lib/db/client";
import { toPublicMedia, type PublicMedia } from "@/lib/media-url";
import { parseSettings, settingsMediaIds, type SiteSettings } from "./settings";

export const CONTENT_TAG = "content";
const PUBLIC_BASE = () => (process.env.STORAGE_DRIVER === "s3" ? process.env.S3_PUBLIC_URL || null : null);

const published = <T extends { status: unknown }>(table: T) => eq(table.status as never, "published");

export async function loadSettings(): Promise<SiteSettings> {
  const [row] = await getDb().select().from(schema.siteSettings).where(eq(schema.siteSettings.id, 1)).limit(1);
  return parseSettings(row?.data);
}

async function loadMedia(ids: (string | null | undefined)[]): Promise<Record<string, PublicMedia>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (!unique.length) return {};
  const rows = await getDb().select().from(schema.media).where(inArray(schema.media.id, unique));
  return Object.fromEntries(rows.map((r) => [r.id, toPublicMedia(r, PUBLIC_BASE())]));
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

async function querySiteData() {
  const db = getDb();
  const [settings, projects, research, achievements, experience, education, categories, skills, socialLinks, resources] = await Promise.all([
    loadSettings(),
    db.select().from(schema.projects).where(published(schema.projects)).orderBy(desc(schema.projects.featured), asc(schema.projects.sortOrder)),
    db.select().from(schema.research).where(published(schema.research)).orderBy(desc(schema.research.featured), asc(schema.research.sortOrder)),
    db.select().from(schema.achievements).where(published(schema.achievements)).orderBy(asc(schema.achievements.sortOrder)),
    db.select().from(schema.experience).where(published(schema.experience)).orderBy(asc(schema.experience.sortOrder)),
    db.select().from(schema.education).where(published(schema.education)).orderBy(asc(schema.education.sortOrder)),
    db.select().from(schema.skillCategories).where(published(schema.skillCategories)).orderBy(asc(schema.skillCategories.sortOrder)),
    db.select().from(schema.skills).where(published(schema.skills)).orderBy(asc(schema.skills.sortOrder)),
    db.select().from(schema.socialLinks).where(published(schema.socialLinks)).orderBy(asc(schema.socialLinks.sortOrder)),
    db.select().from(schema.resources).where(published(schema.resources)).orderBy(asc(schema.resources.sortOrder)),
  ]);

  const projectIds = projects.map((p) => p.id);
  const gallery = projectIds.length
    ? await db.select().from(schema.projectMedia).where(inArray(schema.projectMedia.projectId, projectIds)).orderBy(asc(schema.projectMedia.sortOrder))
    : [];

  const media = await loadMedia([
    ...settingsMediaIds(settings),
    ...projects.map((p) => p.coverMediaId),
    ...gallery.map((g) => g.mediaId),
    ...research.map((r) => r.paperMediaId),
    ...achievements.flatMap((a) => [a.mediaId, a.documentMediaId]),
    ...resources.map((r) => r.mediaId),
  ]);

  const publishedProjectSlugs = new Map(projects.map((p) => [p.id, { slug: p.slug, title: p.title }]));

  return {
    settings,
    media,
    projects: projects.map((p) => ({
      ...p,
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
      gallery: gallery.filter((g) => g.projectId === p.id && media[g.mediaId]).map((g) => ({ mediaId: g.mediaId, caption: g.caption })),
    })),
    research: research.map((r) => ({ ...r, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) })),
    achievements: achievements.map((a) => ({ ...a, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt) })),
    experience: experience.map((e) => ({ ...e, createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt) })),
    education: education.map((e) => ({ ...e, createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt) })),
    skillCategories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      skills: skills
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({ id: s.id, name: s.name, evidence: s.evidence, project: s.projectId ? publishedProjectSlugs.get(s.projectId) ?? null : null })),
    })),
    socialLinks: socialLinks.map((l) => ({ id: l.id, label: l.label, url: l.url, icon: l.icon })),
    resources: resources.map((r) => ({ id: r.id, title: r.title, description: r.description, mediaId: r.mediaId, externalUrl: r.externalUrl })),
  };
}

export type SiteData = Awaited<ReturnType<typeof querySiteData>>;
export type PublicProject = SiteData["projects"][number];
export type PublicResearch = SiteData["research"][number];
export type PublicAchievement = SiteData["achievements"][number];
export type PublicExperience = SiteData["experience"][number];
export type PublicEducation = SiteData["education"][number];

export const getSiteData = cache(querySiteData);

/** Draft-inclusive lookups for admin previews (uncached, only called after an admin check). */
export async function getProjectPreview(slug: string) {
  const db = getDb();
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.slug, slug)).limit(1);
  if (!p) return null;
  const gallery = await db.select().from(schema.projectMedia).where(eq(schema.projectMedia.projectId, p.id)).orderBy(asc(schema.projectMedia.sortOrder));
  const media = await loadMedia([p.coverMediaId, ...gallery.map((g) => g.mediaId)]);
  return {
    project: { ...p, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt), gallery: gallery.filter((g) => media[g.mediaId]).map((g) => ({ mediaId: g.mediaId, caption: g.caption })) },
    media,
  };
}

export async function getResearchPreview(slug: string) {
  const [r] = await getDb().select().from(schema.research).where(eq(schema.research.slug, slug)).limit(1);
  if (!r) return null;
  const media = await loadMedia([r.paperMediaId]);
  return { research: { ...r, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) }, media };
}
