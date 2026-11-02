/** Generic admin item endpoint: GET, PUT (full update), DELETE. */
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { isEntityKey } from "@/lib/content/registry";
import { deleteEntity, entityLabel, getEntity, logActivity, updateEntity } from "@/lib/content/repo";
import { revalidateContent } from "@/lib/revalidate";

type Ctx = { params: Promise<{ entity: string; id: string }> };

async function parts(ctx: Ctx) {
  const { entity, id } = await ctx.params;
  if (!isEntityKey(entity)) throw new ApiError(404, "Unknown content type");
  return { entity, id };
}

export const GET = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const { entity, id } = await parts(ctx);
  const item = await getEntity(entity, id);
  if (!item) throw new ApiError(404, "Not found");
  return json({ item });
});

export const PUT = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const { entity, id } = await parts(ctx);
  const before = await getEntity(entity, id);
  const row = await updateEntity(entity, id, await readJson(request));
  const action = before && before.status !== row.status ? (row.status === "published" ? "published" : "unpublished") : "updated";
  await logActivity(entity, action, entityLabel(entity, row), id);
  revalidateContent();
  return json({ item: row });
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const { entity, id } = await parts(ctx);
  const row = await deleteEntity(entity, id);
  await logActivity(entity, "deleted", entityLabel(entity, row), id);
  revalidateContent();
  return json({ ok: true });
});
