/** Health check for Render: verifies the app is up and the database answers. */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, db: "up", storage: process.env.STORAGE_DRIVER ?? "database", ms: Date.now() - started }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[health] database check failed:", (err as Error).message);
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
