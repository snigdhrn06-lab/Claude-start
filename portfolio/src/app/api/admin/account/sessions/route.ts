/** Sign out every other session for this admin. */
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { destroyAllSessions } from "@/lib/auth/session";

export const DELETE = handle(async (request: Request) => {
  const session = await requireAdmin(request);
  await destroyAllSessions(session.adminId, session.sessionId);
  return json({ ok: true });
});
