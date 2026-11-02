/**
 * Admin editor layout for Site settings (tabs → fields). Field names may be dotted paths
 * (e.g. "sectionCopy.about.title"). Client-safe.
 */
import type { Field } from "./registry";
import { ACCENTS, SECTION_KEYS } from "./settings";

const sectionCopyFields = SECTION_KEYS.flatMap<Field>((k) => [
  { name: `sectionCopy.${k}.eyebrow`, label: "Eyebrow", type: "text", half: true, group: k.charAt(0).toUpperCase() + k.slice(1) },
  { name: `sectionCopy.${k}.title`, label: "Title", type: "text", half: true, group: k.charAt(0).toUpperCase() + k.slice(1), help: "Wrap a word in *asterisks* for the accent italic." },
  { name: `sectionCopy.${k}.intro`, label: "Intro", type: "textarea", rows: 2, group: k.charAt(0).toUpperCase() + k.slice(1) },
]);

export const SETTINGS_TABS: { key: string; label: string; description: string; fields: Field[] }[] = [
  {
    key: "identity",
    label: "Identity & hero",
    description: "Your name and the first screen visitors see.",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true, half: true },
      { name: "shortName", label: "Monogram", type: "text", half: true, help: "2–4 letters for the logo badge." },
      { name: "location", label: "Location", type: "text", half: true },
      { name: "roleLine", label: "Role line", type: "text", help: "The small line at the top of the hero. Separate items with ·" },
      { name: "headline", label: "Headline", type: "textarea", rows: 3, help: "Each line is revealed separately. Wrap a word in *asterisks* to emphasise it." },
      { name: "heroIntro", label: "Intro paragraph", type: "textarea", rows: 3 },
      {
        name: "heroStats",
        label: "Hero statistics",
        type: "repeater",
        help: "Only use figures you can verify. Numbers count up when visible.",
        fields: [
          { name: "value", label: "Value", type: "text", placeholder: "9" },
          { name: "suffix", label: "Suffix", type: "text", placeholder: "+" },
          { name: "label", label: "Label", type: "text" },
        ],
      },
      { name: "showTicker", label: "Show the highlights ticker under the hero", type: "boolean", help: "Scrolls your featured achievements." },
    ],
  },
  {
    key: "about",
    label: "About",
    description: "Story, interests, photographs and milestones.",
    fields: [
      { name: "aboutLead", label: "Lead sentence", type: "textarea", rows: 2 },
      { name: "aboutBody", label: "Story", type: "markdown", rows: 10 },
      { name: "interests", label: "Interests", type: "list", help: "One per line." },
      { name: "portraitPrimaryId", label: "Primary portrait (Fig. 01)", type: "media", accept: "image", group: "Photographs" },
      { name: "portraitPrimaryCutout", label: "Primary portrait has a transparent background", type: "boolean", group: "Photographs", help: "On: the photo breaks out of its frame. Off: it fills the frame (use for normal photos)." },
      { name: "portraitPrimaryCaption", label: "Primary caption", type: "text", group: "Photographs" },
      { name: "portraitSecondaryId", label: "Second photograph (Fig. 02)", type: "media", accept: "image", group: "Photographs" },
      { name: "portraitSecondaryCaption", label: "Second caption", type: "text", group: "Photographs" },
      {
        name: "milestones",
        label: "Milestones",
        type: "repeater",
        group: "Milestones",
        fields: [
          { name: "year", label: "Year / label", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "text", label: "Description", type: "textarea", rows: 2 },
        ],
      },
    ],
  },
  { key: "sections-copy", label: "Section text", description: "Eyebrow, title and intro for each homepage section.", fields: sectionCopyFields },
  {
    key: "sections",
    label: "Sections & nav",
    description: "Reorder homepage sections, rename their navigation labels or hide them.",
    fields: [
      {
        name: "sections",
        label: "Homepage sections (top to bottom)",
        type: "repeater",
        fixed: true,
        fields: [
          { name: "label", label: "Navigation label", type: "text" },
          { name: "visible", label: "Visible", type: "boolean" },
        ],
      },
    ],
  },
  {
    key: "contact",
    label: "Contact",
    description: "How visitors reach you.",
    fields: [
      { name: "email", label: "Email", type: "text", half: true },
      { name: "phone", label: "Phone (display)", type: "text", half: true },
      { name: "whatsappNumber", label: "WhatsApp number", type: "text", half: true, help: "Full number with country code, e.g. 916361686265." },
      { name: "linkedinUrl", label: "LinkedIn URL", type: "url", half: true },
      { name: "whatsappMessage", label: "Pre-filled WhatsApp message", type: "textarea", rows: 2 },
      { name: "showFloatingWhatsapp", label: "Show floating WhatsApp button", type: "boolean" },
      { name: "contactFormEnabled", label: "Show the contact form", type: "boolean", help: "Messages arrive in Admin → Messages (and by email if Resend is configured)." },
    ],
  },
  {
    key: "resume",
    label: "Résumé",
    description: "The PDF served at /resume.",
    fields: [
      { name: "resumeMediaId", label: "Résumé PDF", type: "media", accept: "document" },
      { name: "resumeLabel", label: "Button label", type: "text" },
    ],
  },
  {
    key: "seo",
    label: "SEO & sharing",
    description: "Search results and link previews.",
    fields: [
      { name: "siteUrl", label: "Site URL", type: "url", help: "Your public address, e.g. https://snigdh.in. Used for canonical links and the sitemap." },
      { name: "seoTitle", label: "Title", type: "text" },
      { name: "seoDescription", label: "Description", type: "textarea", rows: 3 },
      { name: "ogImageId", label: "Custom social preview image", type: "media", accept: "image", help: "Optional (1200×630 works best). Leave empty for the generated preview." },
    ],
  },
  {
    key: "appearance",
    label: "Appearance",
    description: "Accent colour and motion.",
    fields: [
      { name: "accent", label: "Accent colour", type: "select", options: ACCENTS.map((a) => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) })) },
      { name: "introEnabled", label: "Opening sequence (once per visit)", type: "boolean" },
      { name: "cursorEnabled", label: "Cursor follower on desktop", type: "boolean" },
      { name: "footerNote", label: "Footer note", type: "textarea", rows: 2 },
    ],
  },
];
