# Snigdh R.N. — Personal Portfolio + Admin CMS

A cinematic personal portfolio for **Snigdh R.N.** (applied finance, markets research, quantitative strategy and software) with a private, database-backed **admin CMS** at `/admin` that controls every piece of public content.

- **Public site:** hero, About (two real photographs), Research (IIMC-FRC paper with findings), Projects (with case-study pages), Achievements, Experience & Education, Skills, Contact (WhatsApp, email, LinkedIn, form).
- **Admin CMS:** secure sign-in, a dashboard, and create/edit/delete/publish/reorder for projects, research, achievements, experience, education, skills, social links and resources. Also site settings (profile, hero, about, photos, section order, contact, SEO, accent colour), a media library with uploads, a contact inbox and account security.
- **Stack:** Next.js 15 (App Router, TypeScript), PostgreSQL + Drizzle ORM, Tailwind CSS, Framer Motion, sharp, zod. Deploys to Render as a single web service with a Render Postgres database.

> 📘 The full maintenance guide (every file explained, how to edit everything, deployment, troubleshooting) is in **[`docs/Snigdh_Personal_Website_Codebase_Handbook.pdf`](docs/Snigdh_Personal_Website_Codebase_Handbook.pdf)** (source: [`docs/HANDBOOK.md`](docs/HANDBOOK.md)).
> 🚀 Deployment: **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**. Decisions and status: **[`docs/PROGRESS.md`](docs/PROGRESS.md)**.

## Quick start (local)

Requirements: Node.js 20.9+ (22 recommended) and PostgreSQL 14+.

```bash
cd portfolio
npm install
cp .env.example .env          # then edit DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
createdb portfolio            # or create the database any way you like
npm run db:prepare            # migrations + content seed + first admin account
npm run dev                   # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | **Production start**: migrate → seed (idempotent) → admin bootstrap → `next start` |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/` |
| `npm run db:seed` | Insert any seed content not inserted before (never overwrites edits) |
| `npm run db:generate` | Create a new migration after editing `src/lib/db/schema.ts` |
| `npm run admin:create -- --email you@x.com [--reset]` | Create an admin or reset a password from the CLI |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests (integration uses `TEST_DATABASE_URL`, default `postgres://postgres@localhost:5432/portfolio_test`) |
| `npm run test:e2e` | Browser end-to-end tests against a running server (see `tests/e2e/run.mjs`) |
| `npm run docs:pdf` | Regenerate the handbook PDF from `docs/HANDBOOK.md` |

## Project layout

```
portfolio/
├── src/app/            routes: (site) public pages, admin/ CMS, api/ endpoints, media/, resume/
├── src/components/     site/ (public sections), admin/ (CMS UI), motion/, shared/
├── src/lib/            db/, auth/, content/ (schemas, registry, queries), storage/, media, ops/
├── drizzle/            SQL migrations
├── seed/               verified initial content + photos, CV and screenshots
├── scripts/            migrate, seed, prepare (start-up), create-admin
├── tests/              unit/, integration/, e2e/
├── docs/               handbook (MD + PDF), deployment guide, progress log
└── render.yaml         Render Blueprint (set Blueprint Path to portfolio/render.yaml)
```

## Content integrity

All seeded content comes from the CV, the brief and the code in this repository. Placeholders that would need invented details (for example PULSE) are seeded as **drafts**, which are never public. Research figures are labelled as reported in the working paper, and backtests are labelled as historical simulations.
