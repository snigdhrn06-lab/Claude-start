/**
 * Idempotent content seed.
 *
 * Each seed item has a stable key. A key is inserted at most once and recorded in seed_log, so:
 *  - re-running never duplicates content,
 *  - content edited in the admin portal is never overwritten,
 *  - content deleted in the admin portal is never re-created.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { getDb, getPool, schema } from "@/lib/db/client";
import { createEntity } from "@/lib/content/repo";
import { siteSettingsSchema } from "@/lib/content/settings";
import { storeUpload } from "@/lib/media";
import * as content from "../../../seed/content";

const LOCK_ID = 727_271_002;

type Log = (msg: string) => void;

async function seeded(): Promise<Map<string, string | null>> {
  const rows = await getDb().select().from(schema.seedLog);
  return new Map(rows.map((r) => [r.key, r.ref]));
}

async function mark(key: string, ref: string | null) {
  await getDb().insert(schema.seedLog).values({ key, ref }).onConflictDoNothing();
}

/** Replaces "{{media:x}}" / "{{project:x}}" placeholders with seeded ids (or "" if unavailable). */
function resolveRefs<T>(value: T, refs: Map<string, string | null>): T {
  const json = JSON.stringify(value).replace(/"\{\{([^}]+)\}\}"/g, (_m, key: string) => {
    const ref = refs.get(key);
    return ref ? JSON.stringify(ref) : '""';
  });
  return JSON.parse(json) as T;
}

export async function runSeed({ assetsDir = path.resolve(process.cwd(), "seed", "assets"), log = console.log as Log } = {}) {
  const client = await getPool().connect();
  const counts = { inserted: 0, skipped: 0 };
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    const refs = await seeded();
    const db = getDb();

    const once = async (key: string, fn: () => Promise<string | null>) => {
      if (refs.has(key)) {
        counts.skipped++;
        return;
      }
      const ref = await fn();
      await mark(key, ref);
      refs.set(key, ref);
      counts.inserted++;
    };

    // 1. Media assets
    for (const m of content.MEDIA) {
      const file = path.join(assetsDir, m.file);
      if (!existsSync(file)) {
        if (!refs.has(m.key)) log(`[seed] asset missing, skipped for now: ${m.file}`);
        continue; // not marked: it will be picked up if the file is added later
      }
      await once(m.key, async () => (await storeUpload({ data: readFileSync(file), filename: m.file, alt: m.alt })).id);
    }

    // 2. Site settings (only if no settings row exists yet)
    await once("settings", async () => {
      const [existing] = await db.select({ id: schema.siteSettings.id }).from(schema.siteSettings).where(eq(schema.siteSettings.id, 1));
      if (existing) return "1";
      const data = siteSettingsSchema.parse(resolveRefs(content.SETTINGS, refs));
      await db.insert(schema.siteSettings).values({ id: 1, data });
      return "1";
    });

    // 3. Content collections
    const insertAll = async (key: Parameters<typeof createEntity>[0], items: { key: string; data: Record<string, unknown> }[]) => {
      for (const item of items) {
        await once(item.key, async () => {
          const data = resolveRefs(item.data, refs);
          if (Array.isArray(data.gallery)) data.gallery = (data.gallery as { mediaId: string }[]).filter((g) => g.mediaId);
          return (await createEntity(key, data)).id;
        });
      }
    };
    await insertAll("projects", content.PROJECTS);
    await insertAll("research", content.RESEARCH);
    await insertAll("achievements", content.ACHIEVEMENTS);
    await insertAll("education", content.EDUCATION);
    await insertAll("experience", content.EXPERIENCE);
    await insertAll("social-links", content.SOCIAL_LINKS);

    for (const cat of content.SKILLS) {
      await once(cat.key, async () => (await createEntity("skill-categories", { name: cat.name, description: cat.description, status: "published" })).id);
      const categoryId = refs.get(cat.key) ?? null;
      // Skip skills if their category was deleted by the admin.
      const catExists = categoryId
        ? (await db.select({ id: schema.skillCategories.id }).from(schema.skillCategories).where(inArray(schema.skillCategories.id, [categoryId]))).length > 0
        : false;
      for (const [name, evidence, projectKey] of cat.skills) {
        await once(`skill:${cat.key}:${name}`, async () => {
          if (!catExists) return null;
          const projectId = projectKey ? refs.get(projectKey) ?? null : null;
          const projectOk = projectId
            ? (await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.id, projectId))).length > 0
            : false;
          return (await createEntity("skills", { name, evidence, categoryId, projectId: projectOk ? projectId : null, status: "published" })).id;
        });
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
  log(`[seed] done: ${counts.inserted} inserted, ${counts.skipped} already present`);
  return counts;
}
