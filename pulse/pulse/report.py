"""REPORT.md from the evaluation artefacts (simulated results only)."""
from __future__ import annotations

import json
import pathlib


def _l(path):
    return json.loads(pathlib.Path(path).read_text())


def write_report(art: pathlib.Path, out: pathlib.Path) -> None:
    ev = art / "eval"
    m = _l(ev / "metrics.json")
    c = m["stage_c_calibrated_lightgbm"]
    a = m["stage_a_scorecard"]
    card = _l(ev / "scenario_scorecard.json")
    abl = _l(ev / "ablation.json")
    fair = _l(ev / "fairness.json")
    money = _l(ev / "money_contained.json")
    lab = _l(ev / "engines_lab.json")
    f = lambda x, d=2: "n/a" if x is None else f"{x:.{d}f}"  # noqa: E731
    L = [
        "# PULSE: performance on simulated scenarios",
        "",
        "> Every number below comes from a **simulated** region (synthetic merchants, payers and betting behaviour) built",
        "> around one real bakery's normal (the public Bread Basket dataset). None of it is PayU real-world performance.",
        "> Thresholds and costs were set on training merchants and frozen before the test merchants were scored.",
        "",
        f"Test set: {c['n_test_merchants']} merchants ({c['n_test_fronts']} fronts, {c['n_test_honest']} honest), split by merchant.",
        "Scenario merchants (S0-S5, E1-E3) are always in the test set.",
        "",
        "## Scenario scorecard",
        "",
        "| ID | Scenario | Expected | Actual | Result |",
        "|---|---|---|---|---|",
    ]
    for r in card:
        res = ("PASS" if r["pass"] else "FAIL") + (" (reported, not asserted)" if r["report_only"] else "")
        L.append(f"| {r['id']} | {r['label']} | {r['expected']} | {r['actual']} | {res} |")
    L += ["", "Notes:", ""] + [f"- **{r['id']}**: {r['explanation']}" for r in card] + [
        "",
        "## Headline metrics (test merchants)",
        "",
        "| Metric | Stage C (calibrated LightGBM) | Stage A (expert scorecard, shadow) |",
        "|---|---|---|",
        f"| Precision@10 / @25 / @50 (merchants ranked by peak score) | {f(c['precision_at_10'])} / {f(c['precision_at_25'])} / {f(c['precision_at_50'])} | {f(a['precision_at_10'])} / {f(a['precision_at_25'])} / {f(a['precision_at_50'])} |",
        f"| Recall: fronts reaching L2+ after takeover | {f(c['recall_l2'])} | {f(a['recall_l2'])} |",
        f"| Recall: fronts reaching L3 (auto) | {f(c['recall_l3'])} | {f(a['recall_l3'])} |",
        f"| PR-AUC, merchant level | {f(c['merchant_pr_auc'], 3)} | {f(a['merchant_pr_auc'], 3)} |",
        f"| PR-AUC, merchant-day level (base rate {f(c['merchant_day_base_rate'], 3)}) | {f(c['merchant_day_pr_auc'], 3)} | {f(a['merchant_day_pr_auc'], 3)} |",
        f"| False alarms: honest L3+ episodes per 1,000 merchant-months | {f(c['false_alarms_l3_per_1000_merchant_months'], 1)} | {f(a['false_alarms_l3_per_1000_merchant_months'], 1)} |",
        f"| False alarms: honest L2+ episodes per 1,000 merchant-months | {f(c['false_alarms_l2_per_1000_merchant_months'], 1)} | {f(a['false_alarms_l2_per_1000_merchant_months'], 1)} |",
        f"| Time to detect (first L2+), median hours | {f(c['detect_hours_median'], 1)} | {f(a['detect_hours_median'], 1)} |",
        f"| Time to detect, 90th percentile hours | {f(c['detect_hours_p90'], 1)} | {f(a['detect_hours_p90'], 1)} |",
        f"| Fronts detected within 24 h of the first bet | {f(c['detect_within_24h_share'])} | {f(a['detect_within_24h_share'])} |",
        "",
        f"Precision@k is bounded by the number of test fronts ({c['n_test_fronts']}); with k = 50 the maximum possible is {min(1, c['n_test_fronts'] / 50):.2f}.",
        "",
        "## Money contained (test fronts)",
        "",
        f"- Betting pay-ins on test fronts: Rs {money['total_betting_inr']:,.0f}",
        f"- Held by the L3 delta reserve: Rs {money['total_held_inr']:,.0f}",
        f"- Betting volume that had already settled before the first L3: Rs {money['total_settled_before_flag_inr']:,.0f}",
        "",
        "## Alarm arithmetic (Engines lab)",
        "",
        f"- Naive: P(z > 3) = {100 * lab['naive']['p_tail']:.3f}% x 1,000,000 merchant-hours = {lab['naive']['expected_alarms']:,.0f} alarms an hour.",
        f"- Measured on {lab['honest_merchant_hours']:,} honest simulated merchant-hours, per million merchant-hours:",
        f"  - peer z > 3: {lab['per_million']['z_gt_3']:,.0f}",
        f"  - plus persistence (3 of the last 6 hours): {lab['per_million']['z_gt_3_persistent']:,.0f}",
        f"  - plus corroboration (a second engine fires too): {lab['per_million']['persistent_and_corroborated']:,.0f}",
        f"  - final ladder at L2+ (any engines): {lab['per_million']['ladder_l2_plus']:,.0f}",
        "",
        "## Ablation (each engine switched off; model retrained on training merchants)",
        "",
        "| Variant | P@10 | P@25 | Recall L2+ | Merchant-day PR-AUC | False alarms L3+/1k mm | Median detect h | Detected <= 24 h |",
        "|---|---|---|---|---|---|---|---|",
    ] + [f"| {r['variant']} | {f(r['precision_at_10'])} | {f(r['precision_at_25'])} | {f(r['recall_l2'])} | {f(r['merchant_day_pr_auc'], 3)} | "
         f"{f(r['false_alarms_l3_per_1000_merchant_months'], 1)} | {f(r['detect_hours_median'], 1)} | {f(r['detect_within_24h_share'])} |" for r in abl] + [
        "",
        "## Fairness: honest test merchants ever flagged",
        "",
        "| Dimension | Group | n | Ever L1 | Ever L2 | Ever L3 |",
        "|---|---|---|---|---|---|",
    ] + [f"| {r['dimension']} | {r['value']} | {r['n']} | {f(r['ever_l1'])} | {f(r['ever_l2'])} | {f(r['ever_l3'])} |" for r in fair] + [
        "",
        "Small groups (n < 10) give unstable rates; read them as indicative only.",
    ]
    out.write_text("\n".join(L) + "\n")
