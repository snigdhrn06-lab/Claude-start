"""Annotated screenshots for the team guide (GUIDE.md / PULSE_Guide.pdf).

Starts the app, opens each screen, clicks where needed, draws numbered orange callouts on the real controls, and saves
JPEGs to artifacts/guide/. Run: .venv/bin/python scripts/guide_shots.py   (about 3 minutes)
"""
import glob
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "guide"
PORT = int(os.environ.get("PULSE_PORT", "8611"))

# (file name, url path, actions, callouts, max height)
#   action: ("click", text) | ("tab", text) | ("select", current text, option text) | ("wait", seconds)
#   callout: (number, target) where target is "text" (in the main area), "side:text" (sidebar) or "css:selector"
SHOTS = [
    ("01_judge_home", "present", [], [
        (1, "side:Judge Mode home"), (2, "css:.sim-pill"), (3, "Start the guided story"), (4, "Open the sandbox"),
        (5, "Open the engines lab"), (6, "css:[data-testid='stMain'] [data-testid='stPageLink-NavLink'] >> nth=3"),
        (7, "Designed scenarios passed"), (8, "css:[data-testid='stMain'] button:has-text('Reset demo')"),
        (9, "side:Reset demo")], 1500),
    ("02_story_1", "story?step=1", [], [
        (1, "Watch the 2-minute film"), (2, "Offline copy (HTML)"), (3, "css:.stepper"),
        (4, "Meet Sunrise Bakery"), (5, "css:button:has-text('Next')")], 2600),
    ("03_story_2", "story?step=2", [], [(1, "Day T: the same merchant ID"), (2, "css:.updatemenu-button"),
                                         (3, "css:button:has-text('Next')")], 2600),
    ("04_story_3", "story?step=3", [], [
        (1, "css:[data-testid='stSlider']"), (2, "Drift from its own past"), (3, "Two-engine gate"),
        (4, "Last 24 h vs its own normal"), (5, "Shared with a banned front")], 1500),
    ("05_story_4", "story?step=4", [], [(1, "css:.bandcard"), (2, "Why"), (3, "The decision rule")], 2200),
    ("06_story_5", "story?step=5", [], [(1, "Takeover day, hour by hour"), (2, "Held (fingerprinted"),
                                         (3, "Which payments were held, and why"), (4, "A fingerprint isn't proof")], 1800),
    ("07_story_6", "story?step=6", [], [(1, "And the honest cases stay quiet"), (2, "Why one spike is fine")], 2600),
    ("08_story_7", "story?step=7", [], [(1, "Analyst case file"), (2, "Download case file (Markdown)"),
                                         (3, "Download case file (HTML with charts)")], 2200),
    ("09_sandbox", "sandbox", [], [
        (1, "css:[data-testid='stSelectbox']"), (2, "How you take over"), (3, "Betting money per day"),
        (4, "How winners get paid"), (5, "FALSE-ALARM TESTS"), (6, "css:.verdict"), (7, "Highest band"),
        (8, "Money per day"), (9, "Why PULSE acted")], 1700),
    ("10_sandbox_careful", "sandbox", [("select", "Overnight takeover", "Careful front"), ("wait", 4)], [
        (1, "css:.verdict"), (2, "Escaped"), (3, "blind spot")], 1900),
    ("11_film", "film", [("wait", 3)], [], 900),
    ("12_live", "live", [("click", "Inject takeover now"), ("select", "", "6 sim h / 2 s", 0), ("click", "▶ Play"), ("wait", 5), ("click", "❚❚ Pause"), ("wait", 2)], [
        (1, "css:button:has-text('Play'), button:has-text('Pause')"), (2, "Inject takeover now"), (3, "Trigger Diwali now"),
        (4, "Reset feed"), (5, "Merchant risk tiles"), (6, "Payments in the last simulated hour"), (7, "Alert queue")], 2200),
    ("13_flow_1", "flow", [], [(1, "1 · Where PULSE plugs in"), (2, "PULSE scores the"), (3, "Visible track"),
                               (4, "Hidden compliance track"), (5, "Intervention points")], 1000),
    ("14_flow_2", "flow", [("tab", "2 · Scoring API")], [(1, "2 · Scoring API"), (2, "Run a quick benchmark")], 1900),
    ("15_flow_3", "flow", [("tab", "3 · Analyst workload")], [(1, "Alert when the model score reaches")], 1500),
    ("16_flow_4", "flow", [("tab", "4 · Settlement simulator")], [(1, "4 · Settlement simulator")], 1500),
    ("17_analyst_1", "analyst", [], [(1, "1 · Queue"), (2, "css:[data-testid='stRadio']"),
                                     (3, "css:button:has-text('Approve') >> nth=0"), (4, "css:button:has-text('Escalate') >> nth=0"),
                                     (5, "css:button:has-text('Dismiss') >> nth=0")], 1200),
    ("18_analyst_2", "analyst", [("click", "Escalate"), ("wait", 2), ("tab", "2 · Audit log")], [(1, "2 · Audit log")], 1000),
    ("19_analyst_3", "analyst", [("tab", "3 · Case file")], [(1, "css:[data-testid='stSelectbox']")], 1800),
    ("20_analyst_4", "analyst", [("tab", "4 · Merchant's view")], [(1, "css:[data-testid='stSlider']"), (2, "css:.phone")], 1300),
    ("21_engines_1", "engines", [], [(1, "1 · Drift"), (2, "2 · Peers"), (3, "3 · Betting invariants"), (4, "4 · Network graph")], 2400),
    ("22_engines_2", "engines", [("tab", "2 · Peers")], [(1, "The peer gap in one line"), (2, "Why a naive peer z-score")], 2400),
    ("23_engines_3", "engines", [("tab", "3 · Betting invariants")], [], 2400),
    ("24_engines_4", "engines", [("tab", "4 · Network graph")], [], 2000),
    ("25_network", "network", [], [(1, "css:[data-testid='stSlider']"), (2, "Expected vs observed"), (3, "How to read it")], 2200),
    ("26_response_1", "response", [], [(1, "Friction ladder & costs"), (2, "Delta reserve calculator"), (3, "Earned Trust")], 2200),
    ("27_response_2", "response", [("tab", "Delta reserve calculator")], [], 2000),
    ("28_response_3", "response", [("tab", "Earned Trust")], [(1, "Consent tier")], 2000),
    ("29_explorer", "explorer", [], [(1, "css:[data-testid='stSelectbox']"), (2, "Show simulation truth"), (3, "Highest risk band"),
                                     (4, "Payments per day"), (5, "Reasons"), (6, "Hourly zoom")], 2600),
    ("30_evaluation", "evaluation", [], [(1, "Recall (fronts reaching L2+)"), (2, "Scenario scorecard"), (3, "Ablation"),
                                         (4, "Time to detect"), (5, "Fairness")], 2800),
    ("30b_real_shops", "evaluation", [], [(1, "css:table:has-text('Real honest shops')"), (2, "What we learned"),
                                          (3, "css:[data-testid='stSelectbox']")], 2800),
    ("31_rollout_1", "rollout", [], [(1, "Shadow mode on the simulated"), (2, "css:table:has-text('Stop rule')"), (3, "css:.jtile >> nth=0")], 1400),
    ("32_rollout_2", "rollout", [("tab", "2 · Why not a rules engine?")], [(1, "HONEST SHOPS FLAGGED: RULE"), (2, "FRONTS CAUGHT: PULSE")], 1500),
    ("33_qa", "qa", [], [], 1800),
    ("34_data", "data", [], [(1, "Real data"), (2, "Scenario rules & sources"), (3, "Fixtures & festivals"), (4, "Design parameters")], 1800),
]

# shots cropped to one section: name -> (text at the top of the section, height in px)
CLIP = {"30b_real_shops": ("Real shops we didn't design", 1260)}

JS_DRAW = """([boxes]) => {
  for (const [n, x, y, w, h] of boxes) {
    const o = document.createElement('div');
    o.style.cssText = `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${w + 8}px;height:${h + 8}px;border:3px solid #FF5A1F;`
      + 'border-radius:8px;z-index:999998;pointer-events:none;box-shadow:0 0 0 2px rgba(255,255,255,.7)';
    const b = document.createElement('div');
    b.textContent = n;
    b.style.cssText = `position:absolute;left:${Math.max(2, x - 20)}px;top:${Math.max(2, y - 20)}px;width:30px;height:30px;`
      + 'border-radius:50%;background:#FF5A1F;color:#fff;font:700 17px/30px Arial,sans-serif;text-align:center;'
      + 'z-index:999999;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;pointer-events:none';
    document.body.appendChild(o); document.body.appendChild(b);
  }
}"""


def chromium_path():
    hits = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"))
    return os.environ.get("PLAYWRIGHT_CHROMIUM") or (hits[-1] if hits else None)


def settle(page):
    time.sleep(0.6)
    for _ in range(80):
        if page.locator("[data-testid='stStatusWidget']").count() == 0:
            break
        time.sleep(0.25)
    time.sleep(1.2)


def locate(page, target):
    if target.startswith("css:"):
        return page.locator(target[4:]).first
    if target.startswith("side:"):
        return page.locator("[data-testid='stSidebar']").get_by_text(target[5:], exact=False).first
    return page.locator("[data-testid='stMain']").get_by_text(target, exact=False).first


def main():
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    proc = subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/Home.py", "--server.port", str(PORT), "--server.headless", "true"],
                            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(f"http://localhost:{PORT}/_stcore/health", timeout=2)
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.5)
        with sync_playwright() as p:
            kw = {"executable_path": chromium_path()} if chromium_path() else {}
            b = p.chromium.launch(args=["--no-sandbox"], **kw)
            for name, path, actions, callouts, height in SHOTS:
                if only and name not in only:
                    continue
                page = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
                page.goto(f"http://localhost:{PORT}/{path}", wait_until="domcontentloaded")
                page.wait_for_selector(".sim-pill", state="attached", timeout=90000)
                settle(page)
                for act in actions:
                    if act[0] == "click":
                        page.locator("[data-testid='stMain']").get_by_text(act[1], exact=False).first.click()
                    elif act[0] == "tab":
                        page.get_by_role("tab", name=act[1]).click()
                    elif act[0] == "select":
                        page.locator("[data-testid='stSelectbox']").nth(act[3] if len(act) > 3 else 0).click()
                        page.get_by_role("option", name=act[2]).click()
                    elif act[0] == "wait":
                        time.sleep(act[1])
                    settle(page)
                content = page.evaluate("() => { const b = document.querySelector('[data-testid=\"stMainBlockContainer\"]');"
                                        " return (b ? b.scrollHeight : 900) + 60; }")
                height = int(max(900, min(content, 5200)))
                page.set_viewport_size({"width": 1440, "height": height})
                settle(page)
                boxes, missing = [], []
                for n, target in callouts:
                    try:
                        bb = locate(page, target).bounding_box(timeout=3000)
                    except Exception:  # noqa: BLE001
                        bb = None
                    if bb and bb["y"] < height:
                        boxes.append([n, bb["x"], bb["y"], bb["width"], min(bb["height"], height - bb["y"] - 8)])
                    else:
                        missing.append(n)
                page.evaluate(JS_DRAW, [boxes])
                if name in CLIP:
                    top = locate(page, CLIP[name][0]).bounding_box()["y"] - 40
                    page.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=80,
                                    clip={"x": 360, "y": max(0, top), "width": 1060, "height": CLIP[name][1]})
                else:
                    page.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=80)
                print(f"{name}: {len(boxes)} callouts" + (f", MISSING {missing}" if missing else ""))
                page.close()
            # phone
            m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            if not only or "35_mobile" in only:
                m.goto(f"http://localhost:{PORT}/present", wait_until="domcontentloaded")
                m.wait_for_selector(".sim-pill", state="attached", timeout=90000)
                settle(m)
                m.screenshot(path=str(OUT / "35_mobile.jpg"), type="jpeg", quality=80)
                print("35_mobile")
            b.close()
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
