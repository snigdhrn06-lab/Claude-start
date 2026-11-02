/** Generic admin collection endpoint: GET list, POST create. */
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { isEntityKey } from "@/lib/content/registry";
import { createEntity, entityLabel, listEntities, logActivity } from "@/lib/content/repo";
import { revalidateContent } from "@/lib/revalidate";

type Ctx = { params: Promise<{ entity: string }> };

async function key(ctx: Ctx) {
  const { entity } = await ctx.params;
  if (!isEntityKey(entity)) throw new ApiError(404, "Unknown content type");
  return entity;
}

export const GET = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  return json({ items: await listEntities(await key(ctx)) });
});

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const entity = await key(ctx);
  const row = await createEntity(entity, await readJson(request));
  await logActivity(entity, "created", entityLabel(entity, row), row.id);
  revalidateContent();
  return json({ item: row }, { status: 201 });
});
