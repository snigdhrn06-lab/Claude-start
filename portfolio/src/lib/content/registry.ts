/**
 * Admin CMS registry: one declarative config per content type.
 * The generic admin list (EntityList) and editor (EntityForm) render entirely from these configs,
 * and the generic API (/api/admin/[entity]) validates with the matching zod schema.
 *
 * Client-safe: no server imports.
 *
 * To add a field: add the column (db/schema.ts) → zod (content/schemas.ts) → a Field entry below.
 */
import {
  ACHIEVEMENT_KINDS,
  EXPERIENCE_KINDS,
  PROJECT_VISUALS,
  RESEARCH_KINDS,
  SOCIAL_ICONS,
} from "./schemas";

export const ENTITY_KEYS = [
  "projects",
  "research",
  "achievements",
  "experience",
  "education",
  "skills",
  "skill-categories",
  "social-links",
  "resources",
] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];

export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "url"
  | "number"
  | "boolean"
  | "select"
  | "tags"
  | "list"
  | "media"
  | "gallery"
  | "relation"
  | "repeater"
  | "slug"
  | "status"
  | "color";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
  /** For media fields. */
  accept?: "image" | "document" | "any";
  /** For relation fields. */
  relation?: EntityKey;
  /** For repeater fields. */
  fields?: Field[];
  /** Repeater with a fixed set of rows (reorder only). */
  fixed?: boolean;
  rows?: number;
  half?: boolean;
  /** Visual grouping in the editor. */
  group?: string;
};

export type EntityConfig = {
  key: EntityKey;
  label: string;
  singular: string;
  description: string;
  titleField: string;
  subtitleFields?: string[];
  hasSlug?: boolean;
  hasFeatured?: boolean;
  hasStatus: boolean;
  /** Public URL for "View on site" (relative). */
  publicPath?: (row: Record<string, unknown>) => string | null;
  searchFields: string[];
  fields: Field[];
};

const opts = (values: readonly string[], labels?: Record<string, string>) =>
  values.map((v) => ({ value: v, label: labels?.[v] ?? v.charAt(0).toUpperCase() + v.slice(1) }));

const publishing = (featuredHelp?: string): Field[] => [
  { name: "status", label: "Status", type: "status", group: "Publishing", help: "Drafts are never shown on the public site." },
  ...(featuredHelp ? [{ name: "featured", label: "Featured", type: "boolean" as const, group: "Publishing", help: featuredHelp }] : []),
];

export const ENTITIES: Record<EntityKey, EntityConfig> = {
  projects: {
    key: "projects",
    label: "Projects",
    singular: "Project",
    description: "Client work, software and research projects shown in the Projects section, each with its own page.",
    titleField: "title",
    subtitleFields: ["category", "year"],
    hasSlug: true,
    hasFeatured: true,
    hasStatus: true,
    publicPath: (r) => (r.slug ? `/projects/${r.slug}` : null),
    searchFields: ["title", "summary", "category"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, group: "Basics" },
      { name: "slug", label: "URL slug", type: "slug", group: "Basics", help: "Leave blank to generate from the title. Changing it changes the page URL." },
      { name: "category", label: "Category", type: "text", half: true, group: "Basics", placeholder: "Client work · Full-stack" },
      { name: "year", label: "Year", type: "text", half: true, group: "Basics" },
      { name: "role", label: "My role", type: "text", group: "Basics", placeholder: "Designer & full-stack developer" },
      { name: "summary", label: "Short summary", type: "textarea", rows: 3, group: "Basics", help: "One or two sentences for the project list." },
      { name: "coverMediaId", label: "Cover image", type: "media", accept: "image", group: "Visuals", help: "Leave empty to use the built-in illustrative visual below." },
      { name: "visual", label: "Illustrative visual (fallback)", type: "select", options: opts(PROJECT_VISUALS), half: true, group: "Visuals" },
      { name: "accent", label: "Accent colour", type: "color", half: true, group: "Visuals", help: "Optional hex colour for this project's page." },
      { name: "gallery", label: "Gallery", type: "gallery", group: "Visuals", help: "Real screenshots or photos. Add a caption that says what each image shows." },
      { name: "description", label: "Overview", type: "markdown", rows: 8, group: "Story" },
      { name: "problem", label: "Problem", type: "markdown", rows: 5, group: "Story" },
      { name: "solution", label: "Solution", type: "markdown", rows: 5, group: "Story" },
      { name: "contribution", label: "My contribution", type: "markdown", rows: 5, group: "Story" },
      { name: "techStack", label: "Technology", type: "tags", group: "Story", placeholder: "Add a technology and press Enter" },
      { name: "outcomes", label: "Verified outcomes", type: "list", group: "Story", help: "One per line. Only include results you can verify." },
      { name: "caseStudy", label: "Case study (long form)", type: "markdown", rows: 12, group: "Story" },
      { name: "disclaimer", label: "Disclaimer", type: "textarea", rows: 2, group: "Story", help: "E.g. 'Historical backtest, not live trading performance.'" },
      { name: "liveUrl", label: "Live URL", type: "url", half: true, group: "Links" },
      { name: "repoUrl", label: "Repository URL", type: "url", half: true, group: "Links" },
      ...publishing("Featured projects appear first with large layouts."),
    ],
  },
  research: {
    key: "research",
    label: "Research",
    singular: "Research item",
    description: "Papers, articles and research notes. Each item gets a detail page with methodology and findings.",
    titleField: "title",
    subtitleFields: ["venue", "year"],
    hasSlug: true,
    hasFeatured: true,
    hasStatus: true,
    publicPath: (r) => (r.slug ? `/research/${r.slug}` : null),
    searchFields: ["title", "subtitle", "venue"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, group: "Basics" },
      { name: "subtitle", label: "Subtitle", type: "text", group: "Basics" },
      { name: "slug", label: "URL slug", type: "slug", group: "Basics" },
      { name: "kind", label: "Type", type: "select", options: opts(RESEARCH_KINDS), half: true, group: "Basics" },
      { name: "year", label: "Year", type: "text", half: true, group: "Basics" },
      { name: "venue", label: "Status / venue", type: "text", group: "Basics", help: "State the real status, e.g. 'Submitted to IIMC-FRC'. Don't write 'published' unless it was." },
      { name: "tags", label: "Tags", type: "tags", group: "Basics" },
      { name: "abstract", label: "Abstract", type: "markdown", rows: 5, group: "Content" },
      { name: "question", label: "Research question", type: "markdown", rows: 3, group: "Content" },
      { name: "motivation", label: "Motivation", type: "markdown", rows: 4, group: "Content" },
      { name: "dataSources", label: "Data sources", type: "markdown", rows: 4, group: "Content" },
      { name: "methodology", label: "Methodology", type: "markdown", rows: 6, group: "Content" },
      {
        name: "findings",
        label: "Key findings",
        type: "repeater",
        group: "Content",
        help: "Headline figures shown as large numbers. Keep the context honest (associations ≠ causation).",
        fields: [
          { name: "value", label: "Figure", type: "text", placeholder: "6.25×" },
          { name: "label", label: "What it measures", type: "text" },
          { name: "context", label: "Context", type: "textarea", rows: 2 },
        ],
      },
      { name: "limitations", label: "Limitations", type: "markdown", rows: 4, group: "Content" },
      { name: "body", label: "Additional notes (long form)", type: "markdown", rows: 10, group: "Content" },
      { name: "readingNote", label: "Reading note", type: "textarea", rows: 2, group: "Content", help: "Shown beside the findings, e.g. how to interpret them." },
      { name: "paperMediaId", label: "Paper PDF", type: "media", accept: "document", group: "Links" },
      { name: "externalUrl", label: "External link", type: "url", group: "Links" },
      ...publishing("The featured item is presented in the Research section's main panel."),
    ],
  },
  achievements: {
    key: "achievements",
    label: "Achievements",
    singular: "Achievement",
    description: "Awards, placements, recognitions and invitations. Featured ones are shown on the podium.",
    titleField: "event",
    subtitleFields: ["title", "year"],
    hasFeatured: true,
    hasStatus: true,
    searchFields: ["event", "title", "institution"],
    fields: [
      { name: "title", label: "Placement / role", type: "text", required: true, half: true, placeholder: "2nd Place", group: "Basics" },
      { name: "placement", label: "Rank (number)", type: "number", half: true, group: "Basics", help: "1, 2 or 3 shows a podium numeral. Leave empty otherwise." },
      { name: "event", label: "Event", type: "text", required: true, group: "Basics" },
      { name: "institution", label: "Institution / host", type: "text", half: true, group: "Basics" },
      { name: "year", label: "Year", type: "text", half: true, group: "Basics" },
      { name: "kind", label: "Type", type: "select", options: opts(ACHIEVEMENT_KINDS), group: "Basics", help: "'Invitation' is for upcoming roles such as judging invitations." },
      { name: "description", label: "Description", type: "markdown", rows: 4, group: "Details" },
      { name: "mediaId", label: "Certificate or photo", type: "media", accept: "image", group: "Evidence" },
      { name: "documentMediaId", label: "Supporting document (PDF)", type: "media", accept: "document", group: "Evidence" },
      { name: "verificationUrl", label: "Verification link", type: "url", group: "Evidence" },
      ...publishing("Featured achievements get large podium cards."),
    ],
  },
  experience: {
    key: "experience",
    label: "Experience",
    singular: "Experience entry",
    description: "Internships, positions, leadership roles and sport.",
    titleField: "role",
    subtitleFields: ["organization", "startDate"],
    hasStatus: true,
    searchFields: ["role", "organization"],
    fields: [
      { name: "role", label: "Role", type: "text", required: true, group: "Basics" },
      { name: "organization", label: "Organisation", type: "text", required: true, group: "Basics" },
      { name: "kind", label: "Type", type: "select", options: opts(EXPERIENCE_KINDS, { work: "Work / internship", position: "Position of responsibility", leadership: "Leadership & events", sport: "Sport" }), half: true, group: "Basics" },
      { name: "location", label: "Location", type: "text", half: true, group: "Basics" },
      { name: "startDate", label: "Start", type: "text", half: true, placeholder: "Mar 2025", group: "Basics" },
      { name: "endDate", label: "End", type: "text", half: true, placeholder: "Present", group: "Basics" },
      { name: "summary", label: "Summary", type: "markdown", rows: 3, group: "Details" },
      { name: "highlights", label: "Highlights", type: "list", group: "Details", help: "One per line." },
      { name: "url", label: "Link", type: "url", group: "Details" },
      ...publishing(),
    ],
  },
  education: {
    key: "education",
    label: "Education",
    singular: "Education entry",
    description: "Degrees and schooling.",
    titleField: "institution",
    subtitleFields: ["qualification", "startDate"],
    hasStatus: true,
    searchFields: ["institution", "qualification"],
    fields: [
      { name: "institution", label: "Institution", type: "text", required: true },
      { name: "qualification", label: "Qualification", type: "text", required: true, half: true },
      { name: "field", label: "Field / specialisation", type: "text", half: true },
      { name: "startDate", label: "Start", type: "text", half: true },
      { name: "endDate", label: "End", type: "text", half: true },
      { name: "score", label: "Score", type: "text", half: true },
      { name: "location", label: "Location", type: "text", half: true },
      { name: "description", label: "Notes", type: "markdown", rows: 3 },
      ...publishing(),
    ],
  },
  skills: {
    key: "skills",
    label: "Skills",
    singular: "Skill",
    description: "Skills grouped by category. Link a skill to a project that demonstrates it.",
    titleField: "name",
    hasStatus: true,
    searchFields: ["name", "evidence"],
    fields: [
      { name: "name", label: "Skill", type: "text", required: true },
      { name: "categoryId", label: "Category", type: "relation", relation: "skill-categories", half: true },
      { name: "projectId", label: "Demonstrated in project", type: "relation", relation: "projects", half: true },
      { name: "evidence", label: "Evidence", type: "text", help: "Where this skill was used, e.g. 'Cautilya Capitals internship'." },
      ...publishing(),
    ],
  },
  "skill-categories": {
    key: "skill-categories",
    label: "Skill categories",
    singular: "Skill category",
    description: "Groups for the Skills section.",
    titleField: "name",
    hasStatus: true,
    searchFields: ["name"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 2 },
      ...publishing(),
    ],
  },
  "social-links": {
    key: "social-links",
    label: "Social links",
    singular: "Social link",
    description: "Profiles shown in the contact section and footer.",
    titleField: "label",
    subtitleFields: ["url"],
    hasStatus: true,
    searchFields: ["label", "url"],
    fields: [
      { name: "label", label: "Label", type: "text", required: true, half: true },
      { name: "icon", label: "Icon", type: "select", options: opts(SOCIAL_ICONS), half: true },
      { name: "url", label: "URL", type: "text", required: true, placeholder: "https://…" },
      ...publishing(),
    ],
  },
  resources: {
    key: "resources",
    label: "Resources",
    singular: "Resource",
    description: "Extra downloads (writing samples, decks, certificates). The main résumé is set in Site settings.",
    titleField: "title",
    hasStatus: true,
    searchFields: ["title", "description"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 2 },
      { name: "mediaId", label: "File", type: "media", accept: "any" },
      { name: "externalUrl", label: "Or external link", type: "url" },
      ...publishing(),
    ],
  },
};

export function isEntityKey(v: string): v is EntityKey {
  return (ENTITY_KEYS as readonly string[]).includes(v);
}
