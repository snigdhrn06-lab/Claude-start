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

# ---------------------------------------------------------------- real shops (out of sample)
real = data.js("eval/real_shops.json") if (data.ART / "eval" / "real_shops.json").exists() else None
if real:
    st.markdown("### Real shops we didn't design: the false-alarm test")
    dv, ho = real["dev"]["summary"], (real.get("holdout") or {}).get("summary")
    st.markdown(
        f"<div class='muted'>Every number above comes from a world we simulated. So we also ran PULSE on <b>real, honest shops</b> it was never "
        f"built or trained on: {dv['by_source'].get('real (Olist, Brazil)', 0)} Brazilian online sellers from Olist's public data and a UK gift "
        f"wholesaler (UCI Online Retail, {real['dev']['shops'][-1]['payments']:,} invoices and {dv['refunds']:,} real refunds). They join the city as "
        "newcomers and are scored by the frozen model. None of them takes bets, so every Review or Act is a false alarm.</div>", unsafe_allow_html=True)
    st.write("")
    rows = [{"k": "Shops", "a": dv["shops"], "b": ho["shops"] if ho else "–"},
            {"k": "Merchant-months scored", "a": dv["merchant_months"], "b": ho["merchant_months"] if ho else "–"},
            {"k": "Reached Review (L2): analyst looks, nothing held", "a": dv["ever_l2"], "b": ho["ever_l2"] if ho else "–"},
            {"k": "Reached Act (L3) <b>before</b> the rule change", "a": f"{dv['rule_off']['ever_l3']} ({dv['rule_off']['l3_per_1000_merchant_months']:.0f} per 1,000 merchant-months)",
             "b": f"{ho['rule_off']['ever_l3']} ({ho['rule_off']['l3_per_1000_merchant_months']:.0f} per 1,000)" if ho else "–"},
            {"k": "Reached Act (L3) <b>after</b> the rule change", "a": dv["ever_l3"], "b": ho["ever_l3"] if ho else "–"},
            {"k": "Money held", "a": f"₹{dv['held_inr']:,}", "b": f"₹{ho['held_inr']:,}" if ho else "–"}]
    C.html_table(rows, [("k", "Real honest shops"), ("a", "Test slice: Olist Sep 2017–Feb 2018 + UK wholesaler"),
                        ("b", "Holdout: Olist Mar–Sep 2018, run once")], raw_cols=("k",))
    C.note("What we learned: the first run put 7 of 57 real shops at Act. Every one was a small seller having a genuine surge, flagged by drift and "
           "peers together. Both of those only say 'unlike normal', so two of them agreeing isn't independent evidence of betting. We changed one rule: "
           "Act now also needs a betting-specific engine (invariants or graph); drift + peers alone can reach Review at most. Because the rule came from "
           "that slice, we checked it on a second Olist period we had not looked at: 3 Acts without the rule, 0 with it. On the simulated city the rule "
           "changed nothing measurable (same recall, same money held, 9 of 9 scenarios). The UK wholesaler, with real refunds and a Christmas rush, "
           "never went above a silent check. Real shops still reach Review more often than simulated ones, which is a real analyst cost.")
    st.write("")
    rd = data.pq("real_daily.parquet")
    shops = real["dev"]["shops"] + (real.get("holdout") or {}).get("shops", [])
    flagged = [x for x in shops if x["max_level"] >= 2 or x["code"] == "R_UK01"]
    pick = st.selectbox("See one real shop", [x["code"] for x in flagged],
                        format_func=lambda c: next(f"{x['name']} · highest level L{x['max_level']} (L{x['max_level_rule_off']} without the rule)"
                                                   for x in shops if x["code"] == c))
    sh = next(x for x in shops if x["code"] == pick)
    dd = rd[(rd.merchant_id == sh["merchant_id"]) & (rd.slice == ("holdout" if pick.startswith("R_HO") else "dev"))]
    from plotly.subplots import make_subplots
    f = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.7, 0.3], vertical_spacing=0.08,
                      subplot_titles=("Payments per day (real data)", "Ladder level per day (dark = Review or above)"))
    f.add_trace(go.Bar(x=dd.day + 1, y=dd.cnt, marker_color=JADE, name="Payments"), row=1, col=1)
    f.add_trace(go.Bar(x=dd.day + 1, y=dd.level, marker_color=[DARK if v >= 2 else GREY for v in dd.level], name="Level"), row=2, col=1)
    f.update_yaxes(range=[0, 3.3], tickvals=[0, 1, 2, 3], ticktext=["L0", "L1", "L2", "L3"], row=2, col=1)
    f.update_layout(height=420, showlegend=False, margin=dict(t=40))
    f.update_xaxes(title_text="Day of the 162-day window", row=2, col=1)
    st.plotly_chart(f, use_container_width=True, config={"displayModeBar": False})
    C.note(f"{sh['source']} · {sh['payments']:,} payments, {sh['refunds']:,} refunds · drift fired in {100 * sh['fire_share']['drift']:.1f}% of hours, "
           f"peers {100 * sh['fire_share']['peer']:.1f}%, invariants {100 * sh['fire_share']['invariants']:.1f}%, graph {100 * sh['fire_share']['graph']:.1f}%. "
           "Dates are shifted onto the simulation calendar (day of week kept); amounts converted to rupees at a fixed rate.")

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
    fig.update_layout(height=380, title="Score vs share of front-days (simulated; calibration claimed only after shadow mode)", xaxis_title="Mean model score", yaxis_title="Observed share of front-days",
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

st.markdown("### Stage A expert scorecard (day one, shadow mode) vs Stage B learned model")
C.html_table([
    {"k": "Recall L2+", "c": f"{c['recall_l2']:.2f}", "a": f"{a['recall_l2']:.2f}"},
    {"k": "Merchant-day PR-AUC", "c": f"{c['merchant_day_pr_auc']:.3f}", "a": f"{a['merchant_day_pr_auc']:.3f}"},
    {"k": "False alarms L3+ / 1,000 merchant-months", "c": f"{c['false_alarms_l3_per_1000_merchant_months']:.1f}", "a": f"{a['false_alarms_l3_per_1000_merchant_months']:.1f}"},
    {"k": "Median hours to detect", "c": f"{c['detect_hours_median']:.0f}", "a": f"{a['detect_hours_median']:.0f}" if a["detect_hours_median"] is not None else "n/a"},
], [("k", "Metric"), ("c", "Stage B: monotone LightGBM (decides)"), ("a", "Stage A: expert scorecard (no labels)")])
_ = (DARK_SOFT, EMERALD, GREY, NEON)
