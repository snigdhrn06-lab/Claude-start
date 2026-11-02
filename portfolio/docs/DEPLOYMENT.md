# Deploying to Render

The portfolio runs on Render as **one Node web service** plus **one PostgreSQL database**. Content, admin sessions **and uploaded images/PDFs** are all stored in Postgres by default (`STORAGE_DRIVER=database`), so nothing important lives on Render's ephemeral disk. Restarts and redeploys never lose content.

> Status: the code is deployment-ready and was tested with a production build on a local PostgreSQL database. **It has not been deployed to Render from this session.** You need to do the steps below in your Render account.

## Option A: Blueprint (recommended, about 10 minutes)

1. Push this branch to GitHub (already done if you're reading this on GitHub).
2. Render dashboard → **New → Blueprint** → connect the **Claude-start** repository.
3. Choose the branch, and set **Blueprint Path** to `portfolio/render.yaml`.
   (The root `render.yaml` belongs to the separate Sentinel app. Don't use it for the portfolio.)
4. Render shows the resources it will create:
   - `snigdh-portfolio`: web service (root directory `portfolio`)
   - `snigdh-portfolio-db`: PostgreSQL (`basic-256mb`, a paid plan, because free Render databases expire after 30 days)
5. Fill in the variables marked *sync: false*:

   | Variable | Value |
   |---|---|
   | `ADMIN_EMAIL` | The email you'll sign in with |
   | `ADMIN_PASSWORD` | A strong password, **12+ characters** (only used to create the account) |
   | `SITE_URL` | Leave empty for now (Render's `RENDER_EXTERNAL_URL` is used automatically). Set it when you add a custom domain |
   | `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Optional, for email copies of contact messages (see below) |

   `DATABASE_URL` is wired from the database automatically, and `APP_SECRET` is generated.
6. Click **Apply**. The first build takes 3–6 minutes. On start, the logs should show:
   ```
   [prepare] migrations applied
   [seed] done: 63 inserted, 0 already present
   [admin] Created admin account for you@example.com …
   ```
7. Open `https://snigdh-portfolio.onrender.com` (your exact URL is shown in the dashboard), then `/admin`, and sign in.
8. **Security step:** in the service's **Environment** tab, **delete `ADMIN_PASSWORD`** and save. The account stays. The variable is only needed to create it.

## Option B: Manual setup

1. **New → PostgreSQL**: name it, pick a region (e.g. Singapore) and a paid plan. Copy the **Internal Database URL**.
2. **New → Web Service** → the repository → set:

   | Setting | Value |
   |---|---|
   | Root Directory | `portfolio` |
   | Runtime | Node |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |
   | Environment | `NODE_VERSION=22`, `DATABASE_URL=<internal URL>`, `APP_SECRET=<random 64 hex chars>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORAGE_DRIVER=database` |

3. Deploy, sign in at `/admin`, then remove `ADMIN_PASSWORD`.

### Using a free Neon database instead

Delete the `databases:` block from `portfolio/render.yaml` (and the `fromDatabase` entry), then set `DATABASE_URL` by hand to your Neon **pooled** connection string (`…-pooler….neon.tech/neondb?sslmode=require`). SSL certificate verification is automatic for non-local hosts. Neon's free tier doesn't expire, but database storage is limited (0.5 GB). That's plenty for this site's text and a modest media library.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `APP_SECRET` | ✅ | Salt for hashing IP addresses in the rate-limit table |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First boot | Creates the first admin (never overwrites an existing password) |
| `ADMIN_RESET_PASSWORD` | Recovery | `true` resets that admin's password to `ADMIN_PASSWORD` on start. Set back to `false` afterwards |
| `STORAGE_DRIVER` | – | `database` (default) · `s3` · `local` (dev only) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` | If `s3` | Object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO) |
| `SITE_URL` | – | Canonical URL. Also settable in Admin → Site settings → SEO |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | – | Email copies of contact messages |
| `PGSSL` | – | `disable` / `no-verify` / `verify` to override automatic SSL |
| `SKIP_SEED` | – | `true` skips the seed on start |
| `PG_POOL_MAX` | – | Connection pool size (default 5) |

## Media storage choices

- **`database` (default):** files are stored as `bytea` in the `media_blobs` table. No extra service, no extra credentials, backed up with your database. Images are converted to compact WebP variants (usually 10–80 KB each), so a typical portfolio library uses only a few MB.
- **`s3`:** recommended only if the library grows large (hundreds of MB). Example for **Cloudflare R2**: create a bucket and an API token with *Object Read & Write*, then set
  `STORAGE_DRIVER=s3`, `S3_BUCKET=<bucket>`, `S3_REGION=auto`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
  Leave `S3_PUBLIC_URL` empty to serve files through the app (bucket stays private), or set it to the bucket's public/custom domain.
  *Switching drivers does not move existing files.* Re-upload them, or keep the database driver.
  *(The S3 driver is implemented with the official AWS SDK but was not tested against a live bucket in this session.)*

## Contact form email (optional)

Every message is saved in **Admin → Messages** whether or not email is configured. To also get an email:

1. Create a free account at resend.com and verify a domain you own.
2. Set `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (e.g. `Portfolio <hello@yourdomain.com>`) and optionally `CONTACT_TO_EMAIL` (defaults to the email in Site settings).

## Custom domain

1. Service → **Settings → Custom Domains → Add**, for example `snigdh.in` and `www.snigdh.in`.
2. Add the DNS records Render shows (CNAME for `www`, A/ALIAS for the apex) at your registrar. TLS is issued automatically.
3. Set `SITE_URL=https://snigdh.in` (or Admin → Site settings → SEO → Site URL) so canonical links, the sitemap and social previews use the domain.

## Verification checklist

- [ ] `https://<your-url>/api/health` returns `{"ok":true,"db":"up",…}`
- [ ] The homepage shows your content, both photographs and the project screenshots
- [ ] `/admin` redirects to the sign-in page, and you can sign in
- [ ] Edit something (e.g. the hero headline), save, refresh the homepage, and the change is visible
- [ ] Upload an image in **Media**, use it somewhere, then trigger **Manual Deploy → Deploy latest commit** in Render. After the redeploy, the image and edit are still there (**proves persistence**)
- [ ] `/resume` downloads your CV PDF
- [ ] Send a test message through the contact form and confirm it appears in **Admin → Messages**
- [ ] `ADMIN_PASSWORD` has been removed from the environment
- [ ] Share the URL in a WhatsApp/LinkedIn draft and check the preview card

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails with `DATABASE_URL is not set` | Variable missing | Add it (or re-sync the Blueprint) |
| `password authentication failed` (28P01) | Wrong or rotated DB password | Copy the connection string again |
| `self-signed certificate in certificate chain` | Provider uses a private CA | Set `PGSSL=no-verify` |
| Health check failing / service restarts | DB unreachable, or start command wrong | Check logs for `[prepare] failed:` with the reason |
| Can't sign in, "No admin account exists" | `ADMIN_EMAIL`/`ADMIN_PASSWORD` weren't set on first start | Set both and restart |
| Forgot the password | – | Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_RESET_PASSWORD=true`, restart, sign in, then remove them |
| "Too many failed attempts" | Login rate limit (5 failures / 15 min per IP) | Wait 15 minutes |
| First visit takes about 50 s | Free web instances sleep after 15 min idle | Upgrade to Starter, or accept cold starts |
| Images missing after switching to S3 | Old files are still in the database store | Re-upload, or switch back to `database` |
