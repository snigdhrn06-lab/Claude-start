/** Update alt text (PATCH) or delete (DELETE) a media item. */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/content/queries";
import { logActivity } from "@/lib/content/repo";
import { getDb, schema } from "@/lib/db/client";
import { deleteMedia } from "@/lib/media";
import { revalidateContent } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  const { alt } = z.object({ alt: z.string().trim().max(300) }).parse(await readJson(request));
  const [row] = await getDb().update(schema.media).set({ alt }).where(eq(schema.media.id, z.uuid().parse(id))).returning();
  if (!row) throw new ApiError(404, "Not found");
  revalidateContent();
  return json({ ok: true });
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const id = z.uuid().parse((await ctx.params).id);
  const row = await deleteMedia(id);
  if (!row) throw new ApiError(404, "Not found");
  // Clear any site-settings references (content references are cleared by foreign keys).
  const settings = await loadSettings();
  let changed = false;
  for (const k of ["portraitPrimaryId", "portraitSecondaryId", "resumeMediaId", "ogImageId"] as const) {
    if (settings[k] === id) {
      settings[k] = null;
      changed = true;
    }
  }
  if (changed) await getDb().update(schema.siteSettings).set({ data: settings }).where(eq(schema.siteSettings.id, 1));
  await logActivity("media", "deleted", row.filename, id);
  revalidateContent();
  return json({ ok: true });
});
