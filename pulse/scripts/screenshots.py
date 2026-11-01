"""Start the app, capture every page and every Story-mode step to artifacts/screenshots/, and log console errors."""
import glob
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "screenshots"
PORT = int(os.environ.get("PULSE_PORT", "8599"))
PAGES = [(f"story_step{k}", f"?step={k}") for k in range(1, 8)] + [
    ("presentation_cover", "present"), ("explorer", "explorer"), ("engines_lab", "engines"), ("network", "network"), ("response", "response"),
    ("evaluation", "evaluation"), ("data_assumptions", "data")]


def chromium_path():
    env = os.environ.get("PLAYWRIGHT_CHROMIUM")
    if env:
        return env
    hits = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"))
    return hits[-1] if hits else None


def wait_port(port, timeout=60):
    t = time.time()
    while time.time() - t < timeout:
        try:
            urllib.request.urlopen(f"http://localhost:{port}/_stcore/health", timeout=2)
            return True
        except Exception:  # noqa: BLE001
            time.sleep(0.5)
    return False


def main():
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/Home.py", "--server.port", str(PORT),
                             "--server.headless", "true"], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    errors = []
    timings = {}
    try:
        if not wait_port(PORT):
            raise SystemExit("streamlit did not start")
        with sync_playwright() as p:
            kw = {"executable_path": chromium_path()} if chromium_path() else {}
            b = p.chromium.launch(args=["--no-sandbox"], **kw)
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            page = ctx.new_page()
            # Streamlit probes "<page>/_stcore/health" and "<page>/_stcore/host-config" on deep links and falls back
            # to the root endpoints when they 404. Those probes are benign; any other failed request is an error.
            benign = []

            def on_response(r):
                if r.status >= 400:
                    (benign if "/_stcore/" in r.url else errors).append(f"HTTP {r.status}: {r.url}")

            page.on("response", on_response)
            page.on("console", lambda m: errors.append(f"{m.type}: {m.text}")
                    if m.type == "error" and "Failed to load resource" not in m.text else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            # warm the cache once
            page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")
            page.wait_for_selector("[data-testid='stAppViewContainer']", timeout=60000)
            time.sleep(6)
            for name, path in PAGES:
                t0 = time.time()
                page.goto(f"http://localhost:{PORT}/{path}", wait_until="domcontentloaded")
                page.wait_for_selector("[data-testid='stMainBlockContainer'], [data-testid='block-container']", timeout=60000)
                # wait until Streamlit stops running
                for _ in range(120):
                    running = page.locator("[data-testid='stStatusWidget']").count()
                    if running == 0:
                        break
                    time.sleep(0.25)
                timings[name] = round(time.time() - t0, 2)
                time.sleep(2.5)  # let Plotly finish drawing
                # Streamlit scrolls an inner container, so grow the viewport to the content height for a full capture
                hgt = page.evaluate("() => { const m = document.querySelector('[data-testid=\"stMain\"]') || document.querySelector('section.main');"
                                    " const b = document.querySelector('[data-testid=\"stMainBlockContainer\"]') || document.querySelector('.block-container');"
                                    " return Math.max(900, (b ? b.scrollHeight : 900) + 80); }")
                page.set_viewport_size({"width": 1440, "height": int(min(hgt, 6000))})
                time.sleep(1.5)
                exc = page.locator("[data-testid='stException']").count()
                if exc:
                    errors.append(f"{name}: Streamlit exception shown on page")
                page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
                page.set_viewport_size({"width": 1440, "height": 900})
                print(f"saved {name}.png ({timings[name]} s)")
            b.close()
    finally:
        proc.terminate()
        try:
            out = proc.communicate(timeout=10)[0].decode(errors="ignore")
        except Exception:  # noqa: BLE001
            out = ""
    log = OUT / "console_log.txt"
    server_issues = [ln for ln in out.splitlines() if ("Traceback" in ln or "Error" in ln or "Warning" in ln)]
    log.write_text("\n".join(["# browser console errors"] + errors + ["", "# server warnings/errors"] + server_issues +
                             ["", "# page load seconds"] + [f"{k}: {v}" for k, v in timings.items()]) + "\n")
    print(f"console errors: {len(errors)}; server issues: {len(server_issues)}")
    if errors or server_issues:
        print("\n".join(errors + server_issues))
        sys.exit(1)


if __name__ == "__main__":
    main()
