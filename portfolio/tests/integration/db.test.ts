/**
 * Integration tests against a real PostgreSQL test database (TEST_DATABASE_URL,
 * default postgres://postgres@localhost:5432/portfolio_test). The schema is reset first.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, getPool, schema } from "@/lib/db/client";

let available = true;
beforeAll(async () => {
  try {
    await getDb().execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
    const { runMigrations } = await import("@/lib/ops/migrate");
    await runMigrations();
  } catch (err) {
    available = false;
    console.warn("Skipping integration tests: test database unavailable:", (err as Error).message);
  }
});
afterAll(async () => {
  await getPool().end();
});

describe("migrations + seed", () => {
  it("seeds verified content once and is idempotent", async () => {
    if (!available) return;
    const { runSeed } = await import("@/lib/ops/seed");
    const first = await runSeed({ log: () => {} });
    expect(first.inserted).toBeGreaterThan(40);
    const second = await runSeed({ log: () => {} });
    expect(second.inserted).toBe(0);
    const projects = await getDb().select().from(schema.projects);
    expect(projects.filter((p) => p.slug === "sapthagiri-enterprises")).toHaveLength(1);
    expect(projects.find((p) => p.slug === "pulse")!.status).toBe("draft");
  });

  it("never overwrites edits or resurrects deleted seed content", async () => {
    if (!available) return;
    const { runSeed } = await import("@/lib/ops/seed");
    const db = getDb();
    await db.update(schema.projects).set({ title: "Edited title" }).where(eq(schema.projects.slug, "alpha-beta-pdf-utility"));
    await db.delete(schema.achievements).where(eq(schema.achievements.event, "SBI National Financial Literacy Quiz"));
    await runSeed({ log: () => {} });
    const [ab] = await db.select().from(schema.projects).where(eq(schema.projects.slug, "alpha-beta-pdf-utility"));
    expect(ab!.title).toBe("Edited title");
    const sbi = await db.select().from(schema.achievements).where(eq(schema.achievements.event, "SBI National Financial Literacy Quiz"));
    expect(sbi).toHaveLength(0);
  });
});

describe("content repository", () => {
  it("creates with unique slugs, updates, reorders and deletes", async () => {
    if (!available) return;
    const repo = await import("@/lib/content/repo");
    const a = await repo.createEntity("projects", { title: "Test Project", status: "draft" });
    const b = await repo.createEntity("projects", { title: "Test Project", status: "draft" });
    expect(a.slug).toBe("test-project");
    expect(b.slug).toBe("test-project-2");
    const updated = await repo.updateEntity("projects", a.id, { ...a, summary: "Now with summary", status: "published" });
    expect(updated.summary).toBe("Now with summary");
    await repo.reorderEntities("projects", [b.id, a.id]);
    const [ra] = await getDb().select().from(schema.projects).where(eq(schema.projects.id, a.id));
    expect(ra!.sortOrder).toBe(20);
    await repo.deleteEntity("projects", a.id);
    await repo.deleteEntity("projects", b.id);
    expect(await repo.getEntity("projects", a.id)).toBeNull();
  });

  it("rejects invalid input", async () => {
    if (!available) return;
    const repo = await import("@/lib/content/repo");
    await expect(repo.createEntity("achievements", { title: "", event: "" })).rejects.toThrow();
    await expect(repo.createEntity("projects", { title: "X", liveUrl: "javascript:alert(1)" })).rejects.toThrow();
  });
});

describe("public queries", () => {
  it("only return published content", async () => {
    if (!available) return;
    const { getSiteData } = await import("@/lib/content/queries");
    const data = await getSiteData();
    expect(data.projects.length).toBeGreaterThan(0);
    expect(data.projects.every((p) => p.status === "published")).toBe(true);
    expect(data.projects.some((p) => p.slug === "pulse")).toBe(false);
    expect(data.settings.name).toBe("Snigdh R.N.");
    expect(data.settings.portraitPrimaryId && data.media[data.settings.portraitPrimaryId]).toBeTruthy();
  });
});

describe("media pipeline (database storage)", () => {
  it("creates responsive WebP variants, strips metadata and serves the bytes back", async () => {
    if (!available) return;
    const { storeUpload, deleteMedia } = await import("@/lib/media");
    const { getStorage } = await import("@/lib/storage");
    const img = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: "#336699" } }).jpeg().withMetadata().toBuffer();
    const row = await storeUpload({ data: img, filename: "photo.jpg", alt: "Test" });
    expect(row.kind).toBe("image");
    expect(row.variants.map((v) => v.width)).toEqual([480, 960, 1600, 2000]);
    const stored = await getStorage().get(row.key);
    expect(stored?.mime).toBe("image/webp");
    expect((await sharp(stored!.data).metadata()).exif).toBeUndefined();
    await deleteMedia(row.id);
    expect(await getStorage().get(row.key)).toBeNull();
  });

  it("accepts PDFs and rejects SVG / unknown files", async () => {
    if (!available) return;
    const { storeUpload, deleteMedia } = await import("@/lib/media");
    const pdf = readFileSync(path.resolve(__dirname, "../../seed/assets/Snigdh_RN_CV.pdf"));
    const doc = await storeUpload({ data: pdf, filename: "cv.pdf" });
    expect(doc.kind).toBe("document");
    await deleteMedia(doc.id);
    await expect(storeUpload({ data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), filename: "x.svg" })).rejects.toThrow(/Unsupported/);
    await expect(storeUpload({ data: Buffer.from("MZ executable"), filename: "x.exe" })).rejects.toThrow();
  });
});

describe("rate limiting", () => {
  it("counts events within the window", async () => {
    if (!available) return;
    const rl = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 3; i++) await rl.recordEvent("test", "k");
    expect(await rl.countRecent("test", "k", 60_000)).toBe(3);
    await rl.clearEvents("test", "k");
    expect(await rl.countRecent("test", "k", 60_000)).toBe(0);
  });
});

describe("admin provisioning", () => {
  it("creates an admin, never silently resets, and resets only on request", async () => {
    if (!available) return;
    const { upsertAdmin, findAdminByEmail } = await import("@/lib/ops/admin");
    const { verifyPassword } = await import("@/lib/auth/password");
    expect((await upsertAdmin("Owner@Example.com", "first-password-123")).action).toBe("created");
    expect((await upsertAdmin("owner@example.com", "second-password-123")).action).toBe("exists");
    let admin = await findAdminByEmail("owner@example.com");
    expect(await verifyPassword("first-password-123", admin!.passwordHash)).toBe(true);
    expect((await upsertAdmin("owner@example.com", "second-password-123", { reset: true })).action).toBe("reset");
    admin = await findAdminByEmail("owner@example.com");
    expect(await verifyPassword("second-password-123", admin!.passwordHash)).toBe(true);
  });
});
