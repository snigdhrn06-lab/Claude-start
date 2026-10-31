# Assumptions and design choices

Everything here is either **real** (public data, unchanged), **transformed** (real data with a documented change),
**simulated** (synthetic), or a **design parameter** (a number we chose; it lives in `config/`).

## Real data and its transformations

| Item | Status | Detail |
|---|---|---|
| Bread Basket transactions | Real | Public Kaggle dataset "Transactions from a bakery" (`BreadBasket_DMS.csv`, 21,293 item rows, 9,531 transactions, 30 Oct 2016 to 9 Apr 2017). Kaggle needs a login and is blocked from the build machine, so `scripts/fetch_data.py` downloads the identical file from two public GitHub mirrors and checks its MD5 (`e7b15b10c254d373ffbf1c1659122a55`). |
| Calendar | Transformed | Every timestamp moves forward by exactly 447 weeks (3,129 days), so 30 Oct 2016 (Sunday) becomes 25 May 2025 (Sunday). Day of week and time of day are unchanged. The window is the data's own 162 days (25 May to 2 Nov 2025), so we never pad or invent days. |
| UK seasonality | Kept | The original is a UK café in winter and spring, with Christmas closures (25 and 26 Dec, 2 Jan) that now fall on 20, 21 and 28 Jul 2025. We keep them rather than editing real data. The hero's real data has no Diwali effect; S1 is shown on the simulated cohort. |
| INR prices | Assumption | `config/price_list.yaml`: a plausible Bengaluru café-bakery price list (e.g. Coffee ₹120, Bread ₹60). Unlisted items cost ₹100. "NONE" and "Adjustment" rows cost ₹0 and are dropped; 67 transactions with no priced item are dropped. Basket amount = sum of item prices. |
| Payer IDs | Simulated | 400 local regulars drawn from the bakery's ward, with Zipf-like repeat visits (exponent 1.0), plus 8% walk-ins from anywhere in the city. |
| Partner bakery | Optional | If `data/raw/partner_bakery.csv` exists (`timestamp, amount_inr, payer_hash`), it replaces Bread Basket as the hero and the app labels it "Partner bakery (consented)". It is shifted by whole weeks onto the window. Not present in this build. |

## The synthetic region

- **Payers:** 50,000 across 3 cities (Bengaluru tier 1, Mysuru tier 2, Hubballi tier 3; names are labels only) and 20 wards of 2,500 payers each. 12% of payers bet at all. Four betting syndicates draw bettor pools from them (sizes in `config/settings.yaml`). Bettors also shop normally, so honest merchants share some payers with bettors by chance.
- **Merchants (314):** 250 honest background merchants in 7 categories, built from templates in `config/merchant_templates.yaml` (hour-of-day profile, day-of-week, log-normal bill size, round-amount rate, refund rate, local payer base, walk-ins). The bakery template uses the real Bread Basket hour-of-week profile and real basket amounts (scaled ×0.8–1.3 per bakery). Plus the hero, its S0 twin, 3 banned seed fronts, scenario fronts, the 10-front E2 ring and 45 randomised extra fronts.
- **Honest hard negatives:** about 5% each of late opening hours, a permanent volume step-up and a one-day bulk catering order, and 10% organic growth. 10% of honest merchants onboard mid-window and are scored against their declared profile.
- **Festivals:** `data/events/festivals.csv`. Day and evening multipliers apply to every bakery and sweet shop (Diwali evening ×4.5), with gift-box round amounts and city-wide walk-ins on festival days.
- **Declared (KYB) profile:** each merchant declares a category and an expected daily volume. Honest merchants declare their real size ×0.7–1.4; shells declare a typical figure for "IT services".
- **Banned seed fronts:** BF1 (banned 29 Aug), BF3 (23 Sep), BF2 (12 Oct). At ban time the investigation hands over the list of payers who placed bets (its "bettors").

## Betting behaviour (all synthetic)

Rules and their motivating public findings are in `config/scenarios.yaml` and on the app's Data page. Bets cluster around live-match moments: 30% toss, 25% innings break, 25% final overs and 20% in play. Sessions of 1–3 bets come a few minutes apart. Stakes are round (₹200–₹5,000) unless the front evades. 45% of sessions win and are paid back at odds 1.7–2.1 as "refunds" 15–150 minutes after the match, unless payouts are off-platform. Test matches carry 35% of a limited-overs match's betting volume each day.

## Fixtures

`data/events/fixtures.csv` holds IPL 2025 from its 17 May resumption to the 3 Jun final, the opening match, and India's international fixtures from Jun to Nov 2025 (England Tests, Asia Cup, West Indies Tests, Women's World Cup, the Australia tour). The build machine could not reach official schedule sites. Rows confirmed by web search are marked so; **every other row is "to be verified by team"**. The 2025 IPL league games before 17 May fall outside the simulation window and are not listed. Live-match moments are offsets from the scheduled start (`config/engines.yaml`). Test matches are scored on each of 5 scheduled days, which is an assumption; real results may end earlier.

## Engine design choices

- **Warm-up:** merchants live on day 0 spend their first 30 eligible days building the frozen anchor and are not scored then. Merchants onboarded later are scored from day one against their declared profile.
- **Drift noise floor:** each drift component scores (x − floor)/(ref − floor). Floors are sampling-noise levels seen on honest training merchants, and CUSUM's floor is its alarm level h = 5. The drift score is cohort-adjusted: the peer group's median drift at the same hour is subtracted.
- **CUSUM** runs on trailing-24 h volume standardised by the anchor; the hourly value carries the previous day's state.
- **Rolling baseline:** 30 days, lagged 7 days, excluding days the anchor-based drift flagged. Drift takes the max against the anchor or the rolling baseline.
- **Loop ratio** is event-weighted: the share of payouts in the window whose recipient paid in during the 7 days before.
- **Match clock:** the Poisson GLM with an offset and one binary regressor has a closed-form MLE (tested against a numerical fit). The 1,000-shift placebo test runs only where the real β ≥ 0.5; elsewhere p is reported as 1, because the clock cannot fire there anyway.
- **Graph:** distinct payers over a trailing 30-day window. The hypergeometric tail is Bonferroni-adjusted across known banned fronts. Adamic–Adar uses payer degree from the baseline period. Hard links count only links with already-banned fronts.
- **Peer groups:** HDBSCAN finds few clusters of 8 or more at this scale, so most groups fall back to category × size band (region-wide).

## Fusion and response

- **Labels:** a front's merchant-hours from its first betting payment onward are positive; everything before is negative.
- **Split:** by merchant, 70/30, stratified by truth. All scenario merchants (S0–S5, E1–E3) are forced into test, and the banned seed fronts into train. 30% of training merchants form the isotonic-calibration fold. Time-aware validation inside training: days < 125 train, days ≥ 125 validate, for early stopping.
- **Decision rule:** level thresholds come from p × C_fraud > (1 − p) × C_friction(L) with the costs in `config/costs.yaml`. L2+ needs 2 engines and L4+ needs 3. A level is held for 24 h. Automatic action stops at L3; L4 and L5 need analyst approval.
- **Delta reserve:** Tolerated = baseline ₹ × exp(cohort lift + 3σ). The cohort lift is the peer group's median **rupee** lift in that hour, and σ is the merchant's own coefficient of variation of daily volume. Held = min(surplus, fingerprinted ₹). It applies to a day's settlement if L3 is reached before that day's T+1 cut-off (11:00 next day).
- **Earned Trust:** the consented bank and GST features are simulated. Log-likelihood-ratio weights are design parameters. Refusing consent changes nothing.

## Things the team should verify

1. `data/events/fixtures.csv`: dates and IST start times marked "to be verified by team".
2. `config/price_list.yaml`: the INR price list.
3. Source citations in `config/scenarios.yaml` (as supplied in the brief).
4. Partner-bakery data, if added: consent and anonymisation.

## Environment notes

- Built and tested with Python 3.11 (pinned in `requirements.txt`) in a venv at `.venv`.
- Playwright screenshots use the pre-installed Chromium if `PLAYWRIGHT_CHROMIUM` or `/opt/pw-browsers` exists; otherwise run `playwright install chromium` once.
