/**
 * Zod validation schemas for every editable content type.
 * Shared by the admin API (server-side validation — the source of truth) and the admin forms.
 * No server-only imports here.
 */
import { z } from "zod";

export const STATUSES = ["draft", "published"] as const;
export const statusSchema = z.enum(STATUSES);

/** Trimmed string with a length cap. Empty strings are allowed. */
export const str = (max = 500) => z.string().trim().max(max, `Must be at most ${max} characters`);
/** Required trimmed string. */
export const req = (max = 300, label = "This field") => z.string().trim().min(1, `${label} is required`).max(max);
/** Long-form markdown text. */
export const md = (max = 20_000) => z.string().max(max, `Must be at most ${max} characters`);

/** http(s) URL or empty → null. Rejects javascript:, data: and other schemes. */
export const optionalUrl = z
  .union([z.literal(""), z.null(), z.string().trim().max(2000)])
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), "Must start with https:// or http://");

/** URL allowing mailto:/tel: too (social links). */
export const linkUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2000)
  .refine((v) => /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s-]+)$/i.test(v), "Must be an https://, mailto: or tel: link");

const uuidOrNull = z
  .union([z.uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const stringList = (maxItems = 30, maxLen = 300) =>
  z
    .array(z.string().trim().max(maxLen))
    .max(maxItems)
    .default([])
    .transform((arr) => arr.filter(Boolean));

const sortOrder = z.coerce.number().int().min(-100000).max(100000).optional();

export const slugSchema = z
  .string()
  .trim()
  .max(80)
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Use lowercase letters, numbers and hyphens");

export const PROJECT_VISUALS = ["storefront", "documents", "pulse", "seasonality", "heatmap", "terminal", "drawdown", "grid"] as const;
export const ACHIEVEMENT_KINDS = ["award", "recognition", "invitation", "milestone"] as const;
export const EXPERIENCE_KINDS = ["work", "position", "leadership", "sport"] as const;
export const RESEARCH_KINDS = ["paper", "article", "note"] as const;

export const projectSchema = z.object({
  title: req(160, "Title"),
  slug: slugSchema.default(""),
  summary: str(400).default(""),
  description: md().default(""),
  category: str(80).default(""),
  year: str(20).default(""),
  role: str(160).default(""),
  coverMediaId: uuidOrNull,
  visual: z.enum(PROJECT_VISUALS).default("grid"),
  accent: z
    .string()
    .trim()
    .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Use a hex colour like #C8F560")
    .default(""),
  techStack: stringList(30, 60),
  contribution: md(8000).default(""),
  problem: md(8000).default(""),
  solution: md(8000).default(""),
  outcomes: stringList(20, 400),
  caseStudy: md(40_000).default(""),
  liveUrl: optionalUrl,
  repoUrl: optionalUrl,
  disclaimer: str(400).default(""),
  featured: z.boolean().default(false),
  status: statusSchema.default("draft"),
  sortOrder,
  gallery: z
    .array(z.object({ mediaId: z.uuid(), caption: str(300).default("") }))
    .max(40)
    .default([]),
});

export const achievementSchema = z.object({
  title: req(120, "Title / placement"),
  event: req(200, "Event"),
  institution: str(200).default(""),
  year: str(20).default(""),
  kind: z.enum(ACHIEVEMENT_KINDS).default("award"),
  placement: z
    .union([z.coerce.number().int().min(1).max(100), z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  description: md(4000).default(""),
  mediaId: uuidOrNull,
  documentMediaId: uuidOrNull,
  verificationUrl: optionalUrl,
  featured: z.boolean().default(false),
  status: statusSchema.default("draft"),
  sortOrder,
});

export const educationSchema = z.object({
  institution: req(200, "Institution"),
  qualification: req(200, "Qualification"),
  field: str(200).default(""),
  location: str(120).default(""),
  startDate: str(40).default(""),
  endDate: str(40).default(""),
  score: str(60).default(""),
  description: md(4000).default(""),
  status: statusSchema.default("draft"),
  sortOrder,
});

export const experienceSchema = z.object({
  organization: req(200, "Organisation"),
  role: req(200, "Role"),
  kind: z.enum(EXPERIENCE_KINDS).default("work"),
  location: str(120).default(""),
  startDate: str(40).default(""),
  endDate: str(40).default(""),
  summary: md(4000).default(""),
  highlights: stringList(20, 600),
  url: optionalUrl,
  status: statusSchema.default("draft"),
  sortOrder,
});

export const findingSchema = z.object({
  value: str(40).default(""),
  label: str(200).default(""),
  context: str(800).default(""),
});

export const researchSchema = z.object({
  title: req(300, "Title"),
  slug: slugSchema.default(""),
  subtitle: str(300).default(""),
  kind: z.enum(RESEARCH_KINDS).default("paper"),
  venue: str(200).default(""),
  year: str(20).default(""),
  abstract: md(6000).default(""),
  question: md(4000).default(""),
  motivation: md(6000).default(""),
  dataSources: md(6000).default(""),
  methodology: md(10_000).default(""),
  findings: z.array(findingSchema).max(12).default([]),
  limitations: md(6000).default(""),
  body: md(60_000).default(""),
  readingNote: str(800).default(""),
  paperMediaId: uuidOrNull,
  externalUrl: optionalUrl,
  tags: stringList(20, 60),
  featured: z.boolean().default(false),
  status: statusSchema.default("draft"),
  sortOrder,
});

export const skillCategorySchema = z.object({
  name: req(100, "Name"),
  description: str(400).default(""),
  status: statusSchema.default("published"),
  sortOrder,
});

export const skillSchema = z.object({
  name: req(100, "Name"),
  categoryId: uuidOrNull,
  evidence: str(300).default(""),
  projectId: uuidOrNull,
  status: statusSchema.default("published"),
  sortOrder,
});

export const SOCIAL_ICONS = ["linkedin", "github", "mail", "phone", "whatsapp", "x", "instagram", "link"] as const;

export const socialLinkSchema = z.object({
  label: req(60, "Label"),
  url: linkUrl,
  icon: z.enum(SOCIAL_ICONS).default("link"),
  status: statusSchema.default("published"),
  sortOrder,
});

export const resourceSchema = z.object({
  title: req(160, "Title"),
  description: str(400).default(""),
  mediaId: uuidOrNull,
  externalUrl: optionalUrl,
  status: statusSchema.default("draft"),
  sortOrder,
});

export const contactMessageSchema = z.object({
  name: req(120, "Name"),
  email: z.email("Enter a valid email address").max(200),
  subject: str(200).default(""),
  message: z.string().trim().min(10, "Message should be at least 10 characters").max(5000),
  /** Honeypot. Real visitors never fill it. */
  website: z.string().max(0).optional().default(""),
});

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200, "Password is too long");

export type ProjectInput = z.infer<typeof projectSchema>;
export type AchievementInput = z.infer<typeof achievementSchema>;
export type ResearchInput = z.infer<typeof researchSchema>;
