"""Try to fool PULSE: the judge plays the fraudster; the real engines judge them."""
import sys

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ui import components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY, GREY_DARK, JADE, LEVEL_COLORS, MINT, NEON

sys.path.insert(0, str(data.ROOT))
from pulse import minisim as MS  # noqa: E402

C.title("Try to fool PULSE", simulated=True,
        sub="You run the front. Choose how you launder bets through a bakery; PULSE's four engines judge your 60 days in about a second. "
            "Same engine code as the full pipeline, on a fresh seeded world: your shop plus 20 peers.")


@st.cache_data(show_spinner="Running the four engines on your 60 days…", max_entries=64)
def run(sc: MS.Scenario):
    r = MS.run_scenario(sc)
    r.pop("scenario")
    return r


DEFAULTS = {"bet": 150_000, "mode": "Overnight takeover", "ramp": 10, "round": True, "match": True, "payouts": "Refunds to bettors",
            "known": 30, "diwali": False, "sportsbar": False, "newshell": False}
PRESET_UI = {
    "Honest bakery": {**DEFAULTS, "mode": "No betting"},
    "Diwali rush": {**DEFAULTS, "mode": "No betting", "diwali": True},
    "Sports bar": {**DEFAULTS, "mode": "No betting", "sportsbar": True},
    "Overnight takeover": DEFAULTS,
    "Slow ramp": {**DEFAULTS, "mode": "Slow ramp", "ramp": 10},
    "New shell": {**DEFAULTS, "bet": 60_000, "known": 60, "newshell": True},
    "Careful front": {**DEFAULTS, "bet": 25_000, "round": False, "match": False, "payouts": "Off-platform (cash, other apps)", "known": 0},
}
for k, v in DEFAULTS.items():
    st.session_state.setdefault(f"sbx_{k}", v)
st.session_state.setdefault("sbx_preset", "Overnight takeover")


def apply_preset():
    for k, v in PRESET_UI[st.session_state.sbx_preset].items():
        st.session_state[f"sbx_{k}"] = v


left, right = st.columns([1, 2.4], gap="large")
with left:
    st.selectbox("Start from a preset", list(PRESET_UI), key="sbx_preset", on_change=apply_preset)
    st.markdown("<div class='nav-group' style='margin-left:0'>Your laundering plan</div>", unsafe_allow_html=True)
    mode = st.radio("How you take over", ["No betting", "Overnight takeover", "Slow ramp"], key="sbx_mode", horizontal=False)
    bet = st.slider("Betting money per day (₹)", 0, 300_000, step=5_000, key="sbx_bet", disabled=mode == "No betting", format="%d")
    ramp = st.slider("Ramp speed (% of full volume added per week)", 5, 50, step=5, key="sbx_ramp", disabled=mode != "Slow ramp")
    rnd = st.toggle("Use round stakes (₹500, ₹1,000…)", key="sbx_round", disabled=mode == "No betting")
    match = st.toggle("Only take bets on match nights", key="sbx_match", disabled=mode == "No betting")
    payouts = st.radio("How winners get paid", ["Refunds to bettors", "Off-platform (cash, other apps)", "Not at all"], key="sbx_payouts",
                       disabled=mode == "No betting")
    known = st.slider("Bettors reused from a known (banned) front (%)", 0, 100, step=10, key="sbx_known", disabled=mode == "No betting")
    st.markdown("<div class='nav-group' style='margin-left:0'>False-alarm tests</div>", unsafe_allow_html=True)
    diwali = st.toggle("Diwali week (every bakery ×4–5 on the peak evening)", key="sbx_diwali")
    sportsbar = st.toggle("This shop is a sports bar (busy every match night)", key="sbx_sportsbar")
    newshell = st.toggle("Brand-new 'IT services' shell instead of a bakery", key="sbx_newshell", disabled=mode == "No betting")

fraud = MS.Fraud(bet_inr_per_day=float(bet) if mode != "No betting" else 0.0,
                 mode={"No betting": "none", "Overnight takeover": "overnight", "Slow ramp": "ramp"}[mode],
                 start_day=40 if newshell else (31 if mode == "Slow ramp" else 35), ramp_per_week=ramp / 100, round_amounts=rnd, match_only=match,
                 payouts={"Refunds to bettors": "refunds", "Off-platform (cash, other apps)": "offplatform", "Not at all": "none"}[payouts],
                 known_front_share=known / 100)
sc = MS.Scenario(category="sports_bar" if sportsbar and not newshell else "bakery", diwali=diwali, new_shell=newshell and mode != "No betting", fraud=fraud)
r = run(sc)
d = r["days"]
act = d[d.active]
with right:
    is_front = r["truth"] == "front"
    if r["first_flag_day"] is None:
        if is_front:
            st.markdown(f"<div class='verdict bad'><b>You got through.</b> PULSE never reached Review in 60 days. ₹{r['escaped']:,.0f} of betting money settled out. That's a real blind spot; see below.</div>",
                        unsafe_allow_html=True)
        else:
            why = ("the whole bakery cohort spiked together on Diwali, so the peer gap stayed near zero and Tolerated rose with the market"
                   if diwali else "busy match nights are normal for a sports bar: payers are local regulars and nobody is paid back"
                   if sportsbar else "the shop kept to its own pattern of life: its hours, bill sizes and regulars")
            st.markdown(f"<div class='verdict ok'><b>No action, and here's why:</b> {why}. Highest level: L{r['max_level']} ({MS.band_of(r['max_level'])}).</div>",
                        unsafe_allow_html=True)
    else:
        lag = r["first_flag_day"] - (r["first_bet_day"] or 0)
        hold = (f"first money held on day {r['first_hold_day'] + 1}" if r["first_hold_day"] is not None else "no money held")
        st.markdown(f"<div class='verdict caught'><b>Caught.</b> Betting started on day {r['first_bet_day'] + 1}; PULSE reached Review/Act on day "
                    f"{r['first_flag_day'] + 1} ({'same day' if lag == 0 else f'{lag} day' + ('s' if lag > 1 else '') + ' later'}); {hold}.</div>",
                    unsafe_allow_html=True)
    lk = lambda v: f"₹{v / 1e5:.1f} lakh" if v >= 1e5 else f"₹{v:,.0f}"  # noqa: E731
    C.kpi_row([("Highest band", MS.band_of(r["max_level"]), f"L{r['max_level']} recommended · L{r['max_level_auto']} automatic"),
               ("Betting money", lk(r["betting_total"]), "over the 60 days")])
    st.write("")
    C.kpi_row([("Held before settlement", lk(r["held_total"]), "fingerprinted surplus only"),
               ("Escaped", lk(r["escaped"]), f"{lk(r['escaped_before_flag'])} settled before the first hold")])
    x = d.day
    fig = make_subplots(rows=3, cols=1, shared_xaxes=True, row_heights=[0.5, 0.32, 0.18], vertical_spacing=0.06,
                        subplot_titles=("Money per day (₹): your shop's sales vs betting", "Which engines fired (each row is one engine)", "Ladder level"))
    fig.add_trace(go.Bar(x=x, y=d.inr - d.betting_inr, name="Normal sales", marker_color=JADE), row=1, col=1)
    fig.add_trace(go.Bar(x=x, y=d.betting_inr, name="Betting money", marker_color=DARK), row=1, col=1)
    fig.add_trace(go.Scatter(x=x, y=d.held, name="Held", mode="lines+markers", line=dict(color=NEON, width=3), marker=dict(size=6)), row=1, col=1)
    for k, (col, lab) in enumerate([("drift", "Drift"), ("peers", "Peers"), ("invariants", "Invariants"), ("graph", "Graph")]):
        on = d[col].to_numpy() & d.active.to_numpy()
        fig.add_trace(go.Scatter(x=x[on], y=[lab] * int(on.sum()), mode="markers", marker=dict(symbol="square", size=11, color=[MINT, EMERALD, JADE, DARK_SOFT][k]),
                                 name=lab, showlegend=False, hovertemplate="day %{x}: " + lab + " fired<extra></extra>"), row=2, col=1)
    fig.add_trace(go.Bar(x=x, y=np.ones(len(d)), marker_color=[LEVEL_COLORS[int(v)] if a else "#C9D2D3" for v, a in zip(d.level, d.active)],
                         hovertext=[f"day {a}: L{b} ({MS.band_of(b)})" for a, b in zip(d.day, d.level)], hoverinfo="text", showlegend=False), row=3, col=1)
    fig.add_vrect(x0=0.5, x1=MS.ANCHOR_DAYS + 0.5, fillcolor=GREY, opacity=0.35, line_width=0, row=1, col=1)
    fig.add_annotation(x=MS.ANCHOR_DAYS / 2, y=1, yref="y domain", text="days 1–30: PULSE learns this shop (frozen anchor)", showarrow=False,
                       font=dict(size=11, color=GREY_DARK), row=1, col=1)
    if r["diwali_days"]:
        fig.add_vrect(x0=r["diwali_days"][0] + 0.5, x1=r["diwali_days"][1] + 1.5, fillcolor=NEON, opacity=0.12, line_width=0, row=1, col=1)
    fig.update_yaxes(visible=False, row=3, col=1)
    fig.update_yaxes(categoryorder="array", categoryarray=["Graph", "Invariants", "Peers", "Drift"], row=2, col=1)
    fig.update_layout(barmode="stack", height=560, legend=dict(y=1.08), margin=dict(t=80))
    fig.update_xaxes(title_text="Day", row=3, col=1)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    if r["reasons"]:
        st.markdown(f"#### Why PULSE acted (at {'the first flag' if r['first_flag_hour'] is not None else 'its highest score'}, day {r['reason_hour'] // 24 + 1})")
        C.reason_cards(r["reasons"])
    if is_front and (fraud.payouts != "refunds" or not fraud.match_only or not fraud.round_amounts):
        gaps = []
        if fraud.payouts != "refunds":
            gaps.append("winners paid off-platform leave no refund loop on PayU. **Consented bank data** (Earned Trust tier 2) would show settlements swept to many individuals within hours")
        if not fraud.match_only:
            gaps.append("spreading bets over every evening weakens the match clock; the late-hours drift and new distant payers still show")
        if not fraud.round_amounts:
            gaps.append("irregular stakes remove the round-amount signal, nothing more")
        st.markdown("<div class='reason' style='border-left-color:#4F6668'><div class='eng' style='color:#4F6668'>Blind spots this plan exploits</div>"
                    + "<br>".join("• " + g.replace("**", "") for g in gaps) + "</div>", unsafe_allow_html=True)
    C.note(f"Run time {r['seconds']:.2f} s on this machine (engines {r['engine_seconds']:.2f} s). The day-one expert scorecard decides here (the learned "
           f"model is trained on the full city); two engines must agree before Review. 20 peers and {MS.SANDBOX_PLACEBOS} placebo calendars "
           "(the full pipeline uses 1,000). Seeded, so the same plan always gives the same answer.")
_ = (GREY_DARK,)
