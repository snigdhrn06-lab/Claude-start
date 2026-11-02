import { runMigrations } from "@/lib/ops/migrate";
import { getPool } from "@/lib/db/client";

runMigrations()
  .then(() => console.log("[migrate] database is up to date"))
  .catch((err) => {
    console.error("[migrate] failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
