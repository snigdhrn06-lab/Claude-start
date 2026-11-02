import type { MetadataRoute } from "next";
import { getSiteData } from "@/lib/content/queries";
import { resolveSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Published content only. Drafts and admin pages never appear here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSiteData();
  const base = resolveSiteUrl(data.settings);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...data.projects.map((p) => ({ url: `${base}/projects/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...data.research.map((r) => ({ url: `${base}/research/${r.slug}`, lastModified: new Date(r.updatedAt), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
