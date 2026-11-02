import { cookies } from "next/headers";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export const POST = handle(async (request: Request) => {
  const session = await requireAdmin(request);
  await destroySession(session.sessionId);
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});
