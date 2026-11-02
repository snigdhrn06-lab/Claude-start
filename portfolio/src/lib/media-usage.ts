/** Finds where each media item is used (content references + site settings). */
import { isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { loadSettings } from "@/lib/content/queries";

export async function mediaUsage(): Promise<Map<string, string[]>> {
  const db = getDb();
  const usage = new Map<string, string[]>();
  const add = (id: string | null, label: string) => {
    if (!id) return;
    usage.set(id, [...(usage.get(id) ?? []), label]);
  };
  const [projects, gallery, achievements, research, resources, settings] = await Promise.all([
    db.select({ id: schema.projects.id, title: schema.projects.title, cover: schema.projects.coverMediaId }).from(schema.projects),
    db.select({ projectId: schema.projectMedia.projectId, mediaId: schema.projectMedia.mediaId }).from(schema.projectMedia),
    db.select({ event: schema.achievements.event, a: schema.achievements.mediaId, b: schema.achievements.documentMediaId }).from(schema.achievements),
    db.select({ title: schema.research.title, paper: schema.research.paperMediaId }).from(schema.research).where(isNotNull(schema.research.paperMediaId)),
    db.select({ title: schema.resources.title, m: schema.resources.mediaId }).from(schema.resources),
    loadSettings(),
  ]);
  const titles = new Map(projects.map((p) => [p.id, p.title]));
  projects.forEach((p) => add(p.cover, `Cover: ${p.title}`));
  gallery.forEach((g) => add(g.mediaId, `Gallery: ${titles.get(g.projectId) ?? "project"}`));
  achievements.forEach((a) => (add(a.a, `Achievement: ${a.event}`), add(a.b, `Achievement doc: ${a.event}`)));
  research.forEach((r) => add(r.paper, `Paper: ${r.title}`));
  resources.forEach((r) => add(r.m, `Resource: ${r.title}`));
  add(settings.portraitPrimaryId, "Site settings: primary portrait");
  add(settings.portraitSecondaryId, "Site settings: second photo");
  add(settings.resumeMediaId, "Site settings: résumé");
  add(settings.ogImageId, "Site settings: social image");
  return usage;
}
