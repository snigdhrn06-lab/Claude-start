"""Story mode: the 2-minute demo, seven guided steps."""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ui import charts, components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY, GREY_DARK, JADE, MINT, NEON

STEPS = ["Meet the bakery", "Day T: the takeover", "Four engines light up", "One risk band",
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

# ---------------------------------------------------------------- cinematic presentation entry point
_c1, _c2, _c3 = st.columns([4, 3, 2])
_c1.markdown("<div class='muted' style='padding-top:10px'>Presenting to judges? The cinematic version plays the whole story "
             "automatically (about 2 minutes, no clicks after Play).</div>", unsafe_allow_html=True)
_c2.page_link("pages/04_film.py", label="Watch the 2-minute film", icon=":material/movie:", use_container_width=True)


@st.cache_data(show_spinner=False)
def _offline_html():
    from ui import presentation_data
    return presentation_data.html()


_c3.download_button("⬇ Offline copy (HTML)", _offline_html(), file_name="PULSE_presentation.html", mime="text/html",
                    use_container_width=True, help="One file that plays in any browser, even without the app running.")

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
    # KPIs cover the whole calendar day of Day T (00:00-24:00), not just the hours drawn on the chart
    dayp = pin[(ph >= TD * 24) & (ph < TD * 24 + 24)]
    day_n = len(dayp)
    share = dayp.fp_match.sum() / max(day_n, 1)
    P_out = P[(P.kind == 1) & (P.t_min // 60 >= h0) & (P.t_min // 60 < h1)]
    C.kpi_row([("Payments on Day T", f"{day_n}", f"vs about {twin.base_daily_tx:.0f} on a normal day"),
               ("Inside match windows", f"{100 * share:.0f}%", "shaded green on the chart"),
               ("'Refunds' paid out", f"₹{P_out.amount.sum():,.0f}", f"{len(P_out)} payouts in the replay window"),
               ("First PULSE flag (L2+)", data.hour_label(first_l2, "%H:00 %d %b"),
                "in the same hour as the first bet" if first_l2 == T0 else f"{first_l2 - T0} h after the first bet")])
    prev = pin[(ph >= (TD - 30) * 24) & (ph < TD * 24)]
    rnd_today, rnd_norm = int(dayp.fp_round.sum()), prev.fp_round.sum() / 30
    nd_today, nd_norm = int(dayp.fp_newdistant.sum()), prev.fp_newdistant.sum() / 30
    C.note(f"Also on Day T: <b>{rnd_today}</b> round-number bills (₹100 multiples) vs about {rnd_norm:.0f} on a normal day, and <b>{nd_today}</b> payments "
           f"from new payers outside the bakery's neighbourhood vs about {nd_norm:.0f}. Normal day = the 30 days before.")
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
    ne = int(r.n_engines)
    band = C.band_of(int(r.level))
    gate = ("No engine has fired: Watch." if ne == 0 else "One engine alone can never act: the case stays at Watch." if ne == 1
            else f"{ne} engines agree, so the two-engine gate opens: {band}.")
    if not any(int(H.n_engines.iloc[o]) == 1 for o in opts):
        first2 = next((o for o in opts if int(H.n_engines.iloc[o]) >= 2), opts[0])
        tw = data.hourly("HERO_TWIN")
        lone = int(((tw.n_engines == 1) & (tw.level <= 1)).sum())
        gate += (f" Tonight two engines crossed in the same hour ({data.hour_label(first2, '%H:00')}), "
                 f"so there's no lone-engine moment here. The S0 twin (Merchant explorer) shows one: drift fired alone for {lone} hours "
                 "in July–August and the case never left Watch.")
    strip = "".join(f"<div class='gcell' style='background:{C.BAND_BG[C.band_of(int(H.level.iloc[o]))]};color:{C.BAND_FG[C.band_of(int(H.level.iloc[o]))]}'>"
                    f"<b>{data.hour_label(o, '%H:00')}</b>{int(H.n_engines.iloc[o])} eng · {C.band_of(int(H.level.iloc[o]))}</div>" for o in opts)
    st.markdown(f"<div class='gate'><div class='gtitle'>Two-engine gate at {data.hour_label(h, '%H:00')}: <b>{ne} of 4</b> engines → <b>{band}</b>. "
                f"<span class='muted'>{gate}</span></div><div class='gstrip'>{strip}</div></div>", unsafe_allow_html=True)
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
    C.title("One risk band, three plain reasons", simulated=True,
            sub="The four engines are fused by a monotone LightGBM model into one risk band: Watch, Review or Act. SHAP picks the top "
                "contributions; every number in the reasons is recomputed from the payments.")
    c1, c2 = st.columns([2, 3])
    with c1:
        st.markdown(C.band_card(int(H.level.iloc[h]), p, int(rr["n_engines"]), data.hour_label(h)), unsafe_allow_html=True)
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
    st.markdown(f"<div class='ineq'>Act at <b>{lev}</b> only if &nbsp; s × C<sub>fraud</sub> &gt; (1 − s) × C<sub>friction</sub>({lev}) &nbsp;→&nbsp; "
                f"{ps} × {cf} = <span class='hl'>{lhs:.1f}</span> &nbsp;&gt;&nbsp; {1 - p:.3f} × {c3} = <b>{rhs:.2f}</b> &nbsp;"
                f"{'✓ act' if lhs > rhs else '✗ hold back'}</div>", unsafe_allow_html=True)
    C.note(f"Costs are design parameters (tune them on the Response page). Corroboration: L2 and above need at least two engines to "
           f"fire independently. Here: {int(rr['n_engines'])}. PULSE first reached L2 at {data.hour_label(first_l2)}, the hour of the first bets.")
    C.note("s is the model's score. We don't call it a probability: it was trained on simulated data, and we'll only claim calibration after "
           "shadow mode on PayU data. That's why the screen shows a risk band, not a percentage.")
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
               ("Held over the whole case", f"₹{R.held.sum():,.0f}", f"simulated, through {data.hour_label(int(R.hour.max()), '%d %b')}")])
    st.markdown("#### Which payments were held, and why")
    P5 = data.payments("HERO")
    held_hours = set((day.hour[day.held > 0]).astype(int))
    hp = P5[(P5.kind == 0) & P5.fingerprinted & (P5.t_min // 60).isin(held_hours)].copy()
    if len(hp):
        def why(r):
            w = []
            if r.fp_match: w.append("inside a live-match window")
            if r.fp_round: w.append("round amount")
            if r.fp_newdistant: w.append("new payer from outside the area")
            if r.fp_loop: w.append("payer already received a 'refund'")
            return ", ".join(w)
        hp["time"] = [f"{(int(t) // 60) % 24:02d}:{int(t) % 60:02d}" for t in hp.t_min]
        hp["amt"] = [f"₹{int(a):,}" for a in hp.amount]
        hp["why"] = [why(r) for r in hp.itertuples()]
        C.html_table(hp.sort_values("t_min").head(8).to_dict("records"), [("time", "Time"), ("amt", "Amount"), ("payer_city", "Payer city"),
                                                                         ("channel", "Channel"), ("why", "Betting fingerprints")])
        ex = hp.sort_values("t_min").query("is_bet == 0") if "is_bet" in hp else hp.iloc[0:0]
        ex_txt = (f"the honest ₹{int(ex.amount.iloc[0]):,} bill at {ex.time.iloc[0]} above carries one ({why(ex.iloc[0])}) and waits for review "
                  "with the rest" if len(ex) else "an honest round-amount bill can carry one and wait for review with the rest")
        C.note(f"{len(hp)} fingerprinted payments sat in the held hours; the held amount is capped at their total, hour by hour. A fingerprint "
               f"isn't proof: {ex_txt}. Most daytime sales carry none and settle on time.")
    C.note("L4 (pause payouts) and L5 (exit + draft STR) are recommendations that always need a human review.")
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
    s1h = data.hourly("S1_SWEETS")
    dpk = int(s1h.iloc[148 * 24:149 * 24].lift.idxmax())
    hk = int(H.iloc[TD * 24 + 17:TD * 24 + 24].lift.idxmax())
    l_s1, m_s1 = float(s1h.lift.iloc[dpk]), float(s1h.peer_median_lift.iloc[dpk])
    l_h, m_h = float(H.lift.iloc[hk]), float(H.peer_median_lift.iloc[hk])
    st.markdown(f"""<div class='gate'><div class='gtitle'>Why one spike is fine and the other isn't: the peer gap</div>
<div class='muted' style='font-size:15px;line-height:1.7'>gap = ln(shop's volume ÷ its normal) − median of the same for its peers<br>
<b>Diwali, illustrative:</b> shop ×5, peers ×5 → ln 5 − ln 5 = <b>0</b> → nothing to flag.
&nbsp; <b>Measured</b> for Lakshmi Sweets on 20 Oct: {l_s1:.2f} − {m_s1:.2f} = <b>{l_s1 - m_s1:.2f}</b><br>
<b>India v Pakistan, illustrative:</b> shop ×5, peers ×1 → ln 5 − ln 1 = <b>1.61</b> → flag.
&nbsp; <b>Measured</b> for Sunrise Bakery on 14 Sep: {l_h:.2f} − {m_h:.2f} = <b>{l_h - m_h:.2f}</b></div></div>""", unsafe_allow_html=True)
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
