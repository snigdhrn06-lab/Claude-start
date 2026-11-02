import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb, schema } from "@/lib/db/client";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const id = z.uuid().parse((await ctx.params).id);
  const { read } = z.object({ read: z.boolean() }).parse(await readJson(request));
  const [row] = await getDb().update(schema.contactMessages).set({ read }).where(eq(schema.contactMessages.id, id)).returning({ id: schema.contactMessages.id });
  if (!row) throw new ApiError(404, "Not found");
  return json({ ok: true });
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  await requireAdmin(request);
  const id = z.uuid().parse((await ctx.params).id);
  await getDb().delete(schema.contactMessages).where(eq(schema.contactMessages.id, id));
  return json({ ok: true });
});
