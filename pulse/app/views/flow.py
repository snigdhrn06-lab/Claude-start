"""Where PULSE sits in PayU's flow, the scoring API, analyst workload and the settlement batch."""
import json
import sys
import time

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from ui import components as C, data
from ui.theme import DARK, GREY, GREY_DARK, JADE, MINT, NEON

sys.path.insert(0, str(data.ROOT))
from pulse import response as RS  # noqa: E402
from pulse import scoring_api as API  # noqa: E402

C.title("PayU flow, scoring API & ops", simulated=True,
        sub="Where PULSE plugs in (before settlement), what one scoring call looks like and how fast it is, how many analysts it needs, "
            "and what a settlement batch looks like on any day.")
tabs = st.tabs(["1 · Where PULSE plugs in", "2 · Scoring API", "3 · Analyst workload", "4 · Settlement simulator"])

with tabs[0]:
    boxes = [("Checkout", "Customer pays by QR, UPI collect or payment link", "#fff"),
             ("Payment captured", "Money lands in PayU's escrow/nodal account", "#fff"),
             ("PULSE scores the merchant-hour", "Four engines → one risk band, before the settlement batch is cut", DARK),
             ("Settlement (T+1)", "Normal sales pay out on time; only the fingerprinted surplus waits", "#fff"),
             ("Analyst queue", "Review/Act cases with three reasons and a case file", "#fff")]
    html = "<div class='flow'>"
    for k, (t, b, bg) in enumerate(boxes):
        dark = bg == DARK
        html += (f"<div class='fbox' style='background:{bg};color:{'#fff' if dark else DARK};border-color:{NEON if dark else GREY}'>"
                 f"<div class='ft'>{t}</div><div class='fb'>{b}</div></div>")
        if k < len(boxes) - 1:
            html += "<div class='farrow'>→</div>"
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        C.card("Visible track (the merchant sees)", "<div class='muted'>L1 nothing · L2 OTP re-verification and one supplier invoice · "
               "L3 video KYC and part of the day's settlement delayed for review · L4 payouts and refunds paused (after human review) · "
               "L5 account closed (after human review).</div>")
    with c2:
        C.card("Hidden compliance track (the merchant is not told)", "<div class='muted'>Case opened · evidence frozen · draft STR prepared for the "
               "compliance team to review and file within 7 working days per PMLA rules. PULSE never files anything itself.</div>")
    C.card("Intervention points", "<div class='muted'><b>① Before settlement</b>: the only point where money can still be held, which is why PULSE scores "
           "merchant-hours on a rolling basis and decides before the T+1 batch is cut (11:00 next day here). <b>② At onboarding</b>: a new merchant is "
           "scored from day one against its declared business. <b>③ After review</b>: an analyst's decision releases or keeps the held surplus.</div>")

with tabs[1]:
    M = data.merchants()
    pay = data.pq("payments_focus.parquet")
    hourly = data.pq("hourly_focus.parquet")
    start = pd.Timestamp(data.meta()["window_start"])
    hero = M[M.code == "HERO"].iloc[0]
    T0 = int(hero.takeover_t_min // 60)
    h = (T0 // 24) * 24 + 23

    @st.cache_data(show_spinner=False)
    def sample(code, hh):
        return API.build_request(code, hh, pay, hourly, M, start)

    req = sample("HERO", h)
    out = API.score_window(req["merchant"], req["payments"], req["context"])
    lat = data.js("eval/latency.json") if (data.ART / "eval" / "latency.json").exists() else None
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### `POST /score` request")
        shown = {**req, "payments": req["payments"][-3:]}
        st.code(json.dumps(shown, indent=1)[:2200] + f"\n… ({len(req['payments'])} payments in the trailing 7 days; 3 shown)", language="json", wrap_lines=True)
    with c2:
        st.markdown("#### Response")
        st.code(json.dumps(out, indent=1), language="json", wrap_lines=True)
    if lat:
        ag = lat["agreement_with_pipeline"]
        C.kpi_row([("p50 latency", f"{lat['p50_ms']:.2f} ms", f"{lat['calls']:,} calls"), ("p95 latency", f"{lat['p95_ms']:.2f} ms", lat["note"]),
                   ("Same band as full pipeline", f"{100 * ag['band_agreement']:.0f}%", f"{ag['merchant_days']} merchant-days"),
                   ("Pipeline 'Act' days the API also catches", f"{100 * ag['act_recall_vs_pipeline']:.0f}%", "lighter drift engine")])
    if st.button("Run a quick benchmark now (1,000 calls)"):
        t = []
        for _ in range(1000):
            t0 = time.perf_counter()
            API.score_window(req["merchant"], req["payments"], req["context"])
            t.append((time.perf_counter() - t0) * 1000)
        st.success(f"p50 {np.percentile(t, 50):.2f} ms · p95 {np.percentile(t, 95):.2f} ms on this machine, {len(req['payments'])} payments per call.")
    C.note("How work splits: the API scores one merchant's window against its frozen baseline (drift, refund loop, new distant payers). An hourly cohort "
           "job supplies peer z, the match-clock β and banned-front overlap as `context`. This is a laptop benchmark of single-threaded Python, not a "
           "production load test. Run it yourself: `python -m pulse.scoring_api --serve 8765` and POST the request above.")

with tabs[2]:
    d = data.pq("daily.parquet")
    Mi = data.merchants().set_index("merchant_id")
    c1, c2 = st.columns([1, 2])
    thr = c1.select_slider("Alert when the model score reaches", options=[0.02, 0.05, 0.057, 0.1, 0.2, 0.3, 0.5],
                           value=0.057, help="0.057 is the configured Review threshold")
    mins = c1.slider("Analyst minutes per alert (design parameter)", 5, 60, 20)
    hours = c1.slider("Productive analyst hours per day (design parameter)", 4.0, 8.0, 6.5, 0.5)
    act = d[d.active.astype(bool)]
    fired = act[(act.p >= thr) & (act.n_engines >= 2)]
    new_alerts = fired.sort_values("day").drop_duplicates("merchant_id")
    days = act.day.nunique()
    n_m = act.merchant_id.nunique()
    per_day = len(fired) / days
    per_lakh = per_day / n_m * 100_000
    analysts = per_lakh * mins / 60 / hours
    honest = Mi.truth.reindex(fired.merchant_id).to_numpy() == "honest"
    C.kpi_row([("Alert merchant-days per day", f"{per_day:.1f}", f"across {n_m} simulated merchants"),
               ("Per 1 lakh merchants", f"{per_lakh:,.0f} a day", "scaled linearly"),
               ("Analysts needed", f"{analysts:,.0f}", f"at {mins} min per alert, {hours} h a day"),
               ("Alerts on honest merchants", f"{100 * honest.mean():.1f}%" if len(fired) else "0%", "simulated")], light=True)
    with c2:
        xs = [0.02, 0.05, 0.057, 0.1, 0.2, 0.3, 0.5]
        ys = [len(act[(act.p >= x) & (act.n_engines >= 2)]) / days / n_m * 100_000 for x in xs]
        fig = go.Figure(go.Bar(x=[f"{x:g}" for x in xs], y=ys, marker_color=[NEON if x == thr else DARK for x in xs],
                               text=[f"{y:,.0f}" for y in ys], textposition="outside", cliponaxis=False))
        fig.update_layout(height=320, title="Alerts per day per 1 lakh merchants, by threshold (two engines must agree)", xaxis_title="Score threshold",
                          yaxis_title="Alerts / day / 1 lakh merchants", xaxis_type="category", yaxis=dict(rangemode="tozero"))
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    C.note("The simulated region has a far higher share of fronts than real life (60 of 314 merchants), so these alert volumes are pessimistic. "
           "The honest-alert share is the number to watch; it comes only from simulated honest merchants.")

with tabs[3]:
    M = data.merchants()
    focus = M[M.scenario.isin(["S0", "S1", "S2", "S3", "S4", "S5", "E1", "E3"])]
    lab = {r.code: f"{r['name']}" for _, r in focus.iterrows()}
    c1, c2 = st.columns([1, 2])
    code = c1.selectbox("Merchant", list(lab), format_func=lambda c: lab[c], index=list(lab).index("HERO"))
    r = M[M.code == code].iloc[0]
    H = data.hourly(code)
    D = len(H) // 24
    first_active = int(H.hour[H.active].min() // 24) if H.active.any() else 0
    default = int(r.takeover_t_min // 1440) if r.takeover_t_min == r.takeover_t_min else (148 if code == "S1_SWEETS" else first_active + 40)
    day = c1.slider("Settlement day (payments made on this day, paid out T+1)", first_active, D - 1, int(np.clip(default, first_active, D - 1)))
    c1.caption(data.hour_label(day * 24, "%A %d %b %Y"))
    declared_days = None
    if r.onboard_day > 0:
        state = data.js("merchant_state.json")[code]
        declared_days = np.arange(D) < state["ready_h"] // 24
    res = RS.delta_reserve(H.cnt.to_numpy(), H.amt.to_numpy(), H.fp_amt.to_numpy(), H.E.to_numpy(), float(r.avg_ticket),
                           H.cohort_lift_day.to_numpy()[::24], float(r.sigma), H.level_auto.to_numpy(), data.meta()["config"]["costs"],
                           declared_days=declared_days)
    dd = res.iloc[day * 24:(day + 1) * 24]
    due, held = float(dd.amount.sum()), float(dd.held.sum())
    is_front = r.truth == "front"
    released = 0.0 if is_front else held
    with c2:
        C.kpi_row([("Due to merchant", f"₹{due:,.0f}", "pay-ins that day"), ("Settled on time (T+1)", f"₹{due - held:,.0f}", ""),
                   ("Held surplus", f"₹{held:,.0f}", "fingerprinted, above Tolerated"),
                   ("Released after review", f"₹{released:,.0f}", "analyst dismissed" if not is_front else "stays held: case open")])
        x = [f"{int(hh) % 24:02d}" for hh in dd.hour]
        fig = go.Figure([go.Bar(x=x, y=dd.settled_on_time, name="Settles on time", marker_color=JADE),
                         go.Bar(x=x, y=dd.held, name="Held", marker_color=DARK),
                         go.Scatter(x=x, y=dd.tolerated, name="Tolerated", line=dict(color=NEON, width=3, shape="hv"))])
        fig.update_layout(barmode="stack", height=320, title=f"Batch for {data.hour_label(day * 24, '%d %b')}: ₹ per hour", xaxis_title="Hour of day")
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    C.note("Tolerated per day = baseline × exp(cohort lift + 3σ); only fingerprinted payments above it are held, and only once the case is at L3 "
           "before the batch is cut. New merchants are judged hour by hour against their declared business hours until they have 30 days of history. "
           "Try Lakshmi Sweets on 20 Oct (Diwali): ₹0 held.")
_ = (GREY_DARK, MINT)
