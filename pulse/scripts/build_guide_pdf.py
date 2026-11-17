"""Build PULSE_Guide.pdf from GUIDE.md and the annotated screenshots in artifacts/guide/.

Run: .venv/bin/python scripts/guide_shots.py   (refresh pictures, optional)
     .venv/bin/python scripts/build_guide_pdf.py
Needs `markdown` (pip install markdown) and Playwright's Chromium.
"""
import datetime
import glob
import os
import pathlib
import re

import markdown

ROOT = pathlib.Path(__file__).resolve().parents[1]


KEEP_SIDEBAR = {"01_judge_home.jpg", "02_story_1.jpg", "35_mobile.jpg", "11_film.jpg"}


def prepare_images(tmpdir: pathlib.Path) -> dict:
    """Crop the repeated sidebar and split very tall shots so text stays readable on A4. Returns name -> [files]."""
    from PIL import Image

    tmpdir.mkdir(exist_ok=True)
    out = {}
    for f in sorted((ROOT / "artifacts" / "guide").glob("*.jpg")):
        im = Image.open(f).convert("RGB")
        if f.name not in KEEP_SIDEBAR and im.width == 1440:
            im = im.crop((390, 30, 1400, im.height))
        parts, w, h = [], im.width, im.height
        max_h = int(w * 1.25)
        if h <= max_h * 1.15:
            cuts = [(0, h)]
        else:
            n = -(-h // max_h)
            step = -(-h // n)
            cuts = [(k * step, min(h, (k + 1) * step + 40)) for k in range(n)]
        for i, (a, b) in enumerate(cuts):
            q = tmpdir / f"{f.stem}_{i}.jpg"
            im.crop((0, a, w, b)).save(q, quality=82)
            parts.append(q.name)
        out[f.name] = parts
    return out


def md_to_html(text: str) -> str:
    out = []
    for ln in text.split("\n"):
        is_item = bool(re.match(r"^\s*(- |\d+\. )", ln))
        prev = out[-1] if out else ""
        if is_item and prev.strip() and not re.match(r"^\s*(- |\d+\. |\s{2,}- )", prev):
            out.append("")
        if re.match(r"^   - ", ln):
            ln = "    " + ln.lstrip()
        out.append(ln)
    body = markdown.markdown("\n".join(out), extensions=["tables", "sane_lists", "fenced_code"])
    # screenshots: wrap in a figure with the alt text as caption
    body = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)" ?/?></p>',
                  r'<figure><img src="\2" alt="\1"><figcaption>\1</figcaption></figure>', body)
    body = body.replace("<li>[ ] ", "<li class='todo'>☐ ")
    return body


CSS = """
@page { size: A4; margin: 15mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Inter', 'DejaVu Sans', Arial, sans-serif; color: #002124; font-size: 10pt; line-height: 1.55; }
.cover { height: 262mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;
         background: #002124; color: #fff; border-radius: 10px; padding: 26mm 18mm; }
.cover .kicker { color: #00FE89; letter-spacing: .18em; font-size: 10pt; font-weight: 700; }
.cover h1 { font-size: 48pt; border: none; margin: 8mm 0 0 0; color: #fff; line-height: 1.05; }
.cover h1 span { color: #00FE89; }
.cover .sub { font-size: 15pt; color: #CFE9E1; margin-top: 8mm; max-width: 150mm; }
.cover .logo { display: inline-block; background: #00FE89; color: #002124; font-weight: 800; border-radius: 8px;
               width: 14mm; height: 14mm; line-height: 14mm; text-align: center; font-size: 18pt; }
.cover .meta { font-size: 10pt; color: #9FC2B8; }
.cover .pill { display: inline-block; border: 1.5px solid #00FE89; color: #00FE89; border-radius: 99px; padding: 1mm 4mm;
               font-size: 9pt; font-weight: 700; letter-spacing: .08em; margin-top: 4mm; }
h1 { font-size: 22pt; border-bottom: 4px solid #00FE89; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 16pt; background: #002124; color: #fff; padding: 7px 12px; border-radius: 6px; margin-top: 0;
     page-break-before: always; page-break-after: avoid; }
h3 { font-size: 13pt; color: #002124; border-left: 5px solid #00AD7D; padding-left: 8px; margin-top: 18px; page-break-after: avoid; }
h4 { font-size: 11pt; color: #00AD7D; margin: 16px 0 6px 0; page-break-after: avoid; }
p { margin: 5px 0 7px 0; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 10px 0; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #002124; color: #fff; text-align: left; padding: 5px 7px; font-weight: 600; }
td { border-bottom: 1px solid #E3E3E3; padding: 5px 7px; vertical-align: top; }
tr:nth-child(even) td { background: #F6F8F8; }
blockquote { background: #EFFBF5; border-left: 5px solid #00AD7D; margin: 10px 0; padding: 7px 12px; border-radius: 0 6px 6px 0; }
blockquote p { margin: 3px 0; }
code { background: #E9EEEE; padding: 0 4px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 8.8pt; }
pre { background: #F2F5F5; padding: 8px 10px; border-radius: 6px; font-size: 8.5pt; line-height: 1.4; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
hr { border: none; border-top: 1px solid #E3E3E3; margin: 14px 0; }
li { margin: 2px 0; }
li.todo { list-style: none; margin-left: -14px; }
figure { margin: 10px 0 8px 0; page-break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 232mm; border: 1px solid #D5DCDC; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
figcaption { font-size: 8.5pt; color: #5B6F70; margin-top: 3px; font-style: italic; }
figure + ol, figure + ul { background: #FFF6F2; border: 1px solid #FFD9C9; border-radius: 6px; padding: 7px 10px 7px 30px; }
figure + ol li::marker { color: #FF5A1F; font-weight: 800; }
strong { color: #00121A; }
"""


def main():
    from playwright.sync_api import sync_playwright

    text = (ROOT / "GUIDE.md").read_text()
    text = re.sub(r"^# .*\n", "", text, count=1)  # the cover replaces the H1
    imgs = prepare_images(ROOT / "_guide_imgs")
    def swap(m):
        alt, src = m.group(1), m.group(2)
        parts = imgs.get(pathlib.Path(src).name, [pathlib.Path(src).name])
        total = len(parts)
        return "\n\n".join(f"![{alt}{f' (part {i + 1} of {total})' if total > 1 else ''}](_guide_imgs/{q})" for i, q in enumerate(parts))
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", swap, text)
    body = md_to_html(text)
    today = datetime.date.today().strftime("%d %B %Y")
    cover = f"""<div class='cover'>
  <div><span class='logo'>P</span></div>
  <div>
    <div class='kicker'>FOLLOW THE MONEY · THE BAKERY THAT TAKES BETS</div>
    <h1>PULSE<br><span>The complete team guide</span></h1>
    <div class='sub'>What the app does, how to open it, every screen and button with pictures, the maths in plain
    words, how we built it, and what to say to a judge.</div>
    <div class='pill'>ALL RESULTS ARE ON SIMULATED DATA</div>
  </div>
  <div class='meta'>CSITM, IIM Bangalore × PayU · Innovation Challenge final, 26 Nov 2026<br>Guide built {today} from the
  app itself; every picture is a real screenshot.</div>
</div>"""
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{cover}{body}</body></html>"
    tmp = ROOT / "_guide_build.html"
    tmp.write_text(html)
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM") or (sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")) or [None])[-1]
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--no-sandbox"], **({"executable_path": exe} if exe else {}))
            pg = b.new_page()
            pg.goto(tmp.as_uri(), wait_until="load")
            pg.pdf(path=str(ROOT / "PULSE_Guide.pdf"), format="A4", print_background=True, display_header_footer=True,
                   header_template="<span></span>",
                   footer_template="<div style='font-size:7.5px;width:100%;text-align:center;color:#5B6F70;font-family:Inter,sans-serif'>"
                                   "PULSE team guide · simulated data · page <span class='pageNumber'></span> of <span class='totalPages'></span></div>",
                   margin={"top": "14mm", "bottom": "15mm", "left": "13mm", "right": "13mm"})
            b.close()
    finally:
        tmp.unlink(missing_ok=True)
        import shutil
        shutil.rmtree(ROOT / "_guide_imgs", ignore_errors=True)
    print("wrote", ROOT / "PULSE_Guide.pdf")


if __name__ == "__main__":
    main()
