import { notFound } from "next/navigation";
import { EntityList, type ListRow } from "@/components/admin/EntityList";
import { ENTITIES, isEntityKey } from "@/lib/content/registry";
import { listEntities } from "@/lib/content/repo";

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return { title: isEntityKey(entity) ? ENTITIES[entity].label : "Not found" };
}

export default async function EntityListPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isEntityKey(entity)) notFound();
  const cfg = ENTITIES[entity];
  const rows = await listEntities(entity);
  const listRows: ListRow[] = rows.map((r) => ({
    id: r.id,
    title: String(r[cfg.titleField] ?? ""),
    subtitle: (cfg.subtitleFields ?? []).map((f) => r[f]).filter(Boolean).join(" · "),
    status: String(r.status ?? "published"),
    featured: !!r.featured,
    updatedAt: (r.updatedAt as Date).toISOString(),
    publicPath: cfg.publicPath?.(r) ?? null,
  }));
  return <EntityList key={entity} entity={entity} initialRows={listRows} />;
}
