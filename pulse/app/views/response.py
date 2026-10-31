"""Response & trust: cost sliders, ladder mapping, delta reserve calculator, earned trust."""
import numpy as np
import plotly.graph_objects as go
import streamlit as st

from ui import charts, components as C, data
from ui.theme import DARK, JADE, LEVEL_COLORS, NEON

meta = data.meta()
costs = meta["config"]["costs"]
M = data.merchants()
C.title("Response & trust", simulated=True, sub="Respond in proportion. Move the costs and watch the ladder move; hold only what is suspicious; reward consent.")

tabs = st.tabs(["Friction ladder & costs", "Delta reserve calculator", "Earned Trust"])

with tabs[0]:
    c1, c2 = st.columns([1, 2])
    cf = c1.slider("C_fraud: cost of missing a front", 20, 400, int(costs["c_fraud"]), 10)
    cfr = {}
    for L in ["L1", "L2", "L3", "L4", "L5"]:
        cfr[L] = c1.slider(f"C_friction({L}) · {costs['levels'][L]['name']}", 1, 300, int(costs["c_friction"][L]), 1)
    thr = {L: c / (cf + c) for L, c in cfr.items()}
    with c2:
        rows = []
        for k, L in enumerate(["L0", "L1", "L2", "L3", "L4", "L5"]):
            lv = costs["levels"][L]
            rows.append({"lvl": C.level_chip(k), "thr": "always" if L == "L0" else f"p > {thr[L]:.3f}",
                         "eng": str(costs["min_engines"].get(L, 0)), "vis": lv["merchant_visible"], "hid": lv["compliance"]})
        C.html_table(rows, [("lvl", "Level"), ("thr", "Act when"), ("eng", "Engines needed"), ("vis", "Merchant sees"), ("hid", "Compliance track")],
                     raw_cols=("lvl",))
        C.note("Threshold for each level comes from p × C_fraud > (1 − p) × C_friction(L). L4–L5 always require analyst approval; "
               "automatic action stops at L3.")
    st.markdown("#### What these costs do to the scenario merchants")
    codes = ["HERO_TWIN", "S1_SWEETS", "S2_SPORTSBAR", "HERO", "S4", "S5", "E1", "E3"]
    out = []
    lv_hero = None
    for code in codes:
        hh = data.hourly(code)
        p, n, act = hh.p.to_numpy(), hh.n_engines.to_numpy(), hh.active.to_numpy()
        lvl = np.zeros(len(p), int)
        for k, L in enumerate(["L1", "L2", "L3", "L4", "L5"], start=1):
            lvl = np.where((p > thr[L]) & (n >= costs["min_engines"][L]), k, lvl)
        lvl = lvl * act
        if code == "HERO":
            lv_hero = lvl
        r = M[M.code == code].iloc[0]
        t = int(r.takeover_t_min // 60) if r.takeover_t_min == r.takeover_t_min else None
        first2 = np.where(lvl >= 2)[0]
        mx_ = int(lvl.max())
        out.append({"m": r["name"], "truth": "front" if t is not None else "honest",
                    "max": C.level_chip(min(mx_, costs["auto_max_level"])) + (f" <span class='muted'>L{mx_} recommended</span>" if mx_ > costs["auto_max_level"] else ""),
                    "first": (f"{first2[0] - t} h after first bet" if (t is not None and len(first2)) else ("—" if t is None and not len(first2) else
                              (data.hour_label(int(first2[0])) if len(first2) else "never")))})
    C.html_table(out, [("m", "Merchant"), ("truth", "Truth (simulated)"), ("max", "Highest automatic level"), ("first", "First L2+")], raw_cols=("max",))
    hh = data.hourly("HERO")
    T0 = int(M[M.code == "HERO"].iloc[0].takeover_t_min // 60)
    hrs = np.arange(T0 - 30, T0 + 24 * 7)
    fig = go.Figure(go.Bar(x=charts.ts(hrs), y=lv_hero[hrs], marker_color=[LEVEL_COLORS[int(v)] for v in lv_hero[hrs]],
                           hovertext=[f"L{int(v)}" for v in lv_hero[hrs]]))
    fig.update_layout(height=230, title="Sunrise Bakery: ladder level in the week after takeover, under these costs (no 24 h hold)",
                      yaxis=dict(range=[0, 5.3], dtick=1, title="Level"))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

with tabs[1]:
    c1, c2 = st.columns([1, 3])
    which = c1.radio("Case", ["S3 · Sunrise Bakery (front), takeover day", "S1 · Lakshmi Sweets (honest), Diwali week forced to L3"])
    k = c1.slider("Tolerance k (σ multiplier)", 0.0, 6.0, float(costs["delta_reserve"]["sigma_multiplier"]), 0.25)
    import sys

    sys.path.insert(0, str(data.ROOT))
    from pulse.response import delta_reserve

    if which.startswith("S3"):
        R = data.pq("reserve_S3.parquet")
        TD = int(M[M.code == "HERO"].iloc[0].takeover_t_min // 60) // 24
        R = R.iloc[TD * 24: TD * 24 + 24]
        lvl = np.where(R.applies.to_numpy(), 3, 0)
        force = False
    else:
        R = data.pq("reserve_S1_forced.parquet")
        lvl = np.full(len(R), 3)
        force = True
    sigma = float(R.sigma.iloc[0])
    out = delta_reserve(R["count"].to_numpy(), R.amount.to_numpy(), R.fingerprinted.to_numpy(), R.baseline.to_numpy(), 1.0,
                        R.cohort_lift_day.to_numpy()[::24], sigma, lvl, costs, k=k, force=force)
    tol, held = out.tolerated.to_numpy(), out.held.to_numpy()
    x = charts.ts(R.hour.to_numpy())
    fig = go.Figure([go.Bar(x=x, y=R.amount - held, name="Settles on time", marker_color=JADE),
                     go.Bar(x=x, y=held, name="Held", marker_color=DARK),
                     go.Scatter(x=x, y=tol, name="Tolerated", line=dict(color=NEON, width=4, shape="hv"))])
    fig.update_layout(barmode="stack", height=380, title="₹ per hour", yaxis_title="₹")
    c2.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    with c2:
        C.kpi_row([("Paid in", f"₹{R.amount.sum():,.0f}"), ("Held", f"₹{held.sum():,.0f}"), ("Settles on time", f"₹{R.amount.sum() - held.sum():,.0f}"),
                   ("σ (own daily variability)", f"{sigma:.2f}")], light=True)
    C.note("Per settlement window (one day, settled T+1): Tolerated = baseline × exp(cohort lift + k·σ), where the cohort lift is the peer "
           "group's median rupee lift that day, so Diwali raises Tolerated for every sweet shop. Held = min(surplus, fingerprinted rupees). "
           "The hourly bars split each day's figures for display.")

with tabs[2]:
    et = data.js("earned_trust.json")
    tier = st.radio("Consent tier", [0, 1, 2, 3], horizontal=True,
                    format_func=lambda t: f"Tier {t} · {costs['earned_trust']['tiers'][str(t)]['name']}")
    c1, c2 = st.columns(2)
    for col, code in [(c1, "HERO_TWIN"), (c2, "HERO")]:
        e = et[code]
        t = e["tiers"][tier]
        with col:
            st.markdown(f"#### {e['label']}")
            C.kpi_row([("Score before", f"{e['p_before']:.2f}"), ("Score with consent", f"{t['p']:.2f}"), ("Tolerance k", f"{t['k']:.1f}")])
            f = e["features"]
            rows = [{"k": "Settlement moved on within 2 h / 6 h", "v": f"{100 * f['sweep_2h']:.0f}% / {100 * f['sweep_6h']:.0f}%" if tier >= 2 else "not shared"},
                    {"k": "Outflows to suppliers and rent", "v": f"{100 * f['supplier_rent_share']:.0f}%" if tier >= 2 else "not shared"},
                    {"k": "PayU settlements ÷ declared GST turnover", "v": f"{f['gst_coverage']:.2f}" if tier >= 1 else "not shared"}]
            C.html_table(rows, [("k", "Consented signal (simulated)"), ("v", "Value")])
            st.markdown(f"<div class='reason'><div class='eng'>Terms</div>{t['perk']}</div>", unsafe_allow_html=True)
    C.note("Consented features are simulated for the prototype. Refusing consent is never a penalty; it only means no perks. "
           "For a front, consented bank data exposes the sweep of settlements to many individuals within hours.")
