"""Evaluation: performance on simulated scenarios (test merchants only)."""
import numpy as np
import plotly.graph_objects as go
import streamlit as st

from ui import components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY, GREY_DARK, JADE, MINT, NEON

C.title("Performance on simulated scenarios", simulated=True,
        sub="Test merchants only, split by merchant. Thresholds and costs were set on training merchants and frozen before scoring. "
            "None of this is PayU real-world performance.")
m = data.js("eval/metrics.json")
c = m["stage_c_calibrated_lightgbm"]
a = m["stage_a_scorecard"]
money = data.js("eval/money_contained.json")
C.kpi_row([("Recall (fronts reaching L2+)", f"{100 * c['recall_l2']:.0f}%", f"{c['n_test_fronts']} test fronts"),
           ("Precision@10", f"{c['precision_at_10']:.2f}", f"@25: {c['precision_at_25']:.2f} · @50: {c['precision_at_50']:.2f}"),
           ("Merchant-day PR-AUC", f"{c['merchant_day_pr_auc']:.3f}", f"base rate {c['merchant_day_base_rate']:.3f}"),
           ("False alarms L3+", f"{c['false_alarms_l3_per_1000_merchant_months']:.1f}", "per 1,000 honest merchant-months"),
           ("Money held at L3", f"₹{money['total_held_inr'] / 1e5:,.1f} lakh",
            f"vs ₹{money['total_settled_before_flag_inr'] / 1e5:,.1f} lakh settled before the first flag")])
C.note(f"Precision@50 is capped at {min(1, c['n_test_fronts'] / 50):.2f} because the test set has {c['n_test_fronts']} fronts.")

st.markdown("### Scenario scorecard")
card = data.js("eval/scenario_scorecard.json")
rows = [{"id": f"<b>{r['id']}</b>", "label": r["label"], "exp": r["expected"], "act": r["actual"],
         "res": (f"<span class='pass'>✅ PASS</span>" if r["pass"] else "<span class='fail'>❌ FAIL</span>") + (" <span class='muted'>(reported)</span>" if r["report_only"] else ""),
         "why": r["explanation"]} for r in card]
C.html_table(rows, [("id", "ID"), ("label", "Scenario"), ("exp", "Expected"), ("act", "Actual"), ("res", "Result"), ("why", "Why")], raw_cols=("id", "res"))

st.write("")
c1, c2 = st.columns(2)
with c1:
    abl = data.js("eval/ablation.json")
    names = [r["variant"] for r in abl]
    fig = go.Figure()
    for key, nm, col in [("recall_l2", "Recall L2+", JADE), ("merchant_day_pr_auc", "Merchant-day PR-AUC", DARK), ("detect_within_24h_share", "Detected ≤ 24 h", MINT)]:
        fig.add_trace(go.Bar(x=names, y=[r[key] or 0 for r in abl], name=nm, marker_color=col, text=[f"{(r[key] or 0):.2f}" for r in abl],
                             textposition="outside", textfont=dict(size=10)))
    fig.update_layout(barmode="group", height=380, title="Ablation: each engine switched off (model retrained)", yaxis=dict(range=[0, 1.15]))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
with c2:
    rel = data.js("eval/reliability.json")["test"]
    fig = go.Figure([go.Scatter(x=[0, 1], y=[0, 1], line=dict(color=GREY_DARK, dash="dash"), name="Perfect calibration"),
                     go.Scatter(x=[r["mean_p"] for r in rel], y=[r["observed"] for r in rel], mode="lines+markers",
                                marker=dict(size=[6 + 3 * np.log10(r["n"]) for r in rel], color=JADE, line=dict(color=DARK, width=1)),
                                line=dict(color=JADE, width=3), name="Test merchant-days", hovertext=[f"n = {r['n']:,}" for r in rel])])
    fig.update_layout(height=380, title="Reliability: predicted p vs observed front share", xaxis_title="Mean predicted p", yaxis_title="Observed share of front-days",
                      xaxis=dict(range=[0, 1]), yaxis=dict(range=[0, 1]))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

c1, c2 = st.columns(2)
with c1:
    ttd = data.js("eval/time_to_detect.json")
    d = np.array([r["detect_hours"] for r in ttd if r["detect_hours"] is not None])
    miss = sum(r["detect_hours"] is None for r in ttd)
    edges = [0, 1, 3, 6, 12, 24, 48, 96, 168, 336, 672, 1200]
    cnt = np.histogram(d, bins=edges)[0]
    labels = [f"{edges[i]}–{edges[i + 1]} h" for i in range(len(edges) - 1)] + ["not flagged"]
    fig = go.Figure(go.Bar(x=labels, y=list(cnt) + [miss], marker_color=[JADE] * len(cnt) + [GREY_DARK], text=list(cnt) + [miss], textposition="outside"))
    fig.update_layout(height=360, title=f"Time to detect: first L2+ after the first bet (median {np.median(d):.0f} h)", yaxis_title="Test fronts")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    C.note("Two groups: loud fronts are caught on their first match night; small or quiet fronts are caught days to weeks later, "
           "often once the bettors' earlier front is banned and the graph engine can see them.")
with c2:
    st.markdown("#### Fairness: honest test merchants ever flagged")
    fair = data.js("eval/fairness.json")
    C.html_table([{"d": r["dimension"].replace("_", " "), "v": r["value"].replace("_", " "), "n": r["n"], "l1": f"{100 * r['ever_l1']:.0f}%",
                   "l2": f"{100 * r['ever_l2']:.0f}%", "l3": f"{100 * r['ever_l3']:.0f}%"} for r in fair],
                 [("d", "Dimension"), ("v", "Group"), ("n", "n"), ("l1", "Ever L1"), ("l2", "Ever L2"), ("l3", "Ever L3")])
    C.note("Small groups give unstable rates; indicative only.")

st.markdown("### Stage A scorecard (shadow mode) vs Stage C model")
C.html_table([
    {"k": "Recall L2+", "c": f"{c['recall_l2']:.2f}", "a": f"{a['recall_l2']:.2f}"},
    {"k": "Merchant-day PR-AUC", "c": f"{c['merchant_day_pr_auc']:.3f}", "a": f"{a['merchant_day_pr_auc']:.3f}"},
    {"k": "False alarms L3+ / 1,000 merchant-months", "c": f"{c['false_alarms_l3_per_1000_merchant_months']:.1f}", "a": f"{a['false_alarms_l3_per_1000_merchant_months']:.1f}"},
    {"k": "Median hours to detect", "c": f"{c['detect_hours_median']:.0f}", "a": f"{a['detect_hours_median']:.0f}" if a["detect_hours_median"] is not None else "n/a"},
], [("k", "Metric"), ("c", "Stage C: calibrated LightGBM"), ("a", "Stage A: expert scorecard (no labels)")])
_ = (DARK_SOFT, EMERALD, GREY, NEON)
