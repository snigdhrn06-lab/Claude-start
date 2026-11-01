"""End-to-end test of the Cinematic Presentation inside the running Streamlit app.

Run: .venv/bin/python scripts/test_presentation.py   (about 4 minutes: it watches the full presentation in real time)
Screenshots go to artifacts/screenshots/presentation/.
"""
import glob
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "screenshots" / "presentation"
PORT = int(os.environ.get("PULSE_PORT", "8620"))
FAST = "--fast" in sys.argv          # skip the real-time full run (development only)
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)


def chromium():
    hits = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"))
    return os.environ.get("PLAYWRIGHT_CHROMIUM") or (hits[-1] if hits else None)


def main():
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/Home.py", "--server.port", str(PORT), "--server.headless", "true"],
                            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    errors = []
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(f"http://localhost:{PORT}/_stcore/health", timeout=2)
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.5)
        with sync_playwright() as p:
            kw = {"executable_path": chromium()} if chromium() else {}
            b = p.chromium.launch(args=["--no-sandbox"], **kw)
            ctx = b.new_context(viewport={"width": 1920, "height": 1080})
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            # 1. entry point on Story mode
            page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")
            page.wait_for_selector("text=Cinematic presentation", timeout=60000)
            time.sleep(2)
            check("Story mode shows the Cinematic presentation entry point", page.locator("a:has-text('Cinematic presentation')").count() >= 1)
            page.locator("[data-testid='stMain'] a:has-text('Cinematic presentation')").first.click()
            page.wait_for_selector("iframe", timeout=60000)
            time.sleep(4)
            fr = page.frame_locator("iframe").first
            frame = next(f for f in page.frames if f != page.main_frame)
            box = page.locator("iframe").first.bounding_box()
            check("presentation fills the window", box and box["width"] >= 1900 and box["height"] >= 1060, str(box))
            check("cover screen with Play button", fr.locator("#playBtn").is_visible())
            page.screenshot(path=str(OUT / "00_cover_1920.png"))

            # 2. press Play once, then never touch it
            fr.locator("#playBtn").click()
            t0 = time.time()
            total = frame.evaluate("PULSE_PRES.total")
            seen = []
            if not FAST:
                last_T = -1
                while time.time() - t0 < total + 12:
                    st = frame.evaluate("PULSE_PRES.state()")
                    if not seen or seen[-1] != st["scene"]:
                        seen.append(st["scene"])
                        page.screenshot(path=str(OUT / f"run_{len(seen):02d}_{st['scene']}.png"))
                    if st["mode"] == "ended":
                        break
                    if st["T"] < last_T:
                        check("timeline never runs backwards", False, f"{st['T']} < {last_T}")
                    last_T = st["T"]
                    time.sleep(1.0)
                elapsed = time.time() - t0
                st = frame.evaluate("PULSE_PRES.state()")
                scenes = [s["id"] for s in frame.evaluate("PULSE_PRES.scenes")]
                check("plays start to end with no interaction", st["mode"] == "ended", f"{elapsed:.0f}s wall clock for {total:.0f}s timeline")
                check("every chapter was shown, in order", seen == scenes, " > ".join(seen))
                check("wall-clock duration matches the timeline", abs(elapsed - total) < 8, f"{elapsed:.1f}s vs {total}s")
                time.sleep(5)
                st2 = frame.evaluate("PULSE_PRES.state()")
                check("final frame holds (no auto restart)", st2["mode"] == "ended" and st2["T"] == total and st2["scene"] == "close")
                page.screenshot(path=str(OUT / "99_end_hold.png"))
            # 3. controls
            frame.evaluate("PULSE_PRES.replay()")
            time.sleep(1.5)
            st = frame.evaluate("PULSE_PRES.state()")
            check("replay restarts from the beginning without reload", st["mode"] == "playing" and st["T"] < 3 and st["scene"] == "opening")
            page.mouse.move(900, 500)
            fr.locator("#bPlay").click()
            a = frame.evaluate("PULSE_PRES.state()")["T"]
            time.sleep(2)
            b2 = frame.evaluate("PULSE_PRES.state()")
            check("pause freezes the timeline", b2["mode"] == "paused" and abs(b2["T"] - a) < 0.05)
            fr.locator("#bNext").click()
            time.sleep(0.3)
            check("next jumps to chapter 2", frame.evaluate("PULSE_PRES.state()")["scene"] == "normal")
            fr.locator("#bPrev").click()
            time.sleep(0.3)
            check("previous returns to chapter 1", frame.evaluate("PULSE_PRES.state()")["scene"] == "opening")
            n_scenes_dom = frame.evaluate("document.querySelectorAll('#scenes .scene').length")
            check("only one scene mounted (skipped scenes are torn down)", n_scenes_dom == 1, str(n_scenes_dom))
            fr.locator("#bPlay").click()
            a = frame.evaluate("PULSE_PRES.state()")["T"]
            time.sleep(2)
            check("resume continues from the same position", frame.evaluate("PULSE_PRES.state()")["T"] > a + 1.5)
            # keyboard, pressed on the PARENT page (focus outside the iframe)
            page.evaluate("document.activeElement && document.activeElement.blur()")
            page.keyboard.press("Space")
            time.sleep(0.3)
            check("Space toggles playback from the app page", frame.evaluate("PULSE_PRES.state()")["mode"] == "paused")
            page.keyboard.press("ArrowRight")
            time.sleep(0.3)
            check("Arrow keys move between chapters", frame.evaluate("PULSE_PRES.state()")["scene"] == "normal")
            page.keyboard.press("Space")
            # tab hidden -> auto pause; visible -> resume
            frame.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
            time.sleep(0.3)
            hid = frame.evaluate("PULSE_PRES.state()")
            frame.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
            time.sleep(0.6)
            check("hidden tab pauses and resumes cleanly", hid["mode"] == "paused" and frame.evaluate("PULSE_PRES.state()")["mode"] == "playing")
            # progress bar synchronised with the timeline
            frame.evaluate("PULSE_PRES.seek(PULSE_PRES.total/2); PULSE_PRES.pause()")
            w = frame.evaluate("parseFloat(document.querySelector('#track .fill').style.width)")
            check("progress bar matches the timeline", abs(w - 50) < 0.5, f"{w:.2f}%")
            # 4. resolutions
            for vw, vh in [(1280, 720), (1366, 768), (2560, 1440)]:
                page.set_viewport_size({"width": vw, "height": vh})
                time.sleep(0.6)
                sc = frame.evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return [r.width,r.height]})()")
                check(f"16:9 stage fits {vw}x{vh}", sc[0] <= vw + 1 and sc[1] <= vh + 1 and sc[0] >= vw * 0.98, str(sc))
                page.screenshot(path=str(OUT / f"res_{vw}x{vh}.png"))
            page.set_viewport_size({"width": 1920, "height": 1080})
            # 5. exit returns to a working app
            fr.locator("#controls").hover()
            fr.locator("#bExit").click()
            page.wait_for_selector("text=Meet Sunrise Bakery", timeout=60000)
            time.sleep(2)
            check("Exit returns to the normal app (Story mode works)", page.locator("text=Meet Sunrise Bakery").count() >= 1)
            page.goto(f"http://localhost:{PORT}/explorer", wait_until="domcontentloaded")
            page.wait_for_selector("text=Merchant explorer", timeout=60000)
            time.sleep(3)
            check("other pages still work afterwards", page.locator("[data-testid='stException']").count() == 0)
            # 6. re-entry and reduced motion
            rctx = b.new_context(viewport={"width": 1600, "height": 900}, reduced_motion="reduce")
            rp = rctx.new_page()
            rp.on("pageerror", lambda e: errors.append(f"pageerror (reduced): {e}"))
            rp.goto(f"http://localhost:{PORT}/present", wait_until="domcontentloaded")
            rp.wait_for_selector("iframe", timeout=60000)
            time.sleep(4)
            rf = next(f for f in rp.frames if f != rp.main_frame)
            check("re-entering starts cleanly on the cover", rf.evaluate("PULSE_PRES.state()")["mode"] == "cover")
            check("reduced-motion preference detected", rf.evaluate("PULSE_PRES.state()")["reduced"] is True)
            sc_ok = True
            for s in rf.evaluate("PULSE_PRES.scenes"):
                rf.evaluate(f"PULSE_PRES.seek({s['start'] + s['dur'] * 0.7}); PULSE_PRES.pause()")
                time.sleep(0.3)
                sc_ok &= rf.evaluate(f"PULSE_PRES.state().scene") == s["id"]
                rp.screenshot(path=str(OUT / f"reduced_{s['id']}.png"))
            check("reduced motion shows every chapter", sc_ok)
            b.close()
    finally:
        proc.terminate()
        try:
            out = proc.communicate(timeout=10)[0].decode(errors="ignore")
        except Exception:  # noqa: BLE001
            out = ""
    server = [ln for ln in out.splitlines() if "Traceback" in ln or "Error" in ln]
    check("no browser console errors", not errors, "; ".join(errors[:5]))
    check("no server errors", not server, "; ".join(server[:5]))
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
