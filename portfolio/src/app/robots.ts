import type { MetadataRoute } from "next";
import { getSettingsSafe, resolveSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = resolveSiteUrl(await getSettingsSafe());
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }], sitemap: `${base}/sitemap.xml`, host: base };
}
