/**
 * PostgreSQL connection pool + Drizzle instance.
 * Imported by server code only (route handlers, server components, scripts).
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

/**
 * Builds pg connection options from DATABASE_URL.
 *  - localhost / Render *internal* hostnames (no dots, e.g. "dpg-abc123-a") → no SSL
 *  - everything else → SSL with certificate verification
 *  - PGSSL=disable | no-verify | verify overrides the automatic choice
 */
export function connectionConfig(rawUrl: string): pg.PoolConfig {
  const cleaned = rawUrl.trim().replace(/^psql\s+/, "").replace(/^['"]|['"]$/g, "");
  const url = new URL(cleaned);
  const host = url.hostname;
  const sslMode = (process.env.PGSSL ?? "").toLowerCase();
  url.searchParams.delete("sslmode"); // pg ignores the `ssl` option when sslmode is in the URL
  url.searchParams.delete("channel_binding");

  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || !host.includes(".");
  let ssl: pg.PoolConfig["ssl"];
  if (sslMode === "disable" || (local && sslMode === "")) ssl = false;
  else if (sslMode === "no-verify") ssl = { rejectUnauthorized: false };
  else ssl = { rejectUnauthorized: true };

  return { connectionString: url.toString(), ssl };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy portfolio/.env.example to portfolio/.env and point it at a PostgreSQL database.",
    );
  }
  return url;
}

type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };

const globalForDb = globalThis as unknown as { __portfolioPool?: pg.Pool; __portfolioDb?: Db };

export function getPool(): pg.Pool {
  if (!globalForDb.__portfolioPool) {
    const pool = new pg.Pool({ ...connectionConfig(requireDatabaseUrl()), max: Number(process.env.PG_POOL_MAX ?? 5), idleTimeoutMillis: 30_000 });
    // Managed Postgres providers close idle connections; log instead of crashing the process.
    pool.on("error", (err) => console.warn("[db] idle client error:", err.message));
    globalForDb.__portfolioPool = pool;
  }
  return globalForDb.__portfolioPool;
}

/** Lazily-created Drizzle client (so importing this module never opens a connection by itself). */
export function getDb(): Db {
  if (!globalForDb.__portfolioDb) {
    globalForDb.__portfolioDb = drizzle(getPool(), { schema }) as Db;
  }
  return globalForDb.__portfolioDb;
}

export { schema };
