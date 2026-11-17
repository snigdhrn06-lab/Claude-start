"""Live feed: a mini city played forward in accelerated time, scored by the real engines."""
import sys
import time

import numpy as np
import pandas as pd
import streamlit as st

from ui import components as C, data
from ui.theme import DARK, GREY, JADE, NEON

sys.path.insert(0, str(data.ROOT))
from pulse import minisim as MS  # noqa: E402

C.title("Live feed", simulated=True,
        sub="A 24-merchant mini city plays forward at 1 simulated hour every 2 seconds. Every tile is scored by the same four engines as the "
            "full pipeline, using only payments up to the current hour. Inject a takeover or trigger Diwali and watch what happens.")


@st.cache_resource(show_spinner="Simulating the city and scoring every merchant-hour…", max_entries=16)
def city(takeover, diwali_start):
    c = MS.run_city(takeover=takeover, diwali_start=diwali_start)
    w, S, cal = c["world"], c["S"], c["cal"]
    pay = w["payments"]
    lvl = S["lad"]["level"]
    return {"pay": pay[pay.kind == 0][["merchant_id", "t_min", "amount", "payer_city", "channel"]].reset_index(drop=True),
            "names": w["merchants"].name.tolist()[: len(MS.CITY)], "cats": w["merchants"].category.tolist()[: len(MS.CITY)],
            "level": lvl[: len(MS.CITY)], "engines": S["F"]["n_engines"][: len(MS.CITY)], "seconds": S["seconds"],
            "n_pay": int((pay.kind == 0).sum()), "start": cal.start}


ss = st.session_state
ss.setdefault("live_h", 31 * 24 + 8)
ss.setdefault("live_play", False)
ss.setdefault("live_takeover", None)
ss.setdefault("live_diwali", None)
ss.setdefault("live_speed", 1)
H_END = MS.DAYS * 24 - 1

c1, c2, c3, c4 = st.columns([1.1, 1.1, 2.2, 1.6])
if c1.button("❚❚ Pause" if ss.live_play else "▶ Play", use_container_width=True, type="primary"):
    ss.live_play = not ss.live_play
    st.rerun()
ss.live_speed = c2.selectbox("Speed", [1, 3, 6], index=[1, 3, 6].index(ss.live_speed), format_func=lambda v: f"{v} sim h / 2 s",
                             label_visibility="collapsed")
with c3:
    pick = st.selectbox("Merchant to take over", list(range(len(MS.CITY))), index=3, format_func=lambda i: MS.CITY[i][1], label_visibility="collapsed")
with c4:
    if st.button("Inject takeover now", use_container_width=True, disabled=ss.live_takeover is not None):
        ss.live_takeover = (int(pick), int(ss.live_h // 24))
        st.rerun()
d1, d2, d3 = st.columns([1.6, 1.1, 3.3])
if d1.button("Trigger Diwali now", use_container_width=True, disabled=ss.live_diwali is not None):
    ss.live_diwali = int(min(ss.live_h // 24, MS.DAYS - 5))
    st.rerun()
if d2.button("Reset feed", use_container_width=True):
    for k in ["live_h", "live_play", "live_takeover", "live_diwali"]:
        ss.pop(k, None)
    st.rerun()
events = []
if ss.live_takeover:
    nxt = min([d for d in MS.MATCH_DAYS if d >= ss.live_takeover[1]] or [MS.DAYS])
    events.append(f"Takeover injected on <b>{MS.CITY[ss.live_takeover[0]][1]}</b> on day {ss.live_takeover[1] + 1}; bets start at the next match night (day {nxt + 1}, 19:00).")
if ss.live_diwali is not None:
    events.append(f"Diwali triggered from day {ss.live_diwali + 1}: every bakery and sweet shop lifts together.")
d3.markdown("<div class='muted' style='padding-top:8px'>" + ("<br>".join(events) or "No events yet. Bets only start on match nights.") + "</div>",
            unsafe_allow_html=True)

CT = city(ss.live_takeover, ss.live_diwali)


@st.fragment(run_every=2 if ss.live_play else None)
def board():
    if ss.live_play:
        ss.live_h = min(H_END, ss.live_h + ss.live_speed)
        if ss.live_h >= H_END:
            ss.live_play = False
    h = ss.live_h
    t0 = time.perf_counter()
    now = CT["start"] + pd.Timedelta(hours=h)
    pay = CT["pay"]
    upto = pay.t_min.to_numpy() < (h + 1) * 60
    lvl = CT["level"][:, h]
    alerts = [(i, int(np.argmax(CT["level"][i, :h + 1] >= 2))) for i in range(len(CT["names"])) if (CT["level"][i, :h + 1] >= 2).any()]
    days_live = max(1.0, (h - 31 * 24) / 24)
    C.kpi_row([("Simulated clock", now.strftime("%a %d %b · %H:00"), f"day {h // 24 + 1} of {MS.DAYS}"),
               ("Payments scored", f"{int(upto.sum()):,}", "since day 1 (days 1–30 build each shop's anchor)"),
               ("Alerts raised", f"{len(alerts)}", f"{len(alerts) / days_live:.2f} per analyst per day (1 analyst)"),
               ("Scoring time per payment", f"{CT['seconds'] / max(CT['n_pay'], 1) * 1e6:.0f} µs", "measured on this machine, all four engines")])
    left, right = st.columns([2.2, 1])
    with left:
        st.markdown("#### Merchant risk tiles")
        cols = st.columns(6)
        for i, name in enumerate(CT["names"]):
            L = int(lvl[i])
            band = MS.band_of(L)
            bg, fg = {"Watch": ("#fff", DARK), "Review": ("#62CAC3", DARK), "Act": (DARK, NEON)}[band]
            cols[i % 6].markdown(f"<div class='rtile' style='background:{bg};color:{fg}'><div class='rn'>{name}</div>"
                                 f"<div class='rb'>{band}</div><div class='re'>L{L} · {int(CT['engines'][i, h])} engine{'s' if CT['engines'][i, h] != 1 else ''}</div></div>",
                                 unsafe_allow_html=True)
        st.markdown("#### Payments in the last simulated hour")
        last = pay[(pay.t_min >= h * 60) & (pay.t_min < (h + 1) * 60)].sort_values("t_min").tail(10).iloc[::-1].copy()
        if len(last):
            last["time"] = [(CT["start"] + pd.Timedelta(minutes=int(t))).strftime("%H:%M") for t in last.t_min]
            last["merchant"] = [CT["names"][i] for i in last.merchant_id]
            last["amount"] = [f"₹{a:,}" for a in last.amount]
            C.html_table(last.iloc[::-1].to_dict("records"), [("time", "Time"), ("merchant", "Merchant"), ("amount", "Amount"),
                                                            ("payer_city", "Payer city"), ("channel", "Channel")])
        else:
            st.markdown("<div class='muted'>No payments this hour (most shops are closed at night).</div>", unsafe_allow_html=True)
    with right:
        st.markdown("#### Alert queue")
        if not alerts:
            st.markdown("<div class='muted'>Empty. Honest shops stay at Watch.</div>", unsafe_allow_html=True)
        for i, first in sorted(alerts, key=lambda a: -CT["level"][a[0], h]):
            when = (CT["start"] + pd.Timedelta(hours=first)).strftime("%d %b %H:00")
            st.markdown(f"<div class='reason'><div class='eng'>{MS.band_of(int(CT['level'][i, h]))} now · first alert {when}</div>"
                        f"<b>{CT['names'][i]}</b> · L{int(CT['level'][i, h])}</div>", unsafe_allow_html=True)
        C.note(f"Board rendered in {(time.perf_counter() - t0) * 1000:.0f} ms.")


board()
C.note("The city is simulated once per set of events (about 1.5 s) and then played back hour by hour; every state shown at an hour uses only payments "
       "up to that hour (trailing windows), so the replay is exactly what a live scorer would have shown. The day-one expert scorecard decides here.")
_ = (GREY, JADE)
