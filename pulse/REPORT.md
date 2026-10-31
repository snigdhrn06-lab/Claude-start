# PULSE: performance on simulated scenarios

> Every number below comes from a **simulated** region (synthetic merchants, payers and betting behaviour) built
> around one real bakery's normal (the public Bread Basket dataset). None of it is PayU real-world performance.
> Thresholds and costs were set on training merchants and frozen before the test merchants were scored.

Test set: 106 merchants (29 fronts, 77 honest), split by merchant.
Scenario merchants (S0-S5, E1-E3) are always in the test set.

## Scenario scorecard

| ID | Scenario | Expected | Actual | Result |
|---|---|---|---|---|
| S0 | Hero bakery, normal months (real data) | No action above L0 | Max level L0 over 162 days | PASS |
| S1 | Diwali: every bakery and sweet shop x4-5 | No L2+; delta reserve holds Rs 0 | Max level L0; reserve held Rs 0 (Rs 0 even if L3 were forced over Diwali) | PASS |
| S2 | Sports bar busy on every match night | At most L0/L1 (watch only) | Max level L1 | PASS |
| S3 | Hero bakery taken over on day T | Flag within hours of T (<= 1 match day); L3 delta reserve; evidence pack | Flagged L2+ 0 h after the first bet; auto level L3; Rs 3,205,493 held | PASS |
| S4 | Slow ramp: betting share +3 points a week | Flag before the betting share passes 20% (design parameter) | Flagged at week 6 when betting share on match days was 18% (limit 20%) | PASS |
| S5 | Brand-new 'IT services' shell | Flag on day one via the graph engine | Graph fires on day one: yes; flagged L2+ 2 h after its first payment | PASS |
| E1 | Evasion: S3 without round amounts | Still flagged (timing, loop, graph) | Flagged L2+ 0 h after the first bet | PASS (reported, not asserted) |
| E2 | Evasion: betting split across 10 small fronts | Linked through shared bettors | 10 of 10 ring fronts flagged L2+ (median 400 h after their first bet); 10 linked to a banned front through shared bettors | PASS (reported, not asserted) |
| E3 | Evasion: winners paid off-platform | Weaker signal; still flagged by timing + graph, or marked 'would need consented bank data' | Flagged L2+ 1 h after the first bet | PASS (reported, not asserted) |

Notes:

- **S0**: Real bakery data stays inside its own pattern of life.
- **S1**: The whole sweet-shop cohort lifts on Diwali, so the peer gap stays small and Tolerated rises with the cohort.
- **S2**: Match nights lift every sports bar; payers are local and nobody is paid back, so the match clock alone cannot escalate.
- **S3**: Timing, round stakes, new distant payers and the shared-bettor graph agree within the first match night.
- **S4**: The frozen anchor keeps the original bakery as the reference, so the slow ramp cannot teach the model that betting is normal.
- **S5**: 12 of its first 20 payers are bettors of a front banned two days earlier, and it shares that front's device ID.
- **E1**: Removing round amounts removes one drift signal; timing, the refund loop and the graph remain.
- **E2**: Each ring member is small, so volume engines stay quiet; shared bettors with the banned front link them once that front is banned.
- **E3**: With no refunds on PayU the loop engine is blind; timing, new distant payers and the graph carry the case. Seeing the off-platform payouts would need consented bank data (Earned Trust tier 2).

## Headline metrics (test merchants)

| Metric | Stage C (calibrated LightGBM) | Stage A (expert scorecard, shadow) |
|---|---|---|
| Precision@10 / @25 / @50 (merchants ranked by peak score) | 1.00 / 1.00 / 0.58 | 1.00 / 1.00 / 0.58 |
| Recall: fronts reaching L2+ after takeover | 0.97 | 0.97 |
| Recall: fronts reaching L3 (auto) | 0.97 | 0.97 |
| PR-AUC, merchant level | 1.000 | 0.999 |
| PR-AUC, merchant-day level (base rate 0.091) | 0.983 | 0.933 |
| False alarms: honest L3+ episodes per 1,000 merchant-months | 0.0 | 3.2 |
| False alarms: honest L2+ episodes per 1,000 merchant-months | 0.0 | 3.2 |
| Time to detect (first L2+), median hours | 163.0 | 163.0 |
| Time to detect, 90th percentile hours | 786.1 | 786.1 |
| Fronts detected within 24 h of the first bet | 0.31 | 0.31 |

Precision@k is bounded by the number of test fronts (29); with k = 50 the maximum possible is 0.58.

## Money contained (test fronts)

- Betting pay-ins on test fronts: Rs 30,913,427
- Held by the L3 delta reserve: Rs 11,934,079
- Betting volume that had already settled before the first L3: Rs 4,700,200

## Alarm arithmetic (Engines lab)

- Naive: P(z > 3) = 0.135% x 1,000,000 merchant-hours = 1,350 alarms an hour.
- Measured on 741,432 honest simulated merchant-hours, per million merchant-hours:
  - peer z > 3: 9,880
  - plus persistence (3 of the last 6 hours): 6,830
  - plus corroboration (a second engine fires too): 152
  - final ladder at L2+ (any engines): 23

## Ablation (each engine switched off; model retrained on training merchants)

| Variant | P@10 | P@25 | Recall L2+ | Merchant-day PR-AUC | False alarms L3+/1k mm | Median detect h | Detected <= 24 h |
|---|---|---|---|---|---|---|---|
| full | 1.00 | 1.00 | 0.97 | 0.983 | 0.0 | 163.0 | 0.31 |
| without drift | 1.00 | 1.00 | 0.90 | 0.984 | 0.0 | 246.5 | 0.21 |
| without peers | 1.00 | 1.00 | 0.97 | 0.983 | 0.0 | 163.0 | 0.31 |
| without invariants | 1.00 | 1.00 | 0.76 | 0.877 | 0.0 | 417.5 | 0.21 |
| without graph | 0.80 | 0.92 | 0.62 | 0.956 | 0.0 | 72.0 | 0.28 |

## Fairness: honest test merchants ever flagged

| Dimension | Group | n | Ever L1 | Ever L2 | Ever L3 |
|---|---|---|---|---|---|
| tier | 1 | 43 | 0.37 | 0.00 | 0.00 |
| tier | 2 | 22 | 0.59 | 0.00 | 0.00 |
| tier | 3 | 12 | 0.17 | 0.00 | 0.00 |
| size_band | small | 26 | 0.46 | 0.00 | 0.00 |
| size_band | medium | 25 | 0.48 | 0.00 | 0.00 |
| size_band | large | 26 | 0.27 | 0.00 | 0.00 |
| category | bakery | 11 | 0.09 | 0.00 | 0.00 |
| category | it_services | 5 | 0.80 | 0.00 | 0.00 |
| category | kirana | 12 | 0.42 | 0.00 | 0.00 |
| category | pharmacy | 9 | 0.33 | 0.00 | 0.00 |
| category | restaurant | 20 | 0.45 | 0.00 | 0.00 |
| category | sports_bar | 7 | 1.00 | 0.00 | 0.00 |
| category | sweet_shop | 13 | 0.15 | 0.00 | 0.00 |

Small groups (n < 10) give unstable rates; read them as indicative only.
