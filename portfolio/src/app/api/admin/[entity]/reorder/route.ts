import { z } from "zod";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { isEntityKey } from "@/lib/content/registry";
import { logActivity, reorderEntities } from "@/lib/content/repo";
import { revalidateContent } from "@/lib/revalidate";

export const POST = handle(async (request: Request, ctx: { params: Promise<{ entity: string }> }) => {
  await requireAdmin(request);
  const { entity } = await ctx.params;
  if (!isEntityKey(entity)) throw new ApiError(404, "Unknown content type");
  const { ids } = z.object({ ids: z.array(z.uuid()).max(500) }).parse(await readJson(request));
  await reorderEntities(entity, ids);
  await logActivity(entity, "reordered", `${ids.length} items`);
  revalidateContent();
  return json({ ok: true });
});
