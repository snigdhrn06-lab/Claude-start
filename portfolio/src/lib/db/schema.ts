/**
 * Database schema (Drizzle ORM, PostgreSQL).
 *
 * Every piece of public content lives here so the admin CMS can edit it.
 * After changing this file run `npm run db:generate` to create a migration in ./drizzle,
 * then `npm run db:migrate` (or just restart: `npm start` migrates automatically).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** draft | published — drafts are never returned by public queries. */
const statusCheck = (table: string, col: unknown) => check(`${table}_status_check`, sql`${col} in ('draft', 'published')`);
const status = () => text("status").notNull().default("draft");
const sortOrder = () => integer("sort_order").notNull().default(0);
const featured = () => boolean("featured").notNull().default(false);

// ─────────────────────────────── Auth ───────────────────────────────

export const admins = pgTable("admins", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [uniqueIndex("admins_email_key").on(sql`lower(${t.email})`)]);

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token — the raw token is never stored. */
  id: text("id").primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_admin_idx").on(t.adminId)]);

/** Generic rate-limit ledger (login attempts, contact form). Survives restarts. */
export const rateEvents = pgTable("rate_events", {
  id: id(),
  bucket: text("bucket").notNull(),
  key: text("key").notNull(),
  createdAt: createdAt(),
}, (t) => [index("rate_events_lookup_idx").on(t.bucket, t.key, t.createdAt)]);

// ─────────────────────────────── Media ───────────────────────────────

export type MediaVariant = { width: number; height: number; key: string; size: number };

export const media = pgTable("media", {
  id: id(),
  kind: text("kind").notNull(), // image | document — enforced by media_kind_check
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  /** Storage key of the main file (largest image variant, or the document itself). */
  key: text("key").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  variants: jsonb("variants").$type<MediaVariant[]>().notNull().default([]),
  alt: text("alt").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [check("media_kind_check", sql`${t.kind} in ('image', 'document')`)]);

/** Binary storage used when STORAGE_DRIVER=database (the default). */
export const mediaBlobs = pgTable("media_blobs", {
  key: text("key").primaryKey(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

const mediaRef = (name: string) => uuid(name).references(() => media.id, { onDelete: "set null" });

// ─────────────────────────────── Site settings ───────────────────────────────

/** Single row (id = 1). `data` is validated by siteSettingsSchema in src/lib/content/settings.ts. */
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull().default({}),
  updatedAt: updatedAt(),
});

// ─────────────────────────────── Content ───────────────────────────────

export const projects = pgTable("projects", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default(""),
  year: text("year").notNull().default(""),
  role: text("role").notNull().default(""),
  coverMediaId: mediaRef("cover_media_id"),
  /** Built-in illustrative visual used when no cover image is set (see ProjectVisual.tsx). */
  visual: text("visual").notNull().default("grid"),
  accent: text("accent").notNull().default(""),
  techStack: jsonb("tech_stack").$type<string[]>().notNull().default([]),
  contribution: text("contribution").notNull().default(""),
  problem: text("problem").notNull().default(""),
  solution: text("solution").notNull().default(""),
  outcomes: jsonb("outcomes").$type<string[]>().notNull().default([]),
  caseStudy: text("case_study").notNull().default(""),
  liveUrl: text("live_url"),
  repoUrl: text("repo_url"),
  disclaimer: text("disclaimer").notNull().default(""),
  featured: featured(),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("projects", t.status)]);

export const projectMedia = pgTable("project_media", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  sortOrder: sortOrder(),
}, (t) => [primaryKey({ columns: [t.projectId, t.mediaId] })]);

export const achievements = pgTable("achievements", {
  id: id(),
  title: text("title").notNull(), // e.g. "2nd Place" or "Judge (invited)"
  event: text("event").notNull(),
  institution: text("institution").notNull().default(""),
  year: text("year").notNull().default(""),
  kind: text("kind").notNull().default("award"), // award | recognition | invitation | milestone
  placement: integer("placement"), // 1, 2, 3 … drives the podium numeral; null for non-ranked
  description: text("description").notNull().default(""),
  mediaId: mediaRef("media_id"), // certificate image or photograph
  documentMediaId: mediaRef("document_media_id"), // supporting PDF
  verificationUrl: text("verification_url"),
  featured: featured(),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("achievements", t.status)]);

export const education = pgTable("education", {
  id: id(),
  institution: text("institution").notNull(),
  qualification: text("qualification").notNull(),
  field: text("field").notNull().default(""),
  location: text("location").notNull().default(""),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  score: text("score").notNull().default(""),
  description: text("description").notNull().default(""),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("education", t.status)]);

export const experience = pgTable("experience", {
  id: id(),
  organization: text("organization").notNull(),
  role: text("role").notNull(),
  kind: text("kind").notNull().default("work"), // work | position | leadership | sport
  location: text("location").notNull().default(""),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  summary: text("summary").notNull().default(""),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  url: text("url"),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("experience", t.status)]);

export type ResearchFinding = { value: string; label: string; context: string };

export const research = pgTable("research", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  kind: text("kind").notNull().default("paper"), // paper | article | note
  venue: text("venue").notNull().default(""), // e.g. "Submitted to IIMC-FRC" — describe the real status
  year: text("year").notNull().default(""),
  abstract: text("abstract").notNull().default(""),
  question: text("question").notNull().default(""),
  motivation: text("motivation").notNull().default(""),
  dataSources: text("data_sources").notNull().default(""),
  methodology: text("methodology").notNull().default(""),
  findings: jsonb("findings").$type<ResearchFinding[]>().notNull().default([]),
  limitations: text("limitations").notNull().default(""),
  body: text("body").notNull().default(""),
  readingNote: text("reading_note").notNull().default(""),
  paperMediaId: mediaRef("paper_media_id"),
  externalUrl: text("external_url"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  featured: featured(),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("research", t.status)]);

export const skillCategories = pgTable("skill_categories", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("skill_categories", t.status)]);

export const skills = pgTable("skills", {
  id: id(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => skillCategories.id, { onDelete: "set null" }),
  evidence: text("evidence").notNull().default(""),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("skills", t.status)]);

export const socialLinks = pgTable("social_links", {
  id: id(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  icon: text("icon").notNull().default("link"),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("social_links", t.status)]);

/** Downloadable documents beyond the main resume (writing samples, certificates, decks). */
export const resources = pgTable("resources", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  mediaId: mediaRef("media_id"),
  externalUrl: text("external_url"),
  status: status(),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [statusCheck("resources", t.status)]);

// ─────────────────────────────── Inbox & bookkeeping ───────────────────────────────

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull().default(""),
  message: text("message").notNull(),
  emailDelivered: boolean("email_delivered").notNull().default(false),
  read: boolean("read").notNull().default(false),
  createdAt: createdAt(),
});

/** Recent admin changes, shown on the dashboard. */
export const activityLog = pgTable("activity_log", {
  id: id(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  action: text("action").notNull(), // created | updated | deleted | published | unpublished | reordered | uploaded
  label: text("label").notNull().default(""),
  createdAt: createdAt(),
});

/** Seed keys that have been inserted once. Prevents re-seeding edited or deleted content. */
export const seedLog = pgTable("seed_log", {
  key: text("key").primaryKey(),
  /** Id of the row (or media) the seed created, used to link seeded content together. */
  ref: text("ref"),
  seededAt: timestamp("seeded_at", { withTimezone: true }).notNull().defaultNow(),
});
