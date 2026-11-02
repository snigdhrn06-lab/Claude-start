/**
 * Server-side sessions stored in Postgres.
 * The browser holds an opaque random token in an HTTP-only cookie; the database stores only its SHA-256.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/lib/db/client";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProd = process.env.NODE_ENV === "production";
/** In production the __Host- prefix forces Secure, Path=/ and no Domain attribute. */
export const SESSION_COOKIE = isProd && process.env.INSECURE_COOKIES !== "true" ? "__Host-srn_admin" : "srn_admin";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export type AdminSession = { adminId: string; email: string; csrfToken: string; sessionId: string };

export async function createSession(adminId: string, userAgent: string | null) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();
  await db.insert(schema.sessions).values({ id: sha256(token), adminId, csrfToken, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  await db.update(schema.admins).set({ lastLoginAt: new Date() }).where(eq(schema.admins.id, adminId));
  // Housekeeping: drop expired sessions.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProd && process.env.INSECURE_COOKIES !== "true",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function getSessionFromToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token || token.length > 200) return null;
  const db = getDb();
  const rows = await db
    .select({ id: schema.sessions.id, adminId: schema.sessions.adminId, csrfToken: schema.sessions.csrfToken, email: schema.admins.email, lastSeenAt: schema.sessions.lastSeenAt })
    .from(schema.sessions)
    .innerJoin(schema.admins, eq(schema.admins.id, schema.sessions.adminId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(schema.sessions).set({ lastSeenAt: new Date() }).where(eq(schema.sessions.id, row.id));
  }
  return { adminId: row.adminId, email: row.email, csrfToken: row.csrfToken, sessionId: row.id };
}

/** Reads the session cookie of the current request (server components, route handlers). */
export async function getCurrentSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return getSessionFromToken(jar.get(SESSION_COOKIE)?.value);
}

export async function destroySession(sessionId: string) {
  await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function destroyAllSessions(adminId: string, exceptSessionId?: string) {
  const db = getDb();
  const all = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.adminId, adminId));
  for (const s of all) if (s.id !== exceptSessionId) await db.delete(schema.sessions).where(eq(schema.sessions.id, s.id));
}
