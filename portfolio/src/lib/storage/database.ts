/**
 * Stores files as bytea rows in Postgres (table media_blobs).
 * Zero extra services: uploads persist as long as the database does. Ideal for a personal site's
 * handful of photos and PDFs. Switch to S3/R2 if the media library grows into the gigabytes.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { StorageDriver } from "./types";

export const databaseDriver: StorageDriver = {
  name: "database",
  async put(key, data, mime) {
    await getDb().insert(schema.mediaBlobs).values({ key, data, mime }).onConflictDoUpdate({ target: schema.mediaBlobs.key, set: { data, mime } });
  },
  async get(key) {
    const [row] = await getDb().select({ data: schema.mediaBlobs.data, mime: schema.mediaBlobs.mime }).from(schema.mediaBlobs).where(eq(schema.mediaBlobs.key, key)).limit(1);
    return row ? { data: Buffer.from(row.data), mime: row.mime } : null;
  },
  async delete(key) {
    await getDb().delete(schema.mediaBlobs).where(eq(schema.mediaBlobs.key, key));
  },
};
