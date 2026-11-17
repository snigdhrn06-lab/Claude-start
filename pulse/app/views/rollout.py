"""Rollout (shadow mode + stop rules) and the 'why not a rules engine?' comparison."""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from ui import components as C, data
from ui.theme import DARK, GREY_DARK, JADE, MINT, NEON

C.title("Rollout & rules vs PULSE", simulated=True, sub="How PULSE would go live safely, and why a simple rules engine isn't enough. All on simulated test merchants.")
import yaml  # noqa: E402

ro = yaml.safe_load((data.ROOT / "config" / "costs.yaml").read_text())["rollout"]
M = data.merchants()
D = data.pq("daily.parquet")
met = data.js("eval/metrics.json")["stage_c_calibrated_lightgbm"]
card = data.js("eval/scenario_scorecard.json")
tabs = st.tabs(["1 · Shadow mode & stop rules", "2 · Why not a rules engine?"])

with tabs[0]:
    test = M[M.split == "test"]
    rd = data.pq("reserve_daily_test_fronts.parquet")
    dt = D[D.merchant_id.isin(test.merchant_id) & D.active.astype(bool)].copy()
    dt["week"] = dt.day // 7
    truth = M.set_index("merchant_id").truth
    dt["honest"] = truth.reindex(dt.merchant_id).to_numpy() == "honest"
    wk = dt.groupby("week").agg(alerts=("level", lambda s: int((s >= 2).sum())))
    wk["honest_act"] = dt[dt.honest].groupby("week").level_auto.apply(lambda s: int((s >= 3).sum())).reindex(wk.index, fill_value=0)
    rd["week"] = rd.day // 7
    wk["would_hold"] = rd.groupby("week").held.sum().reindex(wk.index, fill_value=0)
    x = [data.hour_label(int(w) * 7 * 24, "%d %b") for w in wk.index]
    fig = go.Figure([go.Bar(x=x, y=wk.would_hold, name="Would have held (₹)", marker_color=DARK),
                     go.Scatter(x=x, y=[0] * len(x), name="Actually held in shadow mode (₹0)", line=dict(color=NEON, width=3))])
    fig.update_layout(height=320, title="Shadow mode on the simulated test merchants, week by week", yaxis_title="₹ per week")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    sr = ro["stop_rules"]
    s1 = data.pq("reserve_S1_forced.parquet").held.sum()
    new_cases = dt[dt.level >= 2].sort_values("day").drop_duplicates("merchant_id").groupby("day").size()
    per_analyst = float(new_cases.max()) / sr["analysts"] if len(new_cases) else 0.0
    rules = [("Honest merchants reaching Act, per 1,000 merchant-months", f"{met['false_alarms_l3_per_1000_merchant_months']:.1f}",
              f"≤ {sr['max_honest_act_per_1000_merchant_months']}", met["false_alarms_l3_per_1000_merchant_months"] <= sr["max_honest_act_per_1000_merchant_months"]),
             ("Held from the Diwali cohort (even with L3 forced)", f"₹{s1:,.0f}", f"≤ ₹{sr['max_diwali_held_inr']}", s1 <= sr["max_diwali_held_inr"]),
             ("Precision of the top 10 alerts", f"{met['precision_at_10']:.2f}", f"≥ {sr['min_precision_at_10']}", met["precision_at_10"] >= sr["min_precision_at_10"]),
             ("Median hours from first bet to Review/Act", f"{met['detect_hours_median']:.0f} h", f"≤ {sr['max_median_detect_hours']} h",
              met["detect_hours_median"] <= sr["max_median_detect_hours"]),
             ("Peak new cases per analyst per day", f"{per_analyst:.1f}", f"≤ {sr['max_new_cases_per_analyst_day']} ({sr['analysts']} analysts)",
              per_analyst <= sr["max_new_cases_per_analyst_day"]),
             ("Designed scenarios passing (S0–S5, E1–E3)", f"{sum(r['pass'] for r in card)} / {len(card)}", "all", all(r["pass"] for r in card))]
    C.html_table([{"r": a, "v": b, "l": c, "ok": "<span class='pass'>✅ PASS</span>" if ok else "<span class='fail'>❌ FAIL</span>"} for a, b, c, ok in rules],
                 [("r", "Stop rule"), ("v", "Simulated value"), ("l", "Limit (design parameter)"), ("ok", "Result")], raw_cols=("ok",))
    st.write("")
    cols = st.columns(len(ro["stages"]))
    for k, (c, s) in enumerate(zip(cols, ro["stages"])):
        c.markdown(f"<div class='jtile{' primary' if k == 0 else ''}' style='min-height:190px'><div class='jnum'>{k + 1}</div>"
                   f"<div class='jtitle' style='font-size:20px'>{s['name']}</div><div class='jbody'>{s['what']}<br><b>Move on when:</b> {s['exit']}</div></div>",
                   unsafe_allow_html=True)
    C.note("The median time to detect (163 h) only just passes its 168 h limit: small or quiet fronts take days to weeks. That's the honest weak spot.")

with tabs[1]:
    st.markdown("**The rule:** flag a merchant on any day its payment count exceeds **3× its own normal daily average** (its first 30 scored days). "
                "This is the kind of 'volume went up' alert most systems start with. Same simulated city, same test merchants.")
    act = D[D.active.astype(bool)].copy()
    base = act.sort_values("day").groupby("merchant_id").head(30).groupby("merchant_id").cnt.mean()
    act["rule"] = act.cnt > 3 * base.reindex(act.merchant_id).to_numpy()
    test = M[M.split == "test"].set_index("merchant_id")
    t_day = (test.takeover_t_min // 1440)
    rows = {"rule": {}, "pulse": {}}
    hon = test[test.truth == "honest"].index
    fro = test[test.truth == "front"].index
    diw = set(range(146, 152))
    a_t = act[act.merchant_id.isin(test.index)]
    rule_h = a_t[a_t.merchant_id.isin(hon) & a_t.rule]
    rows["rule"]["honest_flagged"] = rule_h.merchant_id.nunique()
    rows["rule"]["diwali_alarms"] = int(rule_h.day.isin(diw).sum())
    det, delay = 0, []
    for m in fro:
        f = a_t[(a_t.merchant_id == m) & a_t.rule & (a_t.day >= t_day[m])]
        if len(f):
            det += 1
            delay.append(int(f.day.min() - t_day[m]))
    rows["rule"]["fronts_caught"] = det
    rows["rule"]["median_delay_days"] = float(np.median(delay)) if delay else None
    p_h = a_t[a_t.merchant_id.isin(hon) & (a_t.level >= 2)]
    rows["pulse"]["honest_flagged"] = p_h.merchant_id.nunique()
    rows["pulse"]["diwali_alarms"] = int(p_h.day.isin(diw).sum())
    s = M.set_index("merchant_id")
    caught = [m for m in fro if s.loc[m, "first_l2_h"] >= 0]
    rows["pulse"]["fronts_caught"] = len(caught)
    rows["pulse"]["median_delay_days"] = float(np.median([s.loc[m, "detect_hours"] / 24 for m in caught])) if caught else None
    C.kpi_row([("Honest shops flagged: rule", f"{rows['rule']['honest_flagged']} of {len(hon)}", f"{rows['rule']['diwali_alarms']} alarm-days in Diwali week"),
               ("Honest shops flagged: PULSE", f"{rows['pulse']['honest_flagged']} of {len(hon)}", f"{rows['pulse']['diwali_alarms']} alarm-days in Diwali week"),
               ("Fronts caught: rule", f"{rows['rule']['fronts_caught']} of {len(fro)}", f"median {rows['rule']['median_delay_days']:.1f} days after the first bet" if delay else ""),
               ("Fronts caught: PULSE", f"{rows['pulse']['fronts_caught']} of {len(fro)}", f"median {rows['pulse']['median_delay_days']:.1f} days after the first bet")])
    fig = go.Figure()
    cats = ["Honest shops flagged", "Diwali-week alarm days", "Fronts caught"]
    fig.add_trace(go.Bar(x=cats, y=[rows["rule"]["honest_flagged"], rows["rule"]["diwali_alarms"], rows["rule"]["fronts_caught"]], name="Rule: volume > 3× normal",
                         marker_color=GREY_DARK, text=[rows["rule"]["honest_flagged"], rows["rule"]["diwali_alarms"], rows["rule"]["fronts_caught"]], textposition="outside"))
    fig.add_trace(go.Bar(x=cats, y=[rows["pulse"]["honest_flagged"], rows["pulse"]["diwali_alarms"], rows["pulse"]["fronts_caught"]], name="PULSE",
                         marker_color=JADE, text=[rows["pulse"]["honest_flagged"], rows["pulse"]["diwali_alarms"], rows["pulse"]["fronts_caught"]], textposition="outside"))
    fig.update_layout(barmode="group", height=360, title="Same simulated city, same test merchants")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    C.note("Why the rule fails both ways: festivals multiply honest volume (false alarms), while a careful front keeps its volume modest and is never "
           "flagged. PULSE asks different questions: is it unlike its own past, unlike its peers, are refunds looping back, are its customers known bettors?")
_ = (pd, MINT)
