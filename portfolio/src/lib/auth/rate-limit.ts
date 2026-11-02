/**
 * Database-backed sliding-window rate limiter. Works across restarts and multiple instances.
 */
import { and, count, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export async function countRecent(bucket: string, key: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  const [row] = await getDb()
    .select({ n: count() })
    .from(schema.rateEvents)
    .where(and(eq(schema.rateEvents.bucket, bucket), eq(schema.rateEvents.key, key), gt(schema.rateEvents.createdAt, since)));
  return Number(row?.n ?? 0);
}

export async function recordEvent(bucket: string, key: string) {
  const db = getDb();
  await db.insert(schema.rateEvents).values({ bucket, key });
  // Opportunistic cleanup of entries older than a day.
  if (Math.random() < 0.05) {
    await db.delete(schema.rateEvents).where(lt(schema.rateEvents.createdAt, new Date(Date.now() - 86_400_000)));
  }
}

export async function clearEvents(bucket: string, key: string) {
  await getDb().delete(schema.rateEvents).where(and(eq(schema.rateEvents.bucket, bucket), eq(schema.rateEvents.key, key)));
}

export const LIMITS = {
  /** Failed logins per IP per 15 minutes. */
  loginIp: { max: 5, windowMs: 15 * 60_000 },
  /** Failed logins per account per 15 minutes (slows distributed guessing). */
  loginEmail: { max: 10, windowMs: 15 * 60_000 },
  /** Contact messages per IP per hour. */
  contact: { max: 5, windowMs: 60 * 60_000 },
} as const;
