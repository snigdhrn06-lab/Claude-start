"""/present is printed on the posters as a QR code: it must load, with no 'Page not found' and no exception."""
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.request

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTES = ["present", "story", "sandbox", "film", "live", "flow", "analyst", "engines", "network", "response", "explorer",
          "evaluation", "rollout", "qa", "data"]


def _free_port():
    s = socket.socket(); s.bind(("", 0)); p = s.getsockname()[1]; s.close(); return p


@pytest.fixture(scope="module")
def server():
    if not (ROOT / "artifacts" / "meta.json").exists():
        pytest.skip("artifacts not built")
    port = _free_port()
    proc = subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/Home.py", "--server.port", str(port), "--server.headless", "true"],
                            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        try:
            urllib.request.urlopen(f"http://localhost:{port}/_stcore/health", timeout=2); break
        except Exception:  # noqa: BLE001
            time.sleep(0.5)
    yield port
    proc.terminate(); proc.wait(10)


def test_present_returns_200(server):
    r = urllib.request.urlopen(f"http://localhost:{server}/present", timeout=10)
    assert r.status == 200


def test_pages_render_without_page_not_found(server):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        pytest.skip("playwright not installed")
    import glob
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM") or (sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")) or [None])[-1]
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"], **({"executable_path": exe} if exe else {}))
        page = b.new_page()
        for route in ROUTES:
            page.goto(f"http://localhost:{server}/{route}", wait_until="domcontentloaded")
            page.wait_for_selector("[data-testid='stMainBlockContainer']", timeout=60000)
            page.wait_for_selector(".sim-pill", state="attached", timeout=60000)
            time.sleep(1.5)
            assert page.locator("text=Page not found").count() == 0, route
            assert page.locator("[data-testid='stException']").count() == 0, route
        page.goto(f"http://localhost:{server}/present", wait_until="domcontentloaded")
        page.wait_for_selector("text=Same papers.", timeout=60000)
        b.close()
