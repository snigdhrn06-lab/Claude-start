# Round 2: audit and build result

**Status on 17 Nov 2026: built.** The audit below (written before the build) lists what already existed. This first
section says what was built and where, and what was skipped and why. Everything runs locally from `make demo`, and all 46
tests pass (`make test`). I couldn't reach the live Render URL from the build sandbox, so the team must check `/present` on it after
deploying (see README, "Keep it warm").

## What was built

| Brief item | Before | Now | Where |
|---|---|---|---|
| `/present` deep link (poster QR) | BROKEN: "Page not found" pop-up | **Fixed.** Classic `app/pages/` routing; 15 URLs load directly with no pop-up (tested) | `app/pages/01_present.py`, `tests/test_routes.py` |
| 3.1 Judge Mode home | MISSING | 3 tiles (Watch a takeover / Try to fool PULSE / Under the hood), header with wordmark, "Simulated data" pill, team name, Reset demo, poster lines, KPIs read from artefacts | `app/views/judge_home.py`, `app/ui/layout.py` |
| 2-minute film | was on `/present` | moved to `/film`, one tap from Judge Mode and the story; Exit returns to `/present` | `app/pages/04_film.py` |
| Risk bands, not "calibrated probability" | BROKEN | Watch (L0–L1) / Review (L2) / Act (L3+) everywhere: story, explorer, evaluation, film, case files; score shown as "model score (uncalibrated)" | `app/ui/components.py` `band_card`, `band_of` |
| Ladder wording | PARTIAL | L3 "Hold the surplus", L5 "Exit after review + STR" | `config/costs.yaml` |
| New-shell hold timing | BROKEN: held day 6 | **Fixed:** on declared (not yet learned) days a new merchant is reserved hour by hour. S5 is flagged 2 h after its first payment, with money held on day 1, and the screen says exactly that | `pulse/response.py` `delta_reserve(declared_days=)`, `pulse/pipeline.py` |
| Payment fields | PARTIAL | `type` (payment / refund / payout), `channel` (QR / UPI collect / Payment link / UPI payout), `payer_city`, `settlement_batch` | `pulse/simulate.py` `add_payment_fields` |
| 3.2 Guided story upgrades | PARTIAL | visible two-engine gate strip, lone-engine example (S0 twin), round bills and new distant payers on Day T, held-payments table with reasons, peer-gap arithmetic (illustrative ln 5 − ln 5 vs ln 5 − ln 1, plus measured values) | `app/views/story.py` |
| 3.3 Try to fool PULSE | MISSING | 7 presets + controls; the real engine code on a seeded 60-day world (your shop + 20 peers, 300 placebos), about 1 s per run; caught / got-through banner, money chart, engine rows, ladder, reasons, blind-spot box | `pulse/minisim.py`, `app/views/sandbox.py`, `tests/test_sandbox.py` |
| 3.4 Live feed | MISSING | 24-shop simulated city at accelerated time; Play/Pause, speed, Inject takeover, Trigger Diwali; measured counters (payments scored, µs per payment); risk tiles, alert queue | `app/views/live.py`, `pulse/minisim.py` `run_city` |
| 3.5 Flow diagram | MISSING | checkout → capture → PULSE (before the T+1 batch) → settlement → analyst; visible and hidden tracks; intervention points | `app/views/flow.py` |
| 3.5 `POST /score` | MISSING | real scoring function + stdlib HTTP server (`python -m pulse.scoring_api --serve 8080`); laptop benchmark p50 0.32 ms, p95 0.63 ms (10,000 calls); 97.9% band agreement with the pipeline | `pulse/scoring_api.py`, `artifacts/eval/latency.json` |
| 3.5 Ops panel | PARTIAL | threshold slider → alerts/day, analyst hours, analysts per lakh merchants (minutes per alert is a labelled design parameter) | `app/views/flow.py` |
| 3.5 Settlement simulator | PARTIAL | any merchant, any day: due, settled, held, released | `app/views/flow.py` |
| 3.6 Analyst queue + audit log | MISSING | queue by band, three reasons, Approve / Escalate / Dismiss, append-only log with CSV download | `app/views/analyst.py` |
| 3.6 Case file for any flagged merchant | PARTIAL | HERO and S5 from the pipeline; generated on demand for every other flagged merchant | `app/views/analyst.py` |
| 3.6 Merchant's view | PARTIAL | phone mock per ladder level | `app/views/analyst.py` |
| 3.7 Shadow mode + stop rules | MISSING | weekly would-have-held vs ₹0, 6 stop rules PASS/FAIL against limits in `config/costs.yaml`, 4 rollout stages | `app/views/rollout.py` |
| 3.7 Rules engine vs PULSE | MISSING | "volume > 3× first-30-day mean": 21 of 77 honest shops flagged (24 Diwali alarm-days), 16 of 29 fronts caught; PULSE 0 of 77 and 28 of 29 | `app/views/rollout.py` |
| 3.8 Ask us anything | MISSING | 11 Q&As with links to the page that proves each answer | `app/views/qa.py` |
| 4 Offline one command | PARTIAL | `make demo` / `./run.sh demo` / `run.bat demo` opens `/present`; works offline once the venv exists | `scripts/demo.py` |
| 4 Hosted app dependencies | (new finding) | `requirements-app.txt` lacked scikit-learn, so the sandbox and live feed would crash on Render. Added | `requirements-app.txt` |
| 4 Keep-warm note | MISSING | README section | `README.md` |
| 4 Mobile 390 px | BROKEN | sidebar starts collapsed on phones, tiles stack, header fits | `app/ui/theme.py`, `app/ui/layout.py` |
| 6 Tests | PARTIAL | + sandbox presets (honest stay ≤ L1 and hold ₹0; fronts caught and held; deterministic) and `/present` 200 + no "Page not found" on all 15 routes; film e2e updated for `/film` | `tests/test_sandbox.py`, `tests/test_routes.py`, `scripts/test_presentation.py` |
| 5 Poster lines | MISSING | both on Judge Mode | `app/views/judge_home.py` |

## What was skipped, and why

- **Backup walkthrough video.** It was first on the cut list. The 2-minute film (`/film`, plus the offline copy
  `artifacts/presentation.html`) covers the same need.
- **Bundled fonts.** Offline, the app falls back to system fonts (layout holds; it just looks less branded). Bundling
  the font files means shipping font binaries; I left that for the team to decide.
- **The 180-day window.** It stays at 162 days, the real span of the bakery data. Padding it would mean inventing bakery days.
- **A separate scoring microservice.** `POST /score` is a stdlib server in the same repo, not a deployed service.
  The brief allowed a mock.
- **The "21:47" dramatised page** from an earlier request. It was interrupted and never confirmed, so it wasn't built.

---

# Original audit (before the build): what existed vs the build brief

Audited on 17 Nov 2026 against the "PULSE Round 2 build brief", Sections 1 to 8. The brief arrived cut off partway
through Section 8 ("…empty charts and default sty"), so anything after that, including any Section 9, isn't covered here.

**How I checked:** I read the code, configs and docs; ran the 37 fast tests (all pass); started the app locally and loaded
`/present` and Story mode on a desktop and at 390 px; and queried the artefacts for the S5 timing. I could **not** reach
`pulse-demo-nmx8.onrender.com` from this sandbox (the network blocks it), so the live site wasn't checked. Everything
below is the same code running locally.

Stack: Python 3.11 pipeline (`pulse/`) writes artefacts that a Streamlit 1.39 app (`app/`) reads. It stays on Streamlit,
as the brief says.

---

## Critical findings (fix first)

1. **BROKEN: `/present` shows "Page not found" on a direct load.** When a phone or new browser opens
   `…/present` directly, which is what the poster QR does, Streamlit shows a pop-up: *"You have requested page /present,
   but no corresponding file was found… Running the app's main page."* The presentation does load behind it, but a judge
   sees an error first. This is a known Streamlit 1.39 deep-link quirk with `st.navigation`. Screenshot taken at 390 px.
2. **BROKEN (honesty): "calibrated probability" is still on screen.** It appears in Story step 4 (gauge and text),
   the Explorer ("Peak probability · calibrated", "Calibrated p"), the cinematic presentation chapter 4 ("One calibrated
   score", gauge label), the case file ("calibrated probability > 0.99") and the GUIDE/DEMO_SCRIPT. These need to become
   risk bands (Watch / Review / Act).
3. **BROKEN (honesty and logic): the new-shell hold timing.** S5's first bet is at 18:00 on 14 Oct (day 142), and it
   reaches **L3 two hours later on day one**. But the **first rupee is held on day 6 (19 Oct)**, and only ₹1.54 lakh is
   held of about ₹7.07 lakh of betting over the window. The cause: a brand-new merchant has no anchor yet, so its Tolerated
   line comes from its *declared* turnover (4 IT invoices × ₹28,000 a day ≈ ₹1.1 lakh, before the 3σ margin), and most
   betting days stay under that. Today's UI says "flagged 2 hours after its first payment", which is true, but never says
   when money was held. The brief's "held day two" isn't true either. I'll fix the logic (see 3.x below) and then state
   the real timing on screen.
4. **BROKEN: mobile at 390 px.** The sidebar opens over the content (`initial_sidebar_state="expanded"`), and the 16:9
   presentation scales to a thin strip with unreadable text.

---

## Full item list

Status key: `DONE` exists and works · `PARTIAL` exists but misses part of the brief · `MISSING` not built ·
`BROKEN` exists but wrong or failing.

### Section 0 · Ground rules

| Item | Status | Where | What's left |
|---|---|---|---|
| Keep `/present` loading (poster QR) | BROKEN | `app/Home.py` (`st.Page(... url_path="present")`), `app/views/presentation.py` | Fix the direct-load "Page not found" pop-up; make `/present` open Judge Mode home (with the 2-min film one tap away) |
| Stay on the current stack | DONE | Streamlit 1.39, Plotly, plain JS/SVG for the film | nothing |

### Section 1 · What PULSE is

| Item | Status | Where | What's left |
|---|---|---|---|
| Engine A: drift, frozen 30-day anchor (flagged days never update it) + rolling, take the max | DONE | `pulse/features.py` `anchor_baselines`; `pulse/engines/drift.py` `rolling_baseline`, `drift_score`; Engines lab › Drift | nothing |
| Drift measures: JS on hour-of-week, Wasserstein on log amount, round-amount share, CUSUM k=0.5 h=5 | DONE | `drift.py` `js_divergence`, `wasserstein_hist`, `compute_drift`, `cusum_upper`; `config/engines.yaml` | nothing |
| Engine B: lift, gap vs median peer, robust z (1.4826×MAD), fires if z>3 in ≥3 of last 6 | DONE | `pulse/engines/peers.py` `compute_peers`, `robust_z`, `persistence` | nothing |
| On-screen arithmetic: P(z>3)≈0.135% → ≈1,350 alarms/hour per 1M merchant-hours | DONE | Engines lab › Peers (`app/views/engines_lab.py`) | nothing |
| On-screen Diwali vs India–Pakistan worked example (ln 5 − ln 5 = 0 vs ln 5 − ln 1 = 1.61) | MISSING | n/a | Add to Engines lab › Peers and the guided story |
| Engine C: closed loop ratio | DONE | `pulse/engines/invariants.py` `compute_loop`, `loop_ratio` | nothing |
| Engine C: match clock GLM + 1,000-date placebo | DONE | `invariants.py` `compute_match_clock`, `placebo_shifts`; Engines lab › Invariants (placebo histogram, computed live) | Note: the pipeline runs placebos only where β ≥ 0.5 (documented in ASSUMPTIONS.md) |
| Engine C: sports-bar guard (β>0 needs local/no-payout context) | DONE | `invariants_summary`: the match clock fires only with excess *new distant* payers | nothing |
| Engine D: hypergeometric tail, Adamic–Adar, hard links | DONE | `pulse/engines/graph.py` `compute_graph`, `shared_pvalue`, `adamic_adar` | nothing |
| Worked example 0.008 (labelled) + correct sim-pool value (0.84) | DONE | `app/views/network.py`, Engines lab › Graph | nothing |
| Fusion: day-one expert scorecard | DONE | `pulse/fusion.py` `scorecard`; Evaluation page shows Stage A vs Stage C | nothing |
| Fusion: monotonic LightGBM + SHAP top-3 in plain English | DONE | `fusion.py` `FusionModel`; `pulse/reasons.py` `top_reasons` | nothing |
| **Risk bands (Watch / Review / Act), not "calibrated probability"** | BROKEN | Story step 4, `app/ui/charts.py` `gauge`, `explorer.py`, `app/presentation/presentation.html` ch. 4, `pulse/artifacts_extra.py` case file, GUIDE, DEMO_SCRIPT | Replace wording and gauge everywhere; keep the internal score but show bands |
| Corroboration: no L2+ without two engines | DONE | `pulse/response.py` `decide_level` + `config/costs.yaml` `min_engines` | Make the gate *visible* in the story (see 3.2) |
| Decision rule p×C_fraud > (1−p)×C_friction with cost sliders | DONE | Response & trust › Friction ladder (`app/views/response.py`) | nothing |
| Ladder L0–L5 | PARTIAL | `response.py` `ladder`; `config/costs.yaml` `levels` | Rename to brief wording: L3 "Hold the surplus", L5 "Exit after human review + draft STR" |
| Delta reserve: Tolerated = baseline × e^(cohort lift + 3σ), fingerprinted surplus only, T+1 | DONE | `response.py` `delta_reserve` (per daily settlement window), `fingerprint_flags` | nothing for established merchants |
| Delta reserve for **new** merchants | BROKEN | Same function: a new shell's baseline = declared turnover | Use the declared *shape* plus the merchant's own first-day volume, so a shell can't hide under a generous declared number; then state the real "flagged day X, held day Y" |
| Diwali: line rises, ₹0 held | DONE | `reserve_S1*.parquet`; Story step 6; test `test_s1_reserve_holds_zero` | nothing |
| Earned Trust tiers 0–3 (refusal never penalised) | DONE | `response.py` `consented_features`, `apply_consent`; Response & trust › Earned Trust | nothing (simulated, labelled) |
| Two tracks (visible / hidden STR) | DONE | Story step 7; case file in `artifacts_extra.py` `evidence_pack` | nothing |
| Rollout: shadow mode first, stop rules | MISSING | Mentioned only in text ("Stage A runs in shadow mode") | Build the shadow-mode dashboard (3.7) |

### Section 1 · Honesty rules

| Item | Status | Where | What's left |
|---|---|---|---|
| "Simulated" badge on every simulated screen | DONE | `ui/components.py` `title(...)`; film scenes carry badges | Re-check on new pages |
| ₹4,12,000 night / 847 bettors labelled dramatised | DONE (n/a) | Not used anywhere in the app today | If added (e.g. Judge Mode), label "dramatised" |
| Public findings cited on the data page | DONE | Data & assumptions › Scenario rules & sources; `config/scenarios.yaml` `sources` | nothing |
| Evaluation titled "Performance on simulated scenarios" | DONE | `app/views/evaluation.py`, REPORT.md | nothing |
| Determinism, seed 42 | DONE | `config/settings.yaml`; `tests/test_determinism.py` (passes) | nothing |
| New-shell timing stated exactly | BROKEN | See critical finding 3 | Fix logic, then label the real days |

### Section 2 · Simulated world

| Item | Status | Where | What's left |
|---|---|---|---|
| ~300 merchants, all categories incl. IT shells | DONE | `pulse/simulate.py` `build_world` (314 merchants) | nothing |
| 180-day window, first 30–60 days baseline | PARTIAL | `config/settings.yaml`: **162 days**, exactly the real Bread Basket span (no padding); 30-day anchor warm-up; baseline period 60 days | Keep 162 and say so on the data page (padding would mean inventing bakery days) |
| Bread Basket as the bakery's normal | DONE | `pulse/ingest.py`; Data page states it | nothing |
| Diwali ×4–5 and IPL/India fixtures with live windows | DONE | `data/events/festivals.csv`, `fixtures.csv`; `pulse/calendar.py` | Fixtures partly "to be verified by team" |
| Payment fields | PARTIAL | `data/processed/payments.parquet`: `t_min, amount, payer_id, kind, is_bet, merchant_id, match_id`; payer city via `payers.parquet` | Add `channel` (UPI collect / QR / link), split `type` into payment / refund / payout, add `payer_city` and `settlement_batch_id` columns |
| Scenarios S0–S5, E1–E3 with known answers | DONE | `config/scenarios.yaml`; scorecard 9/9 pass (`artifacts/eval/scenario_scorecard.json`) | S5 hold timing (critical finding 3) |

### Section 3 · New for Round 2

| Item | Status | Where | What's left |
|---|---|---|---|
| 3.1 Judge Mode home (3 big choices, header, team name, Reset demo) | MISSING | `/present` is currently the 2-min cinematic film | Build; `/present` opens it; the film becomes one tile |
| 3.2 Guided story, 7 steps on real rows | PARTIAL | `app/views/story.py` (7 steps, Next/Back, stepper, replay animation, reserve chart, Diwali + sports bar, case file download) | Add the visible two-engine gate (Watch → Review/Act), show round bills / new distant payers in the replay, list *which* transactions were held and why, switch to risk bands |
| 3.3 "Try to fool PULSE" sandbox | MISSING | n/a (engines only run on the full city grid) | Build a fast single-merchant path: seeded 60-day sim, the same four engines, presets, sub-second |
| 3.4 Live transaction feed (accelerated time, inject buttons, measured counters) | MISSING | n/a | Build: replay the city's real rows with a ticker, risk tiles, alert queue, "inject takeover" / "trigger Diwali" |
| 3.5 Flow diagram (where PULSE sits before settlement) | MISSING | n/a | Build |
| 3.5 `POST /score` mock API + measured p50/p95 | MISSING | n/a | Build a scoring function + benchmark, show request/response and laptop latency (state "laptop benchmark") |
| 3.5 Ops panel (alerts/day by threshold, analyst minutes, analysts per 1 lakh merchants) | PARTIAL | Engines lab › Peers has the alarm funnel per million merchant-hours | Add workload maths with analyst-minutes as a labelled design parameter |
| 3.5 Settlement simulator (pick a day: due, settled, held, released) | PARTIAL | Response & trust › Delta reserve calculator (2 fixed cases only) | Build a per-day batch view for any merchant/day |
| 3.6 Analyst queue (Approve/Escalate/Dismiss) + append-only audit log | MISSING | n/a | Build |
| 3.6 Case file (timeline, charts, reasons, graph links, action, held, STR draft) | DONE | `artifacts_extra.py` `evidence_pack` → `artifacts/evidence/*_case_file.md/.html`; Story step 7 downloads | Only HERO and S5 have files; generate on demand for any flagged merchant; change "calibrated" wording |
| 3.6 Merchant's view per ladder level | PARTIAL | Response & trust ladder table has a "Merchant sees" column | Build a phone-style merchant screen per level |
| 3.7 Shadow-mode dashboard + stop rules pass/fail | MISSING | n/a | Build |
| 3.7 Scenario scorecard ✅/❌ | DONE | Evaluation page | nothing |
| 3.7 Precision@k, recall, FA/1k merchant-months, time to detect, ₹ contained, ablation, fairness | DONE | Evaluation page; `pulse/evaluate.py` | nothing |
| 3.7 "Why not a rules engine?" side-by-side | MISSING | n/a | Build: naive "volume > 3×" rule vs PULSE on the same city |
| 3.8 "Ask us anything" page | MISSING (in app) | Draft answers exist in `GUIDE.md` §6 | Build the page from what the code actually does, with links |

### Section 4 · Stall reliability

| Item | Status | Where | What's left |
|---|---|---|---|
| Fully offline, one command, precomputed artefacts | PARTIAL | `make app` / `run.bat app`; artefacts are committed | Add `make demo` / `run_demo.bat`; bundle fonts (Poppins loads from Google Fonts; offline it falls back to system fonts) |
| Render keep-warm / wake note | MISSING | `render.yaml` at repo root is for the old shop app; PULSE is a manual Web Service | README note + keep-warm option. Render's free tier **does** sleep after ~15 min idle and takes ~1 min to wake |
| Every page < 2 s, no console/red errors | DONE | `scripts/screenshots.py` logs load times (~0.3 s per page after warm-up), 0 console errors | Re-run after new pages |
| `make screenshots` | DONE | `scripts/screenshots.py` | Add new pages |
| Backup walkthrough video | MISSING | n/a | Optional Playwright recording |
| Mobile `/present` at 390 px (Judge home + sandbox) | BROKEN | See critical finding 4 | Build a mobile layout; collapse the sidebar on mobile |

### Section 5 · Look and feel

| Item | Status | Where | What's left |
|---|---|---|---|
| PayU palette, one chart theme | DONE | `app/ui/theme.py` (`register_plotly_template`) | nothing |
| No red/green-only signals; labels everywhere | DONE | Level chips carry text; charts labelled | Re-check new pages |
| Poster lines: "Same papers. Different life." and "We don't hunt for betting…" | MISSING | n/a | Put on Judge Mode home |

### Section 6 · Tests

| Item | Status | Where | What's left |
|---|---|---|---|
| Engines on hand-built cases (JS=0, loop=1, hypergeometric mean) | DONE | `tests/test_engines.py` | nothing |
| Determinism hash | DONE | `tests/test_determinism.py` | nothing |
| No train/test overlap | DONE | `tests/test_split.py` | nothing |
| Diwali ₹0, S3 > 0 and fingerprinted only | DONE | `tests/test_scenarios.py` | nothing |
| Reason numbers computed, not hard-coded | DONE | `tests/test_reasons.py` | nothing |
| Sandbox presets give expected outcomes | MISSING | n/a | Add with the sandbox |
| `/present` returns 200 | PARTIAL | `scripts/test_presentation.py` (end-to-end, 27 checks) loads it but doesn't assert HTTP 200 or the absence of the pop-up | Add both checks |

---

## Proposed order (9 days to 26 Nov)

1. **Day 1:** fix the four critical findings (deep-link pop-up, risk-band wording, new-shell hold logic and timing label, mobile layout), rename L3/L5, add the payment fields.
2. **Days 2–3:** Judge Mode home on `/present` (with Reset demo and the poster lines) + guided-story upgrades (visible two-engine gate, held-transaction list, Diwali/IND–PAK arithmetic).
3. **Days 3–4:** "Try to fool PULSE" sandbox with presets and tests.
4. **Days 5–6:** live feed, PayU flow diagram, scoring benchmark, ops panel, settlement simulator.
5. **Day 7:** analyst queue + audit log, on-demand case files, merchant's view; shadow-mode dashboard, rules-engine comparison, Ask-us-anything page.
6. **Day 8:** `make demo` offline run, screenshots, mobile check, redeploy, keep-warm.
7. **Day 9:** buffer.

**If time runs short, I'd cut, in this order:** the backup video, the separate `POST /score` service (keep an in-app
benchmark instead), the analyst audit log (keep the queue), then the live feed's inject buttons (keep the replay).
