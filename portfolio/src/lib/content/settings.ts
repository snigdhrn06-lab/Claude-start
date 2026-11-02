/**
 * Site-wide settings model (profile, hero, about, contact, SEO, sections, appearance).
 * Stored as one JSON document in the `site_settings` table and validated with this schema.
 * Adding a new setting = add it here (with a default) + add a field in src/lib/content/settings-fields.ts.
 */
import { z } from "zod";
import { optionalUrl, str } from "./schemas";

export const SECTION_KEYS = ["about", "research", "projects", "achievements", "experience", "skills", "contact"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const ACCENTS = ["lime", "ice", "amber", "coral"] as const;
export type Accent = (typeof ACCENTS)[number];

const mediaId = z
  .union([z.uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const sectionCopy = z.object({
  eyebrow: str(60).default(""),
  title: str(200).default(""),
  intro: str(1200).default(""),
});

const DEFAULT_SECTIONS: { key: SectionKey; label: string; visible: boolean }[] = [
  { key: "about", label: "About", visible: true },
  { key: "research", label: "Research", visible: true },
  { key: "projects", label: "Projects", visible: true },
  { key: "achievements", label: "Achievements", visible: true },
  { key: "experience", label: "Experience", visible: true },
  { key: "skills", label: "Skills", visible: true },
  { key: "contact", label: "Contact", visible: true },
];

export const siteSettingsSchema = z.object({
  // Identity & hero
  name: str(80).default("Your Name"),
  shortName: str(12).default("YN"),
  location: str(80).default(""),
  roleLine: str(200).default(""),
  /** Each line is revealed separately. Wrap a word in *asterisks* to emphasise it. */
  headline: str(300).default(""),
  heroIntro: str(800).default(""),
  heroStats: z
    .array(z.object({ value: str(12).default(""), suffix: str(6).default(""), label: str(80).default("") }))
    .max(6)
    .default([]),
  showTicker: z.boolean().default(true),

  // About
  aboutLead: str(1200).default(""),
  aboutBody: z.string().max(8000).default(""),
  interests: z.array(z.string().trim().max(120)).max(16).default([]),
  portraitPrimaryId: mediaId,
  portraitPrimaryCaption: str(120).default(""),
  /** True when the primary portrait has a transparent background (it then breaks out of its frame). */
  portraitPrimaryCutout: z.boolean().default(true),
  portraitSecondaryId: mediaId,
  portraitSecondaryCaption: str(160).default(""),
  milestones: z
    .array(z.object({ year: str(20).default(""), title: str(120).default(""), text: str(400).default("") }))
    .max(16)
    .default([]),

  // Section copy
  sectionCopy: z
    .object({
      about: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      research: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      projects: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      achievements: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      experience: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      skills: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
      contact: sectionCopy.default({ eyebrow: "", title: "", intro: "" }),
    })
    .default({
      about: { eyebrow: "", title: "", intro: "" },
      research: { eyebrow: "", title: "", intro: "" },
      projects: { eyebrow: "", title: "", intro: "" },
      achievements: { eyebrow: "", title: "", intro: "" },
      experience: { eyebrow: "", title: "", intro: "" },
      skills: { eyebrow: "", title: "", intro: "" },
      contact: { eyebrow: "", title: "", intro: "" },
    }),

  // Sections & navigation
  sections: z
    .array(z.object({ key: z.enum(SECTION_KEYS), label: str(40).default(""), visible: z.boolean().default(true) }))
    .default(DEFAULT_SECTIONS)
    .transform((list) => {
      // Always contain every section exactly once (keeps older saved data compatible).
      const seen = new Set<string>();
      const out = list.filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true)));
      for (const d of DEFAULT_SECTIONS) if (!seen.has(d.key)) out.push(d);
      return out.map((s) => ({ ...s, label: s.label || DEFAULT_SECTIONS.find((d) => d.key === s.key)!.label }));
    }),

  // Contact
  email: z.union([z.literal(""), z.email("Enter a valid email")]).default(""),
  phone: str(40).default(""),
  /** Digits with country code, e.g. 916361686265. Used for wa.me links. */
  whatsappNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .refine((v) => v === "" || (v.length >= 8 && v.length <= 15), "Use the full number with country code")
    .default(""),
  whatsappMessage: str(400).default(""),
  linkedinUrl: optionalUrl,
  showFloatingWhatsapp: z.boolean().default(true),
  contactFormEnabled: z.boolean().default(true),

  // Resume
  resumeMediaId: mediaId,
  resumeLabel: str(40).default("Résumé"),

  // SEO
  siteUrl: optionalUrl,
  seoTitle: str(120).default(""),
  seoDescription: str(300).default(""),
  ogImageId: mediaId,

  // Appearance
  accent: z.enum(ACCENTS).default("lime"),
  introEnabled: z.boolean().default(true),
  cursorEnabled: z.boolean().default(true),

  // Footer
  footerNote: str(300).default(""),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export function parseSettings(data: unknown): SiteSettings {
  const result = siteSettingsSchema.safeParse(data ?? {});
  if (result.success) return result.data;
  // Corrupt or outdated data must never take the site down: keep the valid fields, default the rest.
  const base = siteSettingsSchema.parse({});
  const raw = (data ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof SiteSettings)[]) {
    const field = siteSettingsSchema.shape[key].safeParse(raw[key]);
    if (field.success) (base as Record<string, unknown>)[key] = field.data;
  }
  return base;
}

/** Media ids referenced by settings (used to resolve image URLs in one query). */
export function settingsMediaIds(s: SiteSettings): string[] {
  return [s.portraitPrimaryId, s.portraitSecondaryId, s.resumeMediaId, s.ogImageId].filter((v): v is string => !!v);
}
