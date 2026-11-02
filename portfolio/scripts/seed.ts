import { runSeed } from "@/lib/ops/seed";
import { getPool } from "@/lib/db/client";

runSeed()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
