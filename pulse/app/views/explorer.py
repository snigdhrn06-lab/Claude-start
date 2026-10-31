"""Merchant explorer: any merchant or scenario, timeline, engines, ladder, reasons."""
import numpy as np
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ui import charts, components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, JADE, MINT

M = data.merchants()
order = {"S0": 0, "S3": 1, "S1": 2, "S2": 3, "S4": 4, "S5": 5, "E1": 6, "E3": 7, "E2": 8, "BF": 9, "extra": 10, "": 11}
M = M.assign(_o=M.scenario.map(order).fillna(11)).sort_values(["_o", "merchant_id"])


def label(code):
    r = M[M.code == code].iloc[0]
    tag = f"[{r.scenario}] " if r.scenario and r.scenario != "extra" else ""
    return f"{tag}{r['name']} · {r.category.replace('_', ' ')} · {r.split}"


C.title("Merchant explorer", simulated=True, sub="Pick any merchant or scenario. Daily view for everyone; hourly zoom for scenario merchants.")
c0, c1 = st.columns([3, 1])
code = c0.selectbox("Merchant", M.code.tolist(), format_func=label, index=0)
show_truth = c1.toggle("Show simulation truth", value=True, help="Ground truth is known only because the data is simulated.")
r = M[M.code == code].iloc[0]
d = data.daily(int(r.merchant_id))
D = len(d)
x = [data.date_of_hour(k * 24) for k in range(D)]

truth = {"honest": "Honest", "front": "Front (betting)", "banned_front": "Banned seed front"}[r.truth]
C.kpi_row([("Highest level", f"L{int(r.max_level)}", C.LEVEL_NAMES[int(r.max_level)]),
           ("Peak probability", f"{r.max_p:.2f}", "calibrated"),
           ("First L2+", data.hour_label(int(r.first_l2_h), "%d %b %H:00") if r.first_l2_h >= 0 else "never", ""),
           ("Truth" if show_truth else "Data", truth if show_truth else r.data_source,
            (f"takeover {data.hour_label(int(r.takeover_t_min // 60), '%d %b')}" if show_truth and r.takeover_t_min == r.takeover_t_min else r.data_source))])
st.write("")
fig = make_subplots(rows=3, cols=1, shared_xaxes=True, row_heights=[0.45, 0.4, 0.15], vertical_spacing=0.05,
                    subplot_titles=("Payments per day", "Engine scores (daily max)", "Ladder level"))
act = d.active.to_numpy()
fig.add_trace(go.Bar(x=x, y=d.cnt, marker_color=np.where(act, JADE, "#C9D2D3"), name="Payments", showlegend=False), row=1, col=1)
for k, nm, col in [("drift_adj", "Drift", MINT), ("peers_score", "Peers", EMERALD), ("invariants_score", "Invariants", JADE),
                   ("graph_score", "Graph", DARK_SOFT)]:
    fig.add_trace(go.Scatter(x=x, y=d[k], name=nm, line=dict(color=col, width=2)), row=2, col=1)
fig.add_trace(go.Scatter(x=x, y=d.p, name="Calibrated p", line=dict(color=DARK, width=3, dash="dot")), row=2, col=1)
fig.add_trace(charts.level_strip(d.level.to_numpy(), x), row=3, col=1)
if show_truth and r.takeover_t_min == r.takeover_t_min:
    fig.add_vline(x=data.date_of_hour(r.takeover_t_min // 60), line_color=DARK, line_dash="dash")
    fig.add_annotation(x=data.date_of_hour(r.takeover_t_min // 60), y=1.02, yref="paper", text="first bet (truth)", showarrow=False,
                       font=dict(size=11))
fig.update_yaxes(range=[0, 1.05], row=2, col=1)
fig.update_yaxes(visible=False, row=3, col=1)
fig.update_layout(height=560, legend=dict(y=1.08), margin=dict(t=60))
st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
C.note("Grey bars: warm-up days while the frozen anchor baseline is built (not scored).")

c1, c2 = st.columns([1, 1])
with c1:
    st.markdown("#### Reasons")
    rs = data.reasons_for(code, "first_l3") or data.reasons_for(code, "first_l2") or data.reasons_for(code, "peak")
    if rs:
        rr = rs[0]
        st.markdown(f"At **{data.hour_label(rr['hour'])}** ({rr['kind'].replace('_', ' ')}): p = {rr['p']:.2f}, "
                    f"{C.level_chip(rr['level'])}, {rr['n_engines']} engines agree", unsafe_allow_html=True)
        C.reason_cards(rr["reasons"])
with c2:
    st.markdown("#### Merchant facts")
    C.html_table([
        {"k": "Declared category", "v": r.category.replace("_", " ")},
        {"k": "City (tier)", "v": f"{r.city} ({r.tier})"},
        {"k": "Onboarded", "v": data.hour_label(int(r.onboard_day) * 24, "%d %b %Y")},
        {"k": "Peer group", "v": r.peer_group},
        {"k": "Split", "v": r.split + (" (calibration fold)" if r.calibration_fold else "")},
        {"k": "Data", "v": r.data_source},
    ] + ([{"k": "Scenario", "v": r.scenario}] if r.scenario else []), [("k", "Field"), ("v", "Value")])

if r.scenario in ("S0", "S1", "S2", "S3", "S4", "S5", "E1", "E2", "E3", "BF"):
    st.markdown("#### Hourly zoom")
    hh = data.hourly(code)
    nd = len(hh) // 24
    default_day = int(r.first_l2_h // 24) if r.first_l2_h >= 0 else nd // 2
    day = st.slider("Day", 0, nd - 1, int(np.clip(default_day, 1, nd - 2)), format="%d", help="Day index in the 162-day window")
    hrs = np.arange(max(0, day * 24 - 24), min(len(hh), day * 24 + 48))
    f2 = make_subplots(specs=[[{"secondary_y": True}]])
    f2.add_trace(go.Bar(x=charts.ts(hrs), y=hh.cnt.to_numpy()[hrs], name="Payments per hour", marker_color=JADE), secondary_y=False)
    f2.add_trace(go.Scatter(x=charts.ts(hrs), y=hh.p.to_numpy()[hrs], name="Calibrated p", line=dict(color=DARK, width=3)), secondary_y=True)
    f2.add_trace(go.Scatter(x=charts.ts(hrs), y=hh.n_engines.to_numpy()[hrs] / 4, name="Engines firing (÷4)", line=dict(color=EMERALD, dash="dot")),
                 secondary_y=True)
    charts.add_match_bands(f2, hrs[0], hrs[-1], label=False)
    f2.update_yaxes(range=[0, 1.05], secondary_y=True)
    f2.update_layout(height=340, title=f"{data.hour_label(hrs[0], '%d %b')} to {data.hour_label(hrs[-1], '%d %b')} (match windows shaded)")
    st.plotly_chart(f2, use_container_width=True, config={"displayModeBar": False})
