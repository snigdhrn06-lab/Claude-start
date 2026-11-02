/**
 * Storage driver selection. STORAGE_DRIVER = database (default) | s3 | local.
 */
import { databaseDriver } from "./database";
import { localDriver } from "./local";
import { s3Driver } from "./s3";
import type { StorageDriver } from "./types";

export function getStorage(): StorageDriver {
  const name = (process.env.STORAGE_DRIVER ?? "database").toLowerCase();
  if (name === "s3") return s3Driver;
  if (name === "local") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
      console.warn("[storage] STORAGE_DRIVER=local in production: uploads will be lost on redeploy. Falling back to database storage.");
      return databaseDriver;
    }
    return localDriver;
  }
  return databaseDriver;
}

export type { StorageDriver };
