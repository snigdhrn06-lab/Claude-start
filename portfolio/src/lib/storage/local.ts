/**
 * Local filesystem storage for development only (./.data/uploads).
 * Render's filesystem is ephemeral — never use this driver in production.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver } from "./types";

const ROOT = path.resolve(process.cwd(), ".data", "uploads");
const safePath = (key: string) => {
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return p;
};

export const localDriver: StorageDriver = {
  name: "local",
  async put(key, data, mime) {
    const p = safePath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
    await fs.writeFile(p + ".mime", mime);
  },
  async get(key) {
    try {
      const p = safePath(key);
      const [data, mime] = await Promise.all([fs.readFile(p), fs.readFile(p + ".mime", "utf8").catch(() => "application/octet-stream")]);
      return { data, mime };
    } catch {
      return null;
    }
  },
  async delete(key) {
    const p = safePath(key);
    await fs.rm(p, { force: true });
    await fs.rm(p + ".mime", { force: true });
  },
};
