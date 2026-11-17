"""Offline stall demo: start PULSE locally and open Judge Mode (/present) in the browser.

Works with no internet once the virtualenv exists: every chart and number is read from the committed artifacts/.
Usage: make demo   |   ./run.sh demo   |   run.bat demo   |   python scripts/demo.py [--port 8501] [--no-browser]
"""
import argparse
import os
import pathlib
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PULSE_PORT", "8501")))
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    if not (ROOT / "artifacts" / "meta.json").exists():
        sys.exit("artifacts/ is missing. Pull the repo again (artifacts are committed) or run `make train`.")
    env = dict(os.environ, STREAMLIT_BROWSER_GATHER_USAGE_STATS="false")
    proc = subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/Home.py", "--server.port", str(a.port),
                             "--server.headless", "true"], cwd=ROOT, env=env)
    url = f"http://localhost:{a.port}/present"
    for _ in range(120):
        try:
            urllib.request.urlopen(f"http://localhost:{a.port}/_stcore/health", timeout=2)
            break
        except Exception:  # noqa: BLE001
            if proc.poll() is not None:
                sys.exit("Streamlit exited; see the error above.")
            time.sleep(0.5)
    print(f"\n  PULSE is running offline at {url}\n  Press Ctrl+C to stop.\n", flush=True)
    if not a.no_browser:
        webbrowser.open(url)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


if __name__ == "__main__":
    main()
