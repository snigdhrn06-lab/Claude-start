# Progress log & decisions

## Decisions

| Decision | Why |
|---|---|
| New app in `portfolio/`, existing apps untouched | The repository already contains **Sentinel** (Next.js app at the root, with its own `render.yaml`) and **Sapthagiri Enterprises** (`sapthagiri-app/`). Neither is a portfolio, and both are working products. The portfolio got its own folder and its own Blueprint file (`portfolio/render.yaml`). |
| Next.js 15 + TypeScript + Tailwind + Framer Motion | Same stack family as Sentinel (already used in the repo). One service renders pages server-side (SEO) and hosts the API and the CMS. |
| PostgreSQL + Drizzle ORM | Pure-JS ORM with SQL migrations committed in `drizzle/`. No binary engine downloads, which makes builds on Render reliable. |
| Own authentication (scrypt + DB sessions + CSRF) instead of an auth SaaS | Single-owner CMS. Avoids external accounts while meeting the security brief: hashed passwords, HTTP-only `__Host-` cookies, server-side session checks, per-session CSRF token plus Origin check, DB-backed rate limiting. |
| Media stored in Postgres by default | Render's disk is ephemeral. Storing optimised WebP variants in Postgres makes uploads persistent with zero extra services. An S3/R2 driver is included for growth. |
| No persistent data cache | Content is read per request (memoised within a request). A stale-cache bug found during e2e testing showed that a persistent cache can outlive database restores and redeploys. Freshness was prioritised over a few milliseconds per request. |
| Generic CMS (registry-driven) | One list and one editor implementation serve all 9 content types, configured in `src/lib/content/registry.ts`. Adding a content type is mostly configuration. |
| Seeding tracked in `seed_log` | Each seed item is inserted once. Edits are never overwritten and deletions are never undone by later restarts. |
| Real screenshots for Sapthagiri | Captured by running `sapthagiri-app` locally with its own starter catalogue. Labelled as such on the site, not presented as live client data. |
| Illustrative SVG visuals for projects without screenshots | Distinct per project type, always tagged "Illustrative", and containing no data or claims. |

## Content notes / open items for Snigdh

- **PULSE:** no description exists in the repository or CV, so it's seeded as a **draft** placeholder. Fill it in under Admin → Projects → PULSE and publish.
- **Sentinel:** found in this repository (root app). Seeded as a **draft** project based on its README. Publish it if you want it showcased.
- **Alpha-Beta:** only the CV line is known ("full-featured PDF utility app deployed for college-wide use"). Add features, screenshots and links in the admin.
- **Sapthagiri Enterprises:** your brief calls it a festive and celebrations *apparel* brand. The site's own copy describes party and festival decorations plus children's costumes, so the description uses "festive and celebration products". Adjust if needed. No live URL and no repository link are set (client code may be private). Add them in the admin if you want.
- **Research paper:** status shown as "Submitted to IIMC-FRC". No year, PDF or limitations section is set because none were provided. Upload the PDF under Research → Paper PDF if you want it downloadable.
- **Colossus '26:** shown as an *invitation* to judge, not as completed judging.
- **GitHub social link:** seeded as a draft (`github.com/snigdhrn06-lab`). Publish it if you want it shown.
- Hero statistics use only CV figures: 9+ finals, 15+ first places, 1,471 logged tests, and the 6.25× research finding.

## Verified in this session

- `npm run typecheck`, `npm run lint`: clean
- `npm test`: 27 unit and integration tests against real PostgreSQL 16 (migrations, seed idempotency, no resurrection of deleted seed rows, CRUD, slug uniqueness, validation, media pipeline incl. SVG rejection and EXIF stripping, rate limiting, admin provisioning)
- `npm run build` + `npm start` (production mode) on a fresh database: migrations, seed and admin bootstrap ran from `npm start`
- `npm run test:e2e`: 33 browser/HTTP checks against the production server (auth, CSRF, cross-origin block, rate limit, draft privacy, publish/edit/delete going live, upload, set cover, delete media, settings and section visibility, contact form + inbox, mobile/tablet overflow, mobile menu, reduced motion, skip link, no console errors)
- Media persistence across a server restart (served from Postgres)

## Not verified (needs your accounts)

- An actual Render deployment, custom domain and TLS
- S3/R2 storage against a real bucket
- Resend email delivery
