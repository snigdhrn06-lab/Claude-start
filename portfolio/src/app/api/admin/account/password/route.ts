/** Change the signed-in admin's password (requires the current one). Signs out other sessions. */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { passwordSchema } from "@/lib/content/schemas";
import { logActivity } from "@/lib/content/repo";
import { getDb, schema } from "@/lib/db/client";

export const POST = handle(async (request: Request) => {
  const session = await requireAdmin(request);
  const body = z.object({ current: z.string().max(200), next: passwordSchema }).parse(await readJson(request));
  const [admin] = await getDb().select().from(schema.admins).where(eq(schema.admins.id, session.adminId));
  if (!admin || !(await verifyPassword(body.current, admin.passwordHash))) throw new ApiError(400, "Your current password is incorrect.", { current: "Incorrect password" });
  await getDb().update(schema.admins).set({ passwordHash: await hashPassword(body.next) }).where(eq(schema.admins.id, admin.id));
  await destroyAllSessions(admin.id, session.sessionId);
  await logActivity("account", "updated", "Password changed");
  return json({ ok: true });
});
