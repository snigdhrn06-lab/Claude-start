/**
 * Runs before the web server starts (`npm start`): migrate → seed → admin bootstrap.
 * Explains database connection problems clearly instead of crashing with a stack trace.
 */
import { getPool } from "@/lib/db/client";
import { bootstrapAdminFromEnv } from "@/lib/ops/admin";
import { runMigrations } from "@/lib/ops/migrate";
import { runSeed } from "@/lib/ops/seed";

function explain(err: { code?: string; message: string }) {
  const hints: Record<string, string> = {
    "28P01": "The database password is wrong. Copy the connection string again into DATABASE_URL.",
    ENOTFOUND: "The database host name in DATABASE_URL could not be found.",
    ECONNREFUSED: "Nothing is listening at the DATABASE_URL host/port. Is the database running?",
    "3D000": "The database named in DATABASE_URL does not exist.",
    SELF_SIGNED_CERT_IN_CHAIN: "The database uses a self-signed certificate. Set PGSSL=no-verify.",
  };
  return hints[err.code ?? ""] ?? "";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("\n[prepare] DATABASE_URL is not set. The site cannot start without a PostgreSQL database.\n");
    process.exit(1);
  }
  try {
    await runMigrations();
    console.log("[prepare] migrations applied");
    if (process.env.SKIP_SEED !== "true") await runSeed();
    await bootstrapAdminFromEnv();
  } catch (err) {
    const e = err as { code?: string; message: string };
    const hint = explain(e);
    console.error(`\n[prepare] failed: ${e.message}${hint ? `\n  → ${hint}` : ""}\n`);
    process.exit(1);
  } finally {
    await getPool().end().catch(() => {});
  }
}

main();
