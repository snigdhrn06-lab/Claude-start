/** Site-level helpers used by layouts, metadata, sitemap and OG images. */
import "server-only";
import { getSiteData } from "@/lib/content/queries";
import { parseSettings, type SiteSettings } from "@/lib/content/settings";

/** Settings that never throw: if the database is unreachable the shell still renders with defaults. */
export async function getSettingsSafe(): Promise<SiteSettings> {
  try {
    return (await getSiteData()).settings;
  } catch (err) {
    console.error("[site] could not load settings:", (err as Error).message);
    return parseSettings({});
  }
}

/** Canonical base URL: admin setting → SITE_URL → Render's automatic RENDER_EXTERNAL_URL → localhost. */
export function resolveSiteUrl(settings?: Pick<SiteSettings, "siteUrl"> | null): string {
  const url = settings?.siteUrl || process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
