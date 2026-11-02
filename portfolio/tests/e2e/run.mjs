/**
 * End-to-end checks against a RUNNING server (default http://localhost:3000).
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run test:e2e
 *
 * Uses Playwright (install with `npm i -D playwright && npx playwright install chromium` if missing).
 * Creates temporary content prefixed "E2E" and deletes it again. Run it against a test database,
 * not your live site. Screenshots are written to tests/e2e/screenshots/ (git-ignored).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin on the server under test).");
  process.exit(1);
}
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshots");
mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const anon = (p, init) => fetch(BASE + p, { redirect: "manual", ...init });

const browser = await chromium.launch();
const consoleErrors = [];
const watch = (page, label) => {
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${label}: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => consoleErrors.push(`${label}: ${e.message}`));
};

console.log(`\nE2E against ${BASE}\n`);

// ───────────── Public site ─────────────
console.log("Public site");
await check("health check reports the database is up", async () => {
  const r = await anon("/api/health");
  const body = await r.json();
  assert(r.status === 200 && body.db === "up", `status ${r.status} ${JSON.stringify(body)}`);
});

await check("security headers are present (nonce CSP, frame, nosniff)", async () => {
  const r = await anon("/");
  const csp = r.headers.get("content-security-policy") ?? "";
  assert(/script-src 'self' 'nonce-/.test(csp), "CSP nonce missing");
  assert(csp.includes("frame-ancestors 'none'"), "frame-ancestors missing");
  assert(r.headers.get("x-frame-options") === "DENY", "X-Frame-Options missing");
  assert(r.headers.get("x-content-type-options") === "nosniff", "nosniff missing");
  assert(!r.headers.get("x-powered-by"), "x-powered-by exposed");
});

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const home = await desktop.newPage();
watch(home, "home");
await check("homepage renders seeded content and all images load", async () => {
  await home.goto(BASE + "/", { waitUntil: "networkidle" });
  await home.waitForTimeout(2500);
  const h1 = await home.locator("h1").first().getAttribute("aria-label");
  assert(h1 === "Snigdh R.N.", `h1 was ${h1}`);
  for (const id of ["about", "research", "projects", "achievements", "experience", "skills", "contact"]) {
    assert(await home.locator(`section#${id}`).count(), `section #${id} missing`);
  }
  const text = await home.locator("body").innerText();
  assert(text.includes("Marked to Market, Mistaken for Money"), "research paper missing");
  assert(text.includes("Sapthagiri Enterprises"), "Sapthagiri project missing");
  assert(!text.includes("PULSE"), "draft PULSE is visible publicly");
  // scroll everything into view so lazy images load, then verify none are broken
  const height = await home.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await home.evaluate((yy) => window.scrollTo(0, yy), y);
    await home.waitForTimeout(80);
  }
  await home.waitForTimeout(1500);
  const broken = await home.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  assert(broken.length === 0, `broken images: ${broken.join(", ")}`);
  await home.evaluate(() => window.scrollTo(0, 0));
  await home.waitForTimeout(500);
  await home.screenshot({ path: path.join(SHOTS, "desktop-home.png") });
});

await check("contact links: WhatsApp (encoded), mailto, LinkedIn", async () => {
  const hrefs = await home.$$eval("#contact a", (as) => as.map((a) => a.getAttribute("href")));
  assert(hrefs.some((h) => h?.startsWith("https://wa.me/916361686265?text=Hi%20Snigdh")), "WhatsApp link missing");
  assert(hrefs.some((h) => h?.startsWith("mailto:snigdhrn06@gmail.com")), "mailto link missing");
  assert(hrefs.includes("https://www.linkedin.com/in/snigdh-r-n-850421383/"), "LinkedIn link missing");
  const ext = await home.$$eval('#contact a[target="_blank"]', (as) => as.every((a) => (a.getAttribute("rel") ?? "").includes("noopener")));
  assert(ext, "external links missing rel=noopener");
});

await check("project and research detail pages render", async () => {
  const p = await desktop.newPage();
  watch(p, "detail");
  await p.goto(BASE + "/projects/sapthagiri-enterprises", { waitUntil: "networkidle" });
  assert((await p.locator("h1").getAttribute("aria-label")) === "Sapthagiri Enterprises", "project h1");
  assert((await p.locator("text=Owner portal dashboard").count()) > 0, "gallery caption missing");
  await p.screenshot({ path: path.join(SHOTS, "desktop-project.png") });
  await p.goto(BASE + "/research/marked-to-market-mistaken-for-money", { waitUntil: "networkidle" });
  const t = await p.locator("body").innerText();
  const lower = t.toLowerCase();
  assert(t.includes("6.25×") && lower.includes("submitted to iimc-frc") && lower.includes("methodology"), "research content missing");
  await p.close();
});

await check("drafts are hidden from pages and the sitemap; 404 page renders", async () => {
  const r = await anon("/projects/pulse");
  assert(r.status === 404, `draft page status ${r.status}`);
  assert((await r.text()).includes("No signal"), "custom 404 not rendered");
  const sm = await (await anon("/sitemap.xml")).text();
  assert(sm.includes("/projects/sapthagiri-enterprises") && !sm.includes("/projects/pulse"), "sitemap draft leak");
  const robots = await (await anon("/robots.txt")).text();
  assert(robots.includes("Disallow: /admin"), "robots missing admin disallow");
});

await check("résumé link redirects to the PDF", async () => {
  const r = await anon("/resume");
  assert(r.status === 302 || r.status === 307, `status ${r.status}`);
  const pdf = await fetch(new URL(r.headers.get("location"), BASE));
  assert(pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf", "PDF not served");
});

await check("social preview image is generated", async () => {
  const r = await anon("/opengraph-image");
  assert(r.status === 200 && r.headers.get("content-type")?.startsWith("image/png"), `status ${r.status}`);
});

await check("contact form: validation errors, then a stored message", async () => {
  await home.locator("#contact").scrollIntoViewIfNeeded();
  await home.fill('input[name="name"]', "E2E Visitor");
  await home.fill('input[name="email"]', "not-an-email");
  await home.fill('textarea[name="message"]', "short");
  await home.click('button:has-text("Send message")');
  await home.waitForSelector('[role="alert"]');
  await home.fill('input[name="email"]', "visitor@example.com");
  await home.fill('textarea[name="message"]', "Hello from the end-to-end test suite.");
  await home.click('button:has-text("Send message")');
  await home.waitForSelector("text=Message received.", { timeout: 15000 });
});

// ───────────── Admin security ─────────────
console.log("\nAdmin security");
await check("unauthenticated admin API calls are rejected", async () => {
  assert((await anon("/api/admin/projects")).status === 401, "GET not 401");
  const post = await anon("/api/admin/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "hack" }) });
  assert(post.status === 401, `POST ${post.status}`);
  assert((await anon("/api/admin/settings", { method: "PUT", body: "{}" })).status === 401, "settings PUT not 401");
  assert((await anon("/api/admin/media/00000000-0000-0000-0000-000000000000", { method: "DELETE" })).status === 401, "media DELETE not 401");
});

await check("admin pages redirect to sign-in when signed out", async () => {
  const r = await anon("/admin/projects");
  assert([302, 307].includes(r.status) && r.headers.get("location")?.includes("/admin/login"), `status ${r.status}`);
});

await check("wrong password is refused", async () => {
  const r = await anon("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" }, body: JSON.stringify({ email: EMAIL, password: "definitely-wrong" }) });
  assert(r.status === 401, `status ${r.status}`);
});

const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await admin.newPage();
watch(page, "admin");
await check("admin can sign in through the form", async () => {
  await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + "/admin", { timeout: 20000 });
  const cookies = await admin.cookies();
  const c = cookies.find((x) => x.name.includes("srn_admin"));
  assert(c && c.httpOnly && c.sameSite === "Lax", "session cookie must be HttpOnly + SameSite=Lax");
});

// Helper: call the admin API from inside the signed-in page (same origin, real cookie, captured CSRF token).
let CSRF = "";
async function adminApi(method, url, body, { withCsrf = true, origin } = {}) {
  return page.evaluate(
    async ({ method, url, body, withCsrf, origin, token }) => {
      const headers = { "content-type": "application/json" };
      if (withCsrf) headers["x-csrf-token"] = token;
      if (origin) headers["origin"] = origin;
      const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    { method, url, body, withCsrf, origin, token: CSRF },
  );
}
// Capture the CSRF token the admin client sends by observing a real request.
await check("CSRF token is required for mutations", async () => {
  const tokenPromise = page.waitForRequest((r) => r.url().includes("/api/admin/") && r.method() !== "GET");
  await page.goto(BASE + "/admin/messages", { waitUntil: "networkidle" });
  await page.locator("ul li button").first().click(); // opening an unread message marks it read (PATCH)
  const req = await tokenPromise;
  const token = req.headers()["x-csrf-token"];
  assert(token && token.length > 20, "client did not send a CSRF token");
  CSRF = token;
  const noToken = await adminApi("POST", "/api/admin/projects", { title: "E2E no csrf" }, { withCsrf: false });
  assert(noToken.status === 403, `missing token gave ${noToken.status}`);
});

await check("contact message arrived in the admin inbox", async () => {
  const t = await page.locator("body").innerText();
  assert(t.includes("E2E Visitor") && t.includes("Hello from the end-to-end test suite."), "message not in inbox");
});

// ───────────── Content lifecycle ─────────────
console.log("\nContent management");
let projectId = null;
let slug = null;
await check("create a draft project through the editor UI", async () => {
  await page.goto(BASE + "/admin/projects/new", { waitUntil: "networkidle" });
  await page.fill("#f-title", "E2E Test Project");
  await page.fill("#f-summary", "Created by the end-to-end test.");
  await page.click('button:has-text("Create project")');
  await page.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}$/, { timeout: 20000 });
  projectId = page.url().split("/").pop();
  const r = await adminApi("GET", `/api/admin/projects/${projectId}`);
  slug = r.body.item.slug;
  assert(slug === "e2e-test-project" && r.body.item.status === "draft", JSON.stringify(r.body.item?.status));
});

await check("the draft is invisible publicly but previewable by the admin", async () => {
  assert((await anon(`/projects/${slug}`)).status === 404, "draft visible anonymously");
  const p = await admin.newPage();
  await p.goto(`${BASE}/projects/${slug}`, { waitUntil: "networkidle" });
  assert((await p.locator("text=Draft preview").count()) > 0, "admin preview banner missing");
  await p.close();
});

await check("publishing from the list makes it live immediately", async () => {
  await page.goto(BASE + "/admin/projects", { waitUntil: "networkidle" });
  const row = page.locator("li", { hasText: "E2E Test Project" });
  await row.locator('button:has-text("draft")').click();
  await row.locator('button:has-text("published")').waitFor({ timeout: 15000 });
  const r = await anon(`/projects/${slug}`);
  assert(r.status === 200, `public status ${r.status}`);
  assert((await (await anon("/")).text()).includes("E2E Test Project"), "not on homepage");
});

await check("editing the title updates the public site without a redeploy", async () => {
  await page.goto(`${BASE}/admin/projects/${projectId}`, { waitUntil: "networkidle" });
  await page.fill("#f-title", "E2E Renamed Project");
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector("text=All changes saved", { timeout: 15000 });
  assert((await (await anon(`/projects/${slug}`)).text()).includes("E2E Renamed Project"), "rename not visible");
});

await check("invalid input shows field errors (bad URL)", async () => {
  await page.fill("#f-liveUrl", "javascript:alert(1)");
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector("#f-liveUrl-err", { timeout: 10000 });
  await page.fill("#f-liveUrl", "");
});

let mediaUrl = null;
await check("upload an image, set it as the cover, and it is served", async () => {
  const up = await page.evaluate(async (token) => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 750;
    const g = c.getContext("2d");
    g.fillStyle = "#3a6";
    g.fillRect(0, 0, 1200, 750);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const fd = new FormData();
    fd.append("file", new File([blob], "e2e-cover.png", { type: "image/png" }));
    const r = await fetch("/api/admin/media", { method: "POST", headers: { "x-csrf-token": token }, body: fd });
    return { status: r.status, body: await r.json() };
  }, CSRF);
  assert(up.status === 201, `upload status ${up.status} ${JSON.stringify(up.body)}`);
  const media = up.body.items[0];
  const item = (await adminApi("GET", `/api/admin/projects/${projectId}`)).body.item;
  const put = await adminApi("PUT", `/api/admin/projects/${projectId}`, { ...item, coverMediaId: media.id });
  assert(put.status === 200, `PUT ${put.status}`);
  const html = await (await anon(`/projects/${slug}`)).text();
  mediaUrl = media.url;
  assert(html.includes(media.variants[0].url), "cover not on page");
  const img = await anon(media.url);
  assert(img.status === 200 && img.headers.get("content-type") === "image/webp", `media status ${img.status}`);
  // replace: delete the media → reference cleared, page still renders
  const del = await adminApi("DELETE", `/api/admin/media/${media.id}`);
  assert(del.status === 200, `media delete ${del.status}`);
  assert((await anon(mediaUrl)).status === 404, "deleted media still served");
  assert((await anon(`/projects/${slug}`)).status === 200, "page broke after media delete");
});

await check("rejects a disguised non-image upload", async () => {
  const r = await page.evaluate(async (token) => {
    const fd = new FormData();
    fd.append("file", new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "x.png", { type: "image/png" }));
    const res = await fetch("/api/admin/media", { method: "POST", headers: { "x-csrf-token": token }, body: fd });
    return res.status;
  }, CSRF);
  assert(r === 415, `status ${r}`);
});

await check("delete the project; it disappears publicly", async () => {
  await page.goto(`${BASE}/admin/projects/${projectId}`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Delete")');
  await page.locator("dialog[open] button", { hasText: "Delete" }).click();
  await page.waitForURL(BASE + "/admin/projects", { timeout: 15000 });
  assert((await anon(`/projects/${slug}`)).status === 404, "deleted project still public");
});

await check("achievement create, edit and delete reflect on the homepage", async () => {
  const c = await adminApi("POST", "/api/admin/achievements", { title: "1st Place", placement: 1, event: "E2E Finance Challenge", year: "2026", status: "published" });
  assert(c.status === 201, `create ${c.status}`);
  assert((await (await anon("/")).text()).includes("E2E Finance Challenge"), "not on homepage");
  const u = await adminApi("PUT", `/api/admin/achievements/${c.body.item.id}`, { ...c.body.item, event: "E2E Finance Challenge (edited)" });
  assert(u.status === 200, `update ${u.status}`);
  assert((await (await anon("/")).text()).includes("E2E Finance Challenge (edited)"), "edit not visible");
  assert((await adminApi("DELETE", `/api/admin/achievements/${c.body.item.id}`)).status === 200, "delete failed");
  assert(!(await (await anon("/")).text()).includes("E2E Finance Challenge"), "still visible after delete");
});

await check("site settings changes (headline, section visibility) go live", async () => {
  const before = (await adminApi("GET", "/api/admin/settings")).body.settings;
  const sections = before.sections.map((s) => (s.key === "skills" ? { ...s, visible: false } : s));
  const r = await adminApi("PUT", "/api/admin/settings", { ...before, headline: "E2E *headline* test", sections });
  assert(r.status === 200, `PUT ${r.status}`);
  const html = await (await anon("/")).text();
  assert(html.includes("E2E headline test") && !html.includes('id="skills"'), "settings not applied");
  const bad = await adminApi("PUT", "/api/admin/settings", { ...before, email: "not-an-email" });
  assert(bad.status === 400 && bad.body.fields?.email, "invalid settings accepted");
  assert((await adminApi("PUT", "/api/admin/settings", before)).status === 200, "restore failed");
});

await check("cross-origin mutation is blocked even with a valid session", async () => {
  // Browsers forbid scripts from setting Origin, so test this server-side check with a raw request + cookie.
  const cookie = (await admin.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const token = CSRF;
  const r = await anon("/api/admin/projects", { method: "POST", headers: { cookie, origin: "https://evil.example", "x-csrf-token": token, "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) });
  assert(r.status === 403, `status ${r.status}`);
});

await check("sign out ends the session", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await page.click('button:has-text("Sign out")');
  await page.waitForURL(/\/admin\/login/, { timeout: 15000 });
  const r = await page.evaluate(async () => (await fetch("/api/admin/projects")).status);
  assert(r === 401, `after logout status ${r}`);
});

// ───────────── Responsive & motion ─────────────
console.log("\nResponsive & accessibility");
await check("mobile: menu opens, links work, no horizontal overflow", async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await m.newPage();
  watch(p, "mobile");
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  // Compare against the device width: on mobile, overflowing content widens the layout viewport itself.
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - 390);
  assert(overflow <= 1, `horizontal overflow ${overflow}px`);
  await p.screenshot({ path: path.join(SHOTS, "mobile-home.png") });
  await p.click('button[aria-label="Open menu"]');
  await p.waitForSelector("#mobile-menu");
  await p.screenshot({ path: path.join(SHOTS, "mobile-menu.png") });
  await p.locator("#mobile-menu a", { hasText: "Projects" }).click();
  await p.waitForTimeout(1200);
  assert((await p.locator("#mobile-menu").count()) === 0, "menu did not close");
  await p.goto(BASE + "/projects/sapthagiri-enterprises", { waitUntil: "networkidle" });
  const o2 = await p.evaluate(() => document.documentElement.scrollWidth - 390);
  assert(o2 <= 1, `project page overflow ${o2}px`);
  await p.screenshot({ path: path.join(SHOTS, "mobile-project.png"), fullPage: true });
  await m.close();
});

await check("tablet layout renders without overflow", async () => {
  const t = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const p = await t.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  assert((await p.evaluate(() => document.documentElement.scrollWidth - 820)) <= 1, "tablet overflow");
  await p.screenshot({ path: path.join(SHOTS, "tablet-home.png") });
  await t.close();
});

await check("reduced motion: no intro overlay, content visible immediately", async () => {
  const r = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const p = await r.newPage();
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(300);
  const overlayVisible = await p.evaluate(() => {
    const el = document.querySelector(".intro-overlay");
    return !!el && getComputedStyle(el).display !== "none";
  });
  assert(!overlayVisible, "intro overlay shown despite reduced motion");
  await r.close();
});

await check("keyboard: skip link is the first focusable element", async () => {
  const k = await browser.newContext({ reducedMotion: "reduce" });
  const p = await k.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.keyboard.press("Tab");
  const text = await p.evaluate(() => document.activeElement?.textContent?.trim());
  assert(text === "Skip to content", `first focus: ${text}`);
  await k.close();
});

// ───────────── Rate limiting (last: it locks this IP for 15 min) ─────────────
console.log("\nRate limiting");
await check("login is rate-limited after repeated failures", async () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await anon("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ email: `nobody${i}@example.com`, password: "wrong-password" }) });
    last = r.status;
  }
  assert(last === 429, `6th attempt status ${last}`);
});

await check("no console errors on any page visited", async () => {
  const relevant = consoleErrors.filter((e) => !/Failed to load resource: the server responded with a status of (400|401|403|404|415)/.test(e));
  assert(relevant.length === 0, relevant.join("\n      "));
});

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed${failures.length ? `: ${failures.join("; ")}` : ""}\n`);
process.exit(failures.length ? 1 : 0);
