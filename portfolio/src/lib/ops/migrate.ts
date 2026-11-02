/**
 * Applies SQL migrations from ./drizzle under a Postgres advisory lock
 * (safe if two instances start at the same time).
 */
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "@/lib/db/client";

const LOCK_ID = 727_271_001;

export async function runMigrations(folder = path.resolve(process.cwd(), "drizzle")) {
  const client = await getPool().connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    await migrate(getDb(), { migrationsFolder: folder });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}
