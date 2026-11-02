/**
 * Builds docs/Snigdh_Personal_Website_Codebase_Handbook.pdf from docs/HANDBOOK.md.
 *   npm run docs:pdf
 * Requires: pandoc (https://pandoc.org) and Playwright's Chromium
 * (`npm i -D playwright && npx playwright install chromium` if it's not available globally).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "Snigdh_Personal_Website_Codebase_Handbook.pdf");
const build = path.join(here, ".build");
mkdirSync(build, { recursive: true });

const css = `
@page { size: A4; margin: 22mm 18mm 20mm 18mm; }
html { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10pt; color: #1b1c1e; line-height: 1.5; }
body { margin: 0; }
header#title-block-header { break-after: page; page-break-after: always; border-left: 6px solid #9bc53d; padding: 120mm 0 6mm 14mm; }
header#title-block-header .title { font-family: Georgia, serif; font-weight: normal; font-size: 40pt; line-height: 1.05; margin: 0; }
header#title-block-header .subtitle { font-size: 20pt; color: #6b8f1a; margin: 6mm 0 0; }
header#title-block-header .date { color: #777; margin-top: 10mm; }
nav#TOC { page-break-after: always; font-size: 8.6pt; line-height: 1.32; }
nav#TOC::before { content: "Contents"; display: block; font-family: Georgia, serif; font-size: 22pt; margin-bottom: 6mm; }
nav#TOC ul { list-style: none; padding-left: 0; margin: 0; }
nav#TOC > ul > li { margin: 1.4mm 0; font-weight: bold; }
nav#TOC ul ul { padding-left: 6mm; font-weight: normal; }
nav#TOC ul ul li { margin: 0.2mm 0; }
nav#TOC a { color: #1b1c1e; text-decoration: none; }
h1 { font-family: Georgia, serif; font-weight: normal; font-size: 22pt; border-bottom: 2px solid #9bc53d; padding-bottom: 2mm; margin-top: 0; page-break-before: always; }
h2 { font-size: 13pt; margin-top: 7mm; color: #2c4a07; page-break-after: avoid; }
h3 { font-size: 11pt; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
a { color: #3b6ea5; }
code { font-family: Menlo, Consolas, monospace; font-size: 8.6pt; background: #f2f4ee; padding: 0.3mm 1mm; border-radius: 2px; }
pre { background: #f6f7f4; border: 1px solid #e3e6dc; padding: 3mm; border-radius: 3px; font-size: 7.8pt; line-height: 1.35; overflow: hidden; white-space: pre-wrap; page-break-inside: auto; }
pre code { background: none; padding: 0; font-size: inherit; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 8.6pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #eef3e2; text-align: left; }
th, td { border: 1px solid #dfe3d6; padding: 1.6mm 2mm; vertical-align: top; }
td code { word-break: break-all; }
.diagram { margin: 4mm 0; page-break-inside: avoid; }
img { max-width: 100%; height: auto; } p:has(> img) { page-break-inside: avoid; margin: 4mm 0; }
strong { color: #111; }
`;
writeFileSync(path.join(build, "style.css"), css);

const html = path.join(build, "handbook.html");
execFileSync("pandoc", [
  path.join(here, "HANDBOOK.md"),
  "--standalone",
  "--toc",
  "--toc-depth=2",
  "--metadata", "lang=en",
  "--css", path.join(build, "style.css"),
  "--embed-resources",
  "--resource-path", here,
  "-o", html,
], { stdio: "inherit" });

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright not found. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + html, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:7pt;color:#999;width:100%;padding:0 18mm;font-family:Helvetica,Arial,sans-serif;">Snigdh R.N. — Personal Website · Codebase Handbook</div>`,
  footerTemplate: `<div style="font-size:7pt;color:#999;width:100%;padding:0 18mm;text-align:right;font-family:Helvetica,Arial,sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  margin: { top: "22mm", bottom: "20mm", left: "18mm", right: "18mm" },
});
await browser.close();
console.log("Wrote", path.relative(process.cwd(), out));
