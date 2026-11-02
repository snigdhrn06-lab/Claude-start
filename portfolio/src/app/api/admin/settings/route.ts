/** Site settings: GET current, PUT replace (validated). */
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { logActivity } from "@/lib/content/repo";
import { siteSettingsSchema } from "@/lib/content/settings";
import { loadSettings } from "@/lib/content/queries";
import { getDb, schema } from "@/lib/db/client";
import { revalidateContent } from "@/lib/revalidate";

export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return json({ settings: await loadSettings() });
});

export const PUT = handle(async (request: Request) => {
  await requireAdmin(request);
  const data = siteSettingsSchema.parse(await readJson(request));
  await getDb().insert(schema.siteSettings).values({ id: 1, data }).onConflictDoUpdate({ target: schema.siteSettings.id, set: { data, updatedAt: new Date() } });
  await logActivity("settings", "updated", "Site settings");
  revalidateContent();
  return json({ settings: data });
});
