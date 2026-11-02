/**
 * Generic admin data access for every content type in the registry.
 * Validation happens here (zod), so every write path — API, seed, tests — gets the same rules.
 */
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import { ApiError } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { slugify } from "@/lib/utils";
import type { EntityKey } from "./registry";
import {
  achievementSchema,
  educationSchema,
  experienceSchema,
  projectSchema,
  researchSchema,
  resourceSchema,
  skillCategorySchema,
  skillSchema,
  socialLinkSchema,
} from "./schemas";

type AnyTable = PgTable & { id: ReturnType<typeof sql>; sortOrder: ReturnType<typeof sql>; updatedAt: ReturnType<typeof sql> };

const TABLES = {
  projects: { table: schema.projects, schema: projectSchema },
  research: { table: schema.research, schema: researchSchema },
  achievements: { table: schema.achievements, schema: achievementSchema },
  experience: { table: schema.experience, schema: experienceSchema },
  education: { table: schema.education, schema: educationSchema },
  skills: { table: schema.skills, schema: skillSchema },
  "skill-categories": { table: schema.skillCategories, schema: skillCategorySchema },
  "social-links": { table: schema.socialLinks, schema: socialLinkSchema },
  resources: { table: schema.resources, schema: resourceSchema },
} satisfies Record<EntityKey, { table: PgTable; schema: ZodType }>;

// Drizzle's table types differ per table; the generic layer works with a common shape.
function t(key: EntityKey) {
  return TABLES[key].table as unknown as AnyTable & Record<string, never>;
}

export type Row = Record<string, unknown> & { id: string };

export async function listEntities(key: EntityKey): Promise<Row[]> {
  const table = t(key);
  const rows = await getDb().select().from(table).orderBy(asc(table.sortOrder), desc(table.updatedAt));
  return rows as Row[];
}

export async function getEntity(key: EntityKey, id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const table = t(key);
  const [row] = await getDb().select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) return null;
  if (key === "projects") {
    const gallery = await getDb()
      .select({ mediaId: schema.projectMedia.mediaId, caption: schema.projectMedia.caption })
      .from(schema.projectMedia)
      .where(eq(schema.projectMedia.projectId, id))
      .orderBy(asc(schema.projectMedia.sortOrder));
    return { ...(row as Row), gallery };
  }
  return row as Row;
}

async function uniqueSlug(key: "projects" | "research", wanted: string, excludeId?: string) {
  const table = key === "projects" ? schema.projects : schema.research;
  const base = slugify(wanted) || "item";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await getDb()
      .select({ id: table.id })
      .from(table)
      .where(excludeId ? and(eq(table.slug, candidate), ne(table.id, excludeId)) : eq(table.slug, candidate))
      .limit(1);
    if (!clash.length) return candidate;
  }
  throw new ApiError(409, "Could not find a free URL slug");
}

async function nextSortOrder(key: EntityKey) {
  const table = t(key);
  const [row] = await getDb().select({ max: sql<number>`coalesce(max(${table.sortOrder}), 0)` }).from(table);
  return Number(row?.max ?? 0) + 10;
}

/** Parses + normalises input for a content type. Throws ZodError on invalid data. */
export function parseInput(key: EntityKey, input: unknown) {
  return TABLES[key].schema.parse(input) as Record<string, unknown>;
}

async function verifyReferences(data: Record<string, unknown>) {
  const mediaIds = ["coverMediaId", "mediaId", "documentMediaId", "paperMediaId"]
    .map((f) => data[f])
    .filter((v): v is string => typeof v === "string");
  const gallery = (data.gallery as { mediaId: string }[] | undefined)?.map((g) => g.mediaId) ?? [];
  const all = [...new Set([...mediaIds, ...gallery])];
  if (all.length) {
    const found = await getDb().select({ id: schema.media.id }).from(schema.media).where(inArray(schema.media.id, all));
    if (found.length !== all.length) throw new ApiError(400, "One of the selected files no longer exists. Pick it again.");
  }
}

async function writeGallery(projectId: string, gallery: { mediaId: string; caption: string }[]) {
  const db = getDb();
  await db.delete(schema.projectMedia).where(eq(schema.projectMedia.projectId, projectId));
  const seen = new Set<string>();
  const rows = gallery
    .filter((g) => (seen.has(g.mediaId) ? false : (seen.add(g.mediaId), true)))
    .map((g, i) => ({ projectId, mediaId: g.mediaId, caption: g.caption, sortOrder: i }));
  if (rows.length) await db.insert(schema.projectMedia).values(rows);
}

export async function createEntity(key: EntityKey, input: unknown): Promise<Row> {
  const data = parseInput(key, input);
  await verifyReferences(data);
  const { gallery, ...values } = data as Record<string, unknown> & { gallery?: { mediaId: string; caption: string }[] };
  if (key === "projects" || key === "research") values.slug = await uniqueSlug(key, (values.slug as string) || (values.title as string));
  if (values.sortOrder === undefined) values.sortOrder = await nextSortOrder(key);
  const [row] = await getDb().insert(t(key)).values(values as never).returning();
  if (key === "projects" && gallery) await writeGallery((row as Row).id, gallery);
  return row as Row;
}

export async function updateEntity(key: EntityKey, id: string, input: unknown): Promise<Row> {
  const existing = await getEntity(key, id);
  if (!existing) throw new ApiError(404, "Not found");
  const data = parseInput(key, input);
  await verifyReferences(data);
  const { gallery, ...values } = data as Record<string, unknown> & { gallery?: { mediaId: string; caption: string }[] };
  if (key === "projects" || key === "research") values.slug = await uniqueSlug(key, (values.slug as string) || (values.title as string), id);
  if (values.sortOrder === undefined) delete values.sortOrder;
  const table = t(key);
  const [row] = await getDb().update(table).set(values as never).where(eq(table.id, id)).returning();
  if (key === "projects" && gallery) await writeGallery(id, gallery);
  return row as Row;
}

export async function deleteEntity(key: EntityKey, id: string): Promise<Row> {
  const existing = await getEntity(key, id);
  if (!existing) throw new ApiError(404, "Not found");
  const table = t(key);
  await getDb().delete(table).where(eq(table.id, id));
  return existing;
}

/** Sets sort_order from the given id order (10, 20, 30 …). */
export async function reorderEntities(key: EntityKey, ids: string[]) {
  const table = t(key);
  const db = getDb();
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(table).set({ sortOrder: (i + 1) * 10 } as never).where(eq(table.id, ids[i]!));
    }
  });
}

export async function logActivity(entity: string, action: string, label: string, entityId?: string | null) {
  try {
    await getDb().insert(schema.activityLog).values({ entity, action, label: label.slice(0, 200), entityId: entityId ?? null });
  } catch (err) {
    console.warn("[activity] could not log:", (err as Error).message);
  }
}

export function entityLabel(key: EntityKey, row: Record<string, unknown>) {
  const titleKey = { projects: "title", research: "title", achievements: "event", experience: "role", education: "institution", skills: "name", "skill-categories": "name", "social-links": "label", resources: "title" }[key];
  return String(row[titleKey] ?? "");
}
