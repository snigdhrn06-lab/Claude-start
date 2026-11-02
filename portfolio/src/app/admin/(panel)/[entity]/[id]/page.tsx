import { notFound } from "next/navigation";
import { EntityForm } from "@/components/admin/EntityForm";
import type { RelationOptions, Values } from "@/components/admin/fields";
import { ENTITIES, isEntityKey } from "@/lib/content/registry";
import { getEntity, listEntities } from "@/lib/content/repo";

type Params = { params: Promise<{ entity: string; id: string }> };

export async function generateMetadata({ params }: Params) {
  const { entity, id } = await params;
  if (!isEntityKey(entity)) return { title: "Not found" };
  return { title: id === "new" ? `New ${ENTITIES[entity].singular.toLowerCase()}` : `Edit ${ENTITIES[entity].singular.toLowerCase()}` };
}

export default async function EntityEditPage({ params }: Params) {
  const { entity, id } = await params;
  if (!isEntityKey(entity)) notFound();
  const cfg = ENTITIES[entity];
  const row = id === "new" ? null : await getEntity(entity, id);
  if (id !== "new" && !row) notFound();

  // Options for relation fields (e.g. a skill's category and project).
  const relations: RelationOptions = {};
  for (const f of cfg.fields) {
    if (f.type === "relation" && f.relation && !relations[f.relation]) {
      const rel = ENTITIES[f.relation];
      relations[f.relation] = (await listEntities(f.relation)).map((r) => ({ value: r.id, label: `${String(r[rel.titleField] ?? "")}${r.status === "draft" ? " (draft)" : ""}` }));
    }
  }

  const initial = row ? (JSON.parse(JSON.stringify(row)) as Values) : null;
  return <EntityForm key={id} entity={entity} id={row ? row.id : null} initial={initial} relations={relations} publicPath={row ? cfg.publicPath?.(row) ?? null : null} />;
}
