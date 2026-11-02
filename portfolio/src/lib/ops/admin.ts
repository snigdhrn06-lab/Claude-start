/**
 * Admin account provisioning (used by the CLI and by start-up bootstrap).
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { getDb, schema } from "@/lib/db/client";
import { passwordSchema } from "@/lib/content/schemas";

export async function adminCount() {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(schema.admins);
  return Number(row?.n ?? 0);
}

export async function findAdminByEmail(email: string) {
  const [row] = await getDb().select().from(schema.admins).where(sql`lower(${schema.admins.email}) = lower(${email})`).limit(1);
  return row ?? null;
}

export async function upsertAdmin(email: string, password: string, { reset = false } = {}) {
  const cleanEmail = z.email().parse(email.trim());
  passwordSchema.parse(password);
  const existing = await findAdminByEmail(cleanEmail);
  const db = getDb();
  if (existing) {
    if (!reset) return { action: "exists" as const, id: existing.id };
    await db.update(schema.admins).set({ passwordHash: await hashPassword(password) }).where(eq(schema.admins.id, existing.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.adminId, existing.id)); // sign out everywhere
    return { action: "reset" as const, id: existing.id };
  }
  const [row] = await db.insert(schema.admins).values({ email: cleanEmail, passwordHash: await hashPassword(password) }).returning({ id: schema.admins.id });
  return { action: "created" as const, id: row!.id };
}

/**
 * Start-up bootstrap from ADMIN_EMAIL + ADMIN_PASSWORD.
 *  - creates the account if it doesn't exist,
 *  - never changes an existing password unless ADMIN_RESET_PASSWORD=true (account recovery).
 * After the first successful login, remove ADMIN_PASSWORD from the environment.
 */
export async function bootstrapAdminFromEnv(log: (m: string) => void = console.log) {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if ((await adminCount()) === 0) {
      log("[admin] No admin account exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) and restart, or run `npm run admin:create`.");
    }
    return null;
  }
  try {
    const result = await upsertAdmin(email, password, { reset: process.env.ADMIN_RESET_PASSWORD === "true" });
    if (result.action === "created") log(`[admin] Created admin account for ${email}. Remove ADMIN_PASSWORD from the environment after signing in.`);
    if (result.action === "reset") log(`[admin] Password reset for ${email}. Set ADMIN_RESET_PASSWORD back to false and remove ADMIN_PASSWORD.`);
    return result;
  } catch (err) {
    log(`[admin] Could not bootstrap admin: ${(err as Error).message}`);
    return null;
  }
}
