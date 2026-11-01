# PULSE: a pattern-of-life engine for PayU (prototype)

Entry for **Follow the Money: Innovation Challenge** (CSITM, IIM Bangalore × PayU), problem statement **"The Bakery That Takes Bets"**.

A merchant passes KYC as a real bakery; later the same merchant ID collects money for illegal betting. The papers stay
genuine and every payment looks normal on its own. PULSE detects the **drift from the declared business purpose**,
protects honest merchants (festival spikes, sports bars) and responds **proportionately**.

> **Honesty notes.** The bakery's *normal* is real (the public Bread Basket dataset). Everything else is **simulated**:
> payers, the other ~300 merchants and all betting behaviour, with each betting rule citing the public finding behind it.
> Every number in `config/` is a **design parameter**. No metric here is PayU real-world performance. Each simulated
> screen carries a "Simulated" badge.

## Run it

```bash
cd pulse
make setup        # python3.11 venv + pinned requirements (one time)
make all          # fetch data -> simulate -> train/evaluate -> tests -> screenshots   (~5 min on a laptop)
make app          # open the Streamlit app (Story mode is the landing page)
```

**Windows (cmd), no `make` needed:**

```bat
cd pulse
run.bat setup     :: one time; needs Python 3.11 from python.org
run.bat all       :: data -> train -> tests -> screenshots
run.bat app       :: opens http://localhost:8501
```

`./run.sh` does the same on macOS/Linux if `make` is missing.

Steps one at a time: `make fetch-data`, `make data`, `make train`, `make test` (`make test-fast` skips the
determinism test), `make app`, `make screenshots`.

**Data:** `make fetch-data` downloads `BreadBasket_DMS.csv` (Kaggle "Transactions from a bakery") from public
mirrors and checks its MD5. If that fails, download the file from Kaggle and save it as `data/raw/bread_basket.csv`.
To use a real partner bakery instead, place `data/raw/partner_bakery.csv` (`timestamp, amount_inr, payer_hash`);
the app then shows "Partner bakery (consented)".

**Screenshots** need Chromium. The script uses `PLAYWRIGHT_CHROMIUM` or a pre-installed `/opt/pw-browsers` build;
otherwise run `.venv/bin/playwright install chromium` once.

## Cinematic presentation (hands-free demo)

Sidebar → **Cinematic presentation** (or the button on Story mode) opens a full-window, self-playing version of the whole
story: 10 chapters, about 3 min 17 s, no clicks after **Play**. Space pauses, ← → move between chapters, R replays, F goes fullscreen, X exits.
It's built as one HTML/SVG/Canvas document (`app/presentation/presentation.html`) driven by a single deterministic timeline. Every scene is a
pure function of time, so pause, seek, skip and replay are exact. Its data is built from the same artefacts as the app
(`app/ui/presentation_data.py`), so the numbers always agree. `make presentation` writes a standalone offline copy to
`artifacts/presentation.html`. `make test-presentation` launches the app and checks the entry point, a full unattended
run, pause/resume/seek/replay/exit, keyboard, hidden-tab recovery, 16:9 resolutions and reduced motion (about 4 minutes).

## Hosting (Render)

The repo includes the prebuilt artifacts (about 11 MB), so a host only serves the app and never retrains it. On Render, create a
**Web Service** with Root Directory `pulse`, Build Command `pip install -r requirements-app.txt` and Start Command
`streamlit run app/Home.py --server.port $PORT --server.address 0.0.0.0`, plus the env var `PYTHON_VERSION=3.11.9`. Peak memory
was about 320 MB in testing, so the free 512 MB plan works. After changing the model, run `make all` locally and commit `artifacts/` again.

## What is inside

```
config/        settings, engines, scenarios (+ sources), merchant templates, price list, costs   <- design parameters
data/events/   fixtures.csv (IPL 2025 + India fixtures, verification column), festivals.csv
pulse/         ingest -> simulate -> features -> engines/{drift,peers,invariants,graph} -> fusion -> response -> evaluate
               pipeline.py writes artifacts/ ; reasons.py ; artifacts_extra.py (network, evidence packs, trust)
app/           Streamlit: Home.py + views/ (7 pages), ui/theme.py (PayU palette, Plotly template), ui/components.py
tests/         engines on hand-built cases, determinism, split, scenarios, reserve, reason numbers
artifacts/     eval/*.json, screenshots/*.png, evidence/ case files (the rest is regenerated)
```

### Architecture

1. **Ingest (real):** Bread Basket baskets are priced from a declared INR list and moved +447 weeks onto 2025 (day-of-week kept).
2. **Simulate:** a 3-city region with 50,000 payers and 314 merchants from category templates (bakeries use the real profile),
   honest hard negatives, Diwali and other festivals, sports bars on match nights, and fronts: S3–S5, E1–E3, a 10-front ring
   and 45 randomised extra fronts, plus 3 banned seed fronts whose bettor lists seed the graph.
3. **Engines on one hourly grid** (trailing windows ending at each hour, so hourly live views and daily evaluation share definitions):
   - **Drift:** JS divergence of hours (24 h and 7 d), Wasserstein on log-amount, round-amount excess and CUSUM. Each is measured against a frozen anchor (first 30 eligible days), a rolling baseline and the KYB-declared profile, then cohort-adjusted.
   - **Peers:** lift vs the median peer lift, robust z = gap ÷ 1.4826·MAD, and it fires only if z > 3 in 3 of the last 6 hours. Peer groups are HDBSCAN clusters with a category × size-band fallback.
   - **Invariants:** a closed loop (payouts to earlier payers, amounts matching no order), and a match clock: a Poisson GLM β with a 1,000-shift placebo p-value, which requires new distant payers so that sports bars don't fire.
   - **Graph:** distinct payers shared with banned fronts (Bonferroni hypergeometric tail), Adamic–Adar similarity, and hard links (device, director, settlement account).
4. **Fusion:** a Stage A expert scorecard (shadow mode), then a Stage B LightGBM with monotonic constraints trained on merchant-days with time-aware
   validation, then Stage C isotonic calibration on held-out training merchants. SHAP top-3 contributions become plain sentences whose numbers are recomputed from payments.
5. **Response:** the cost rule p·C_fraud > (1−p)·C_friction(L), with corroboration (L2+ needs 2 engines). Ladder L0–L5, with automatic action up to L3;
   L4–L5 need analyst approval. The **delta reserve** holds only the fingerprinted surplus above Tolerated = baseline × exp(cohort lift + 3σ) per settlement day.
   **Earned Trust** tiers use simulated consented data, and refusing consent is never a penalty. The **evidence pack** includes an STR draft template.
6. **Evaluate** on test merchants only (70/30 by merchant, scenario merchants forced into test). Results are in `REPORT.md` and `artifacts/eval/`.

The app reads only precomputed artefacts (`st.cache_data`); pages load in about a second (`artifacts/screenshots/console_log.txt`).

## Results (simulated)

See [`REPORT.md`](REPORT.md) for the full tables. In short: all scenario checks S0–S5 pass, and E1–E3 are flagged. Of 29 test fronts,
28 reach L2+, and no honest test merchant reaches L2+. Detection splits into two groups: loud fronts are caught on their first match
night, while small ones take days to weeks. The ablation shows the graph and invariants engines carry most of the signal, and
removing the peer engine changes nothing measurable in this simulation. The simulation is cleaner than real data, so treat these
numbers as a demonstration of the mechanism, not an estimate of real performance.

## Team to verify

- `data/events/fixtures.csv`: rows marked "to be verified by team" (official sites were unreachable from the build machine).
- `config/price_list.yaml`: the INR price list.
- Citations in `config/scenarios.yaml` (as supplied in the brief).
- `data/raw/partner_bakery.csv`, if added: consent and anonymisation.

**New to the app? Start with [`GUIDE.md`](GUIDE.md)**: every page and chart in plain words, what each means, and what to say. See `ASSUMPTIONS.md` for every assumption, and `DEMO_SCRIPT.md` for the 2-minute narration.
