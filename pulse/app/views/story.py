"""Story mode: the 2-minute demo, seven guided steps."""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ui import charts, components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY, GREY_DARK, JADE, MINT, NEON

STEPS = ["Meet the bakery", "Day T: the takeover", "Four engines light up", "One fair score",
         "Proportionate action", "Honest cases stay quiet", "Evidence pack"]

if "step" not in st.session_state:
    try:
        st.session_state.step = int(st.query_params.get("step", 1))
    except ValueError:
        st.session_state.step = 1
st.session_state.step = int(np.clip(st.session_state.step, 1, len(STEPS)))


def go_to(k: int):
    st.session_state.step = int(np.clip(k, 1, len(STEPS)))
    st.query_params["step"] = str(st.session_state.step)


step = st.session_state.step
M = data.merchants()
hero = M[M.code == "HERO"].iloc[0]
twin = M[M.code == "HERO_TWIN"].iloc[0]
H = data.hourly("HERO")
T0 = int(hero.takeover_t_min // 60)
TD = T0 // 24
first_l2 = int(hero.first_l2_h)
first_l3 = int(hero.first_l3_h) if hero.first_l3_h >= 0 else first_l2
meta = data.meta()
thr = meta["level_thresholds"]
costs = meta["config"]["costs"]

# ---------------------------------------------------------------- stepper + nav
st.markdown("<div class='stepper'>" + "".join(
    f"<div class='s {'cur' if i + 1 == step else ('done' if i + 1 < step else '')}'><b>STEP {i + 1}</b>{s}</div>"
    for i, s in enumerate(STEPS)) + "</div>", unsafe_allow_html=True)


def fmt_p(p):
    return "> 0.99" if p >= 0.995 else f"= {p:.2f}"


def nav(key):
    a, _, b = st.columns([1, 6, 1])
    a.button("← Back", on_click=go_to, args=(step - 1,), disabled=step == 1, key=f"back{key}", use_container_width=True)
    b.button("Next →", on_click=go_to, args=(step + 1,), disabled=step == len(STEPS), key=f"next{key}", type="primary",
             use_container_width=True)


# ================================================================ STEP 1
if step == 1:
    prof = data.js("hero_profile.json")
    src = twin.data_source
    C.title("Meet Sunrise Bakery", simulated=False, real=True,
            sub=f"Its normal comes from real payments: {meta['ingest_report']['transactions_used']:,} baskets from the public "
                f"Bread Basket dataset, moved onto the 2025 calendar with day-of-week kept. Payer IDs and INR prices are simulated assumptions.")
    C.kpi_row([("Payments a day", f"{prof['avg_daily_payments']:.0f}", "average over 162 days"),
               ("Median bill", f"₹{prof['median_bill']:.0f}", "from the declared price list"),
               ("Local regulars", f"{prof['regulars']}", f"paid 4+ times · {100 * prof['share_from_regulars']:.0f}% of payments"),
               ("Open days", f"{prof['days_open']}", "closed on 3 holidays in the original data")])
    st.write("")
    c1, c2 = st.columns([3, 2])
    with c1:
        fig = go.Figure()
        hrs = list(range(24))
        fig.add_trace(go.Bar(x=hrs, y=prof["weekday_by_hour"], name="Weekday", marker_color=JADE))
        fig.add_trace(go.Bar(x=hrs, y=prof["weekend_by_hour"], name="Weekend", marker_color=DARK))
        fig.update_layout(title="Payments per hour of day: breakfast and lunch peaks, quiet evenings", barmode="group", height=360,
                          xaxis=dict(title="Hour of day", dtick=2, range=[5.5, 23.5]), yaxis_title="Average payments")
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    with c2:
        amts = np.array(prof["amounts"])
        fig = go.Figure(go.Histogram(x=amts, xbins=dict(start=0, end=1200, size=40), marker_color=MINT))
        fig.update_layout(title="Bill sizes (₹)", height=360, xaxis_title="₹ per payment", yaxis_title="Payments", bargap=0.05)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    C.note(f"Source: {src}. PULSE learns this pattern of life: its own hours, bill sizes, payers and refunds (none).")
    nav(1)

# ================================================================ STEP 2
elif step == 2:
    C.title("Day T: the same merchant ID starts taking bets", simulated=True,
            sub=f"From {data.hour_label(T0, '%a %d %b %Y')} (India v Pakistan, Asia Cup) the bakery's QR also collects stakes. "
                "The papers stay genuine and each payment looks normal on its own. Press ▶ to replay hour by hour.")
    P = data.payments("HERO")
    pin = P[P.kind == 0]
    h0, h1 = TD * 24 + 10, (TD + 6) * 24 + 4
    hrs = np.arange(h0, h1)
    ph = pin.t_min // 60
    sel = (ph >= h0) & (ph < h1)
    inside = np.bincount((ph[sel & pin.fp_match] - h0).to_numpy(), minlength=len(hrs))
    outside = np.bincount((ph[sel & ~pin.fp_match] - h0).to_numpy(), minlength=len(hrs))
    pp = H.p.to_numpy()[hrs]
    lv = H.level_auto.to_numpy()[hrs]
    lv_rec = H.level.to_numpy()[hrs]
    x = charts.ts(hrs)
    ymax = float(max(inside + outside)) * 1.15

    def traces(k):
        o = np.where(np.arange(len(hrs)) <= k, outside, np.nan)
        i = np.where(np.arange(len(hrs)) <= k, inside, np.nan)
        p_ = np.where(np.arange(len(hrs)) <= k, pp, np.nan)
        return [go.Bar(x=x, y=o, name="Payments outside match windows", marker_color=JADE),
                go.Bar(x=x, y=i, name="Payments inside match windows", marker_color=DARK),
                go.Scatter(x=x, y=p_, name="PULSE probability", yaxis="y2", line=dict(color=EMERALD, width=3), mode="lines")]

    K = len(hrs) - 1

    def caption(k):
        rec = f" (L{int(lv_rec[k])} recommended, needs analyst approval)" if lv_rec[k] > lv[k] else ""
        return f"{data.hour_label(hrs[k])} · action L{int(lv[k])}{rec} · p {fmt_p(pp[k])}"

    fig = go.Figure(data=traces(K))
    frames = []
    for k in range(0, len(hrs)):
        frames.append(go.Frame(data=traces(k), name=str(k), layout=dict(title=dict(
            text=caption(k)))))
    fig.frames = frames
    charts.add_match_bands(fig, h0, h1, label=False)
    fig.update_layout(
        title=caption(K), barmode="stack", height=480,
        yaxis=dict(title="Payments per hour", range=[0, ymax]), yaxis2=dict(overlaying="y", side="right", range=[0, 1.05], title="Probability", showgrid=False),
        legend=dict(y=1.12), margin=dict(t=90, b=90),
        updatemenus=[dict(type="buttons", showactive=False, x=0, y=-0.18, xanchor="left", yanchor="top", direction="left",
                          buttons=[dict(label="▶ Replay", method="animate", args=[None, dict(frame=dict(duration=110, redraw=True), fromcurrent=False, transition=dict(duration=0))]),
                                   dict(label="❚❚ Pause", method="animate", args=[[None], dict(mode="immediate", frame=dict(duration=0))])],
                          bgcolor="#fff", bordercolor=DARK, font=dict(color=DARK))],
        sliders=[dict(active=K, x=0.18, len=0.82, y=-0.12, yanchor="top", currentvalue=dict(visible=False), pad=dict(t=0),
                      steps=[dict(method="animate", label=data.hour_label(h, "%d %b %H:00") if (h % 12 == 0) else "",
                                  args=[[str(k)], dict(mode="immediate", frame=dict(duration=0, redraw=True))]) for k, h in enumerate(hrs)])],
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    night = (hrs >= TD * 24) & (hrs < TD * 24 + 24)
    share = inside[night].sum() / max((inside + outside)[night].sum(), 1)
    P_out = P[(P.kind == 1) & (P.t_min // 60 >= h0) & (P.t_min // 60 < h1)]
    C.kpi_row([("Payments on Day T", f"{int((inside + outside)[night].sum())}", f"vs about {twin.base_daily_tx:.0f} on a normal day"),
               ("Inside match windows", f"{100 * share:.0f}%", "shaded green on the chart"),
               ("'Refunds' paid out", f"₹{P_out.amount.sum():,.0f}", f"{len(P_out)} payouts in the replay window"),
               ("First PULSE flag (L2+)", data.hour_label(first_l2, "%H:00 %d %b"),
                "in the same hour as the first bet" if first_l2 == T0 else f"{first_l2 - T0} h after the first bet")])
    nav(2)

# ================================================================ STEP 3
elif step == 3:
    C.title("Four engines light up", simulated=True,
            sub="Each engine looks at what betting cannot hide. Move the clock to watch them cross their thresholds; none acts alone.")
    opts = list(range(TD * 24 + 17, TD * 24 + 24 + 4))
    all4 = [o for o in opts if int(H.n_engines.iloc[o]) == 4]
    default = all4[0] if all4 else min(max(first_l3 + 2, opts[0]), opts[-1])
    h = st.select_slider("Clock", options=opts, value=default, format_func=lambda v: data.hour_label(v))
    r = H.iloc[h]
    tiles = [("1 · Drift from its own past", bool(r.drift_fire), f"score {r.drift_adj:.2f} (fires at 0.50)"),
             ("2 · Peers", bool(r.peer_fire), f"robust z {r.peer_z:.1f}, {int(r.peer_persist)} of last 6 h"),
             ("3 · Betting invariants", bool(r.invariants_fire), f"match β {r.match_beta:.1f}, placebo p {r.match_p:.3f}"),
             ("4 · Network graph", bool(r.graph_fire), f"−log₁₀ p {r.graph_neglogp:.1f}; {int(r.shared_k)} shared bettors")]
    cols = st.columns(4)
    for c, (n, on, v) in zip(cols, tiles):
        c.markdown(C.engine_tile(n, on, v), unsafe_allow_html=True)
    st.write("")
    cols = st.columns(4)
    # drift: last 24 h vs expected by hour
    with cols[0]:
        win = np.arange(h - 23, h + 1)
        fig = go.Figure([go.Bar(x=charts.ts(win), y=H.cnt.to_numpy()[win], marker_color=DARK, name="Last 24 h"),
                         go.Scatter(x=charts.ts(win), y=H.E.to_numpy()[win], line=dict(color=JADE, width=3), name="Its own normal")])
        fig.update_layout(height=250, title="Last 24 h vs its own normal", showlegend=False, margin=dict(l=30, r=10, t=40, b=30),
                          xaxis=dict(tickformat="%H:00", nticks=4), title_font_size=13)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        C.note("Bars: payments per hour in the last 24 h. Line: what its frozen baseline expects for those hours.")
    with cols[1]:
        win = np.arange(h - 71, h + 1)
        fig = go.Figure([go.Scatter(x=charts.ts(win), y=H.lift.to_numpy()[win], line=dict(color=DARK, width=3), name="Sunrise"),
                         go.Scatter(x=charts.ts(win), y=H.peer_median_lift.to_numpy()[win], line=dict(color=MINT, width=3), name="Peer median")])
        fig.update_layout(height=250, title="Lift vs its peer group (log)", showlegend=False, margin=dict(l=30, r=10, t=40, b=30),
                          xaxis=dict(nticks=4, tickformat="%d %b"), title_font_size=13)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        C.note("Dark: Sunrise's 24 h lift over 3 days. Mint: median lift of its bakery peer group. Fires when z &gt; 3 persists 3 of 6 hours.")
    with cols[2]:
        P = data.payments("HERO")
        lo = (max(h, TD * 24 + 26) - 167) * 60
        hi = (max(h, TD * 24 + 26) + 1) * 60
        A = set(P.payer_id[(P.kind == 0) & (P.t_min >= lo) & (P.t_min < hi)])
        B = set(P.payer_id[(P.kind == 1) & (P.t_min >= lo) & (P.t_min < hi)])
        st.plotly_chart(charts.venn(len(A), len(B), len(A & B)), use_container_width=True, config={"displayModeBar": False})
        C.note(f"Closed loop after the match: {len(A & B)} of {len(B)} payout recipients had paid in (loop ratio "
               f"{len(A & B) / max(len(B), 1):.2f}). Match-clock β = {r.match_beta:.1f}.")
    with cols[3]:
        net = data.js("network.json")
        n30 = int(r.n_payers_30d)
        k = int(r.shared_k)
        bf = next(b for b in meta["banned"] if b["code"] == "BF1")
        expv = n30 * bf["n_bettors"] / meta["payer_pool"]
        fig = go.Figure(go.Bar(x=["Expected by chance", "Observed"], y=[expv, k], marker_color=[GREY_DARK, DARK],
                               text=[f"{expv:.1f}", f"{k}"], textposition="outside"))
        fig.update_layout(height=250, title="Shared with a banned front", margin=dict(l=30, r=10, t=40, b=30),
                          yaxis=dict(range=[0, max(k, expv) * 1.3 + 1]), title_font_size=13)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        C.note(f"{bf['name']} was banned on {data.hour_label(bf['ban_day'] * 24, '%d %b')}; its bettors now pay Sunrise.")
        _ = net
    nav(3)

# ================================================================ STEP 4
elif step == 4:
    rep = data.reasons_for("HERO", "replay")
    night = [r for r in rep if TD * 24 + 17 <= r["hour"] <= TD * 24 + 27]
    full = [r for r in night if r["n_engines"] == 4 and len(r["reasons"]) >= 3]
    rr = full[0] if full else (data.reasons_for("HERO", "first_l3") or data.reasons_for("HERO", "first_l2"))[0]
    h = rr["hour"]
    p = rr["p"]
    C.title("One fair score, three plain reasons", simulated=True,
            sub="The four engines are fused into one calibrated probability (monotone LightGBM + isotonic calibration). "
                "SHAP picks the top contributions; every number in the reasons is recomputed from the payments.")
    c1, c2 = st.columns([2, 3])
    with c1:
        st.plotly_chart(charts.gauge(p, f"At {data.hour_label(h)}"), use_container_width=True, config={"displayModeBar": False})
        rec = int(H.level.iloc[h])
        auto = int(H.level_auto.iloc[h])
        st.markdown(f"<div style='text-align:center'>Action now: {C.level_chip(auto)} &nbsp; "
                    f"<span class='muted'>{int(rr['n_engines'])} of 4 engines agree</span></div>"
                    + (f"<div class='muted' style='text-align:center;margin-top:6px'>L{rec} recommended; needs analyst approval</div>" if rec > auto else ""),
                    unsafe_allow_html=True)
    with c2:
        st.markdown("#### Why")
        C.reason_cards(rr["reasons"])
    st.markdown("#### The decision rule")
    cf = costs["c_fraud"]
    lev = "L3"
    c3 = costs["c_friction"][lev]
    lhs, rhs = p * cf, (1 - p) * c3
    ps = f"{p:.3f}" if p < 0.995 else "0.999+"
    st.markdown(f"<div class='ineq'>Act at <b>{lev}</b> only if &nbsp; p × C<sub>fraud</sub> &gt; (1 − p) × C<sub>friction</sub>({lev}) &nbsp;→&nbsp; "
                f"{ps} × {cf} = <span class='hl'>{lhs:.1f}</span> &nbsp;&gt;&nbsp; {1 - p:.3f} × {c3} = <b>{rhs:.2f}</b> &nbsp;"
                f"{'✓ act' if lhs > rhs else '✗ hold back'}</div>", unsafe_allow_html=True)
    C.note(f"Costs are design parameters (tune them on the Response page). Corroboration: L2 and above need at least two engines to "
           f"fire independently. Here: {int(rr['n_engines'])}. PULSE first reached L2 at {data.hour_label(first_l2)}, the hour of the first bets.")
    if p >= 0.995:
        C.note("Why ‘> 99%’: isotonic calibration maps this score band to the share of fronts among calibration-fold merchant-days, and in "
               "the simulation that share is 100%. Real data would be noisier; the number shows calibration working, not certainty.")
    nav(4)

# ================================================================ STEP 5
elif step == 5:
    R = data.pq("reserve_S3.parquet")
    C.title("Proportionate action: hold only the suspicious surplus", simulated=True,
            sub="L3 delta reserve: Tolerated = baseline × exp(cohort lift + 3σ). Only payments above Tolerated that carry a betting "
                "fingerprint (match window, round stake, new distant payer, loop payer) are held. Everything else settles T+1.")
    h0, h1 = TD * 24 + 6, TD * 24 + 24
    w = R.iloc[h0:h1]
    x = charts.ts(np.arange(h0, h1))
    fig = go.Figure([
        go.Bar(x=x, y=w.settled_on_time, name="Settles on time (T+1)", marker_color=JADE),
        go.Bar(x=x, y=w.held, name="Held in delta reserve", marker_color=DARK),
        go.Scatter(x=x, y=w.tolerated, name="Tolerated", mode="lines", line=dict(color=NEON, width=4, shape="hv")),
    ])
    charts.add_match_bands(fig, h0, h1, label=False)
    fig.update_layout(barmode="stack", height=420, title=f"Takeover day, hour by hour (₹) · {data.hour_label(h0, '%a %d %b %Y')}",
                      yaxis_title="₹ per hour", xaxis=dict(tickformat="%H:00"))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    day = R.iloc[TD * 24:TD * 24 + 24]
    C.kpi_row([("Paid in on Day T", f"₹{day.amount.sum():,.0f}", ""),
               ("Held (fingerprinted surplus)", f"₹{day.held.sum():,.0f}", f"{100 * day.held.sum() / max(day.amount.sum(), 1):.0f}% of the day"),
               ("Settles on time", f"₹{day.settled_on_time.sum():,.0f}", "the bakery's real sales are untouched"),
               ("Held over the whole case", f"₹{R.held.sum():,.0f}", "simulated, through 2 Nov")])
    C.note("L4 (pause payouts) and L5 (exit + STR) are recommendations that always require analyst approval.")
    nav(5)

# ================================================================ STEP 6
elif step == 6:
    C.title("And the honest cases stay quiet", simulated=True,
            sub="Diwali lifts every sweet shop and bakery; match nights lift every sports bar. PULSE compares with peers and needs "
                "corroboration, so neither escalates.")
    c1, c2 = st.columns(2)
    for col, code, title, why in [
        (c1, "S1_SWEETS", "S1 · Lakshmi Sweets on Diwali", "Cohort lift raises Tolerated, peers lift together, no payouts, no shared bettors."),
        (c2, "S2_SPORTSBAR", "S2 · Third Umpire Sports Bar on match nights", "The match clock fires, but payers are local regulars and nobody is paid back."),
    ]:
        with col:
            hh = data.hourly(code)
            m = M[M.code == code].iloc[0]
            if code == "S1_SWEETS":
                dd = [d for d in range(144, 152)]
            else:
                dd = list(range(108, 116))
            hrs = np.arange(dd[0] * 24, (dd[-1] + 1) * 24)
            fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.8, 0.2], vertical_spacing=0.05)
            fig.add_trace(go.Bar(x=charts.ts(hrs), y=hh.cnt.to_numpy()[hrs], marker_color=JADE, name="Payments per hour"), row=1, col=1)
            fig.add_trace(go.Scatter(x=charts.ts(hrs), y=hh.E.to_numpy()[hrs] * np.exp(np.maximum(0, hh.peer_median_lift.to_numpy()[hrs])),
                                     line=dict(color=DARK, width=2), name="Peer-adjusted expectation"), row=1, col=1)
            fig.add_trace(charts.level_strip(hh.level.to_numpy()[hrs], charts.ts(hrs)), row=2, col=1)
            if code == "S2_SPORTSBAR":
                charts.add_match_bands(fig, hrs[0], hrs[-1], label=False)
            fig.update_yaxes(visible=False, row=2, col=1)
            fig.update_layout(height=360, title=title, legend=dict(y=1.1), margin=dict(t=70))
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
            st.markdown(f"<div style='font-size:14px'>Highest level over 162 days: {C.level_chip(int(m.max_level))}</div>", unsafe_allow_html=True)
            if code == "S1_SWEETS":
                rf = data.pq("reserve_S1_forced.parquet")
                dd_ = rf.groupby(rf.hour // 24).agg(a=("amount", "sum"), t=("tolerated_day", "first"))
                pk = dd_.a.idxmax()
                C.note(f"Delta reserve even if L3 were forced over the festival week: <b>₹{rf.held.sum():,.0f} held</b>. "
                       f"On the busiest day it took ₹{dd_.a[pk]:,.0f} against a cohort-raised Tolerated of ₹{dd_.t[pk]:,.0f}.")
            C.note(why)
    nav(6)

# ================================================================ STEP 7
elif step == 7:
    C.title("Evidence pack: one click for the analyst", simulated=True,
            sub="Timeline, engine readings, the three reasons, graph links, the action taken, and a draft STR narrative for compliance.")
    md = data.text("artifacts/evidence/HERO_case_file.md")
    html = data.text("artifacts/evidence/HERO_case_file.html")
    c1, c2 = st.columns([3, 2])
    with c1:
        with st.container(height=520, border=True):
            st.markdown(md)
    with c2:
        st.download_button("⬇ Download case file (Markdown)", md, file_name="PULSE_case_file_Sunrise_Bakery.md", use_container_width=True)
        st.download_button("⬇ Download case file (HTML with charts)", html, file_name="PULSE_case_file_Sunrise_Bakery.html",
                           mime="text/html", use_container_width=True)
        st.write("")
        C.html_table([
            {"v": "OTP re-verification, one supplier invoice (L2)", "h": "Case opened, evidence frozen"},
            {"v": "Video KYC; part of settlement delayed (L3)", "h": "Only fingerprinted surplus held"},
            {"v": "Nothing else changes", "h": "STR drafted; merchant not informed"},
        ], [("v", "Visible to the merchant"), ("h", "Hidden compliance track")])
        st.write("")
        st.markdown("<div class='reason' style='border-left-color:#002124'><div class='eng'>Compliance</div>Draft for compliance review — "
                    "not filed; filed within 7 working days per PMLA rules; merchant is not informed.</div>", unsafe_allow_html=True)
    nav(7)

_ = (pd, DARK_SOFT)
