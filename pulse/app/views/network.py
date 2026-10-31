"""Network: the S5 shell and the banned front; the E2 ring."""
import plotly.graph_objects as go
import streamlit as st

from ui import components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY, GREY_DARK, JADE, MINT, NEON

net = data.js("network.json")
s5 = net["s5_card"]
wk = net["worked_example"]
C.title("Network: same bettors, new front", simulated=True,
        sub="A brand-new 'IT services' shell (S5) is onboarded two days after a betting front is banned. Its first payers give it away.")

c1, c2 = st.columns([3, 2])
with c1:
    ego = net["ego"]
    pos = {n["id"]: n for n in ego["nodes"]}
    ex, ey = [], []
    for e in ego["edges"]:
        a, b = pos[e["a"]], pos[e["b"]]
        ex += [a["x"], b["x"], None]
        ey += [a["y"], b["y"], None]
    fig = go.Figure(go.Scatter(x=ex, y=ey, mode="lines", line=dict(color=GREY, width=1), hoverinfo="skip", showlegend=False))
    style = {"s5": (DARK, 34, "square", "S5 shell (new)"), "banned": (DARK_SOFT, 34, "x", "Banned front"),
             "context": (MINT, 18, "square", "Other merchants they use"), "shared": (NEON, 13, "circle", "Payer: also a bettor of the banned front"),
             "other": (JADE, 11, "circle", "Payer: no link")}
    for role, (col, size, sym, name) in style.items():
        ns = [n for n in ego["nodes"] if n["role"] == role]
        if not ns:
            continue
        fig.add_trace(go.Scatter(x=[n["x"] for n in ns], y=[n["y"] for n in ns], mode="markers+text" if role in ("s5", "banned") else "markers",
                                 marker=dict(color=col, size=size, symbol=sym, line=dict(color=DARK, width=1)), name=name,
                                 text=[n["label"] for n in ns] if role in ("s5", "banned") else None, textposition="top center",
                                 hovertext=[n["label"] for n in ns], hoverinfo="text"))
    fig.update_xaxes(visible=False)
    fig.update_yaxes(visible=False)
    fig.update_layout(height=520, title="S5's first 20 payers on day one", legend=dict(orientation="h", y=-0.05), plot_bgcolor="#fff")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
with c2:
    st.markdown("#### Expected vs observed")
    C.kpi_row([("Observed shared", f"{s5['k']} of {s5['n']}", "first payers who also paid the banned front"),
               ("Expected by chance", f"{s5['expected']:.2f}", f"n × K ÷ N = {s5['n']} × {s5['K']:,} ÷ {s5['N']:,}")])
    st.write("")
    C.kpi_row([("Hypergeometric p", f"10^{s5['log10_p']:.1f}", "P(X ≥ k), simulation pool"),
               ("Deck worked example", f"{wk['expected']:.3f}", f"{wk['n']} × {wk['K']:,} ÷ {wk['N']:,} payers")], light=True)
    st.write("")
    C.card("How to read it",
           f"<div class='muted'>In a regional pool of 5 million payers, a merchant's first 20 payers would share about "
           f"{wk['expected']:.3f} payers with a 2,000-bettor front by chance. Our simulated region has {s5['N']:,} payers, so chance gives "
           f"{s5['expected']:.2f}. Observing {s5['k']} or more has probability about 10^{s5['log10_p']:.0f}. S5 also shares a device ID with the banned front "
           "(a hard link). The drift engine corroborates on day one: evening ₹500–₹2,000 personal payments do not look like a declared "
           "IT-services business.</div>")

st.markdown("#### E2: a betting ring split across ten small fronts")
ring = net["ring"]
pos = {n["id"]: n for n in ring["nodes"]}
fig = go.Figure()
MIN_B = st.slider("Show links with at least this many shared known bettors", 1, 60, 15)
mx = max([e["shared_bettors"] for e in ring["edges"]] + [1])
for e in [e for e in ring["edges"] if e["shared_bettors"] >= MIN_B]:
    a, b = pos[e["a"]], pos[e["b"]]
    w = e["shared_bettors"]
    fig.add_trace(go.Scatter(x=[a["x"], b["x"]], y=[a["y"], b["y"]], mode="lines", hoverinfo="text",
                             hovertext=f"{a['label']} ↔ {b['label']}: {e['shared']} shared payers, {w} known bettors",
                             line=dict(color=JADE if w > 0 else GREY, width=1 + 7 * w / mx), showlegend=False, opacity=0.8))
for h in ring["hard_links"]:
    a, b = pos[h["a"]], pos[h["b"]]
    fig.add_trace(go.Scatter(x=[a["x"], b["x"]], y=[a["y"], b["y"]], mode="lines", line=dict(color=NEON, width=3, dash="dot"),
                             hoverinfo="skip", showlegend=False))
style = {"ring": (DARK, "Ring front (E2)"), "banned": (DARK_SOFT, "Banned front"), "s5": (EMERALD, "S5 shell"), "honest": (GREY_DARK, "Honest merchant")}
for role, (col, name) in style.items():
    ns = [n for n in ring["nodes"] if n["role"] == role]
    fig.add_trace(go.Scatter(x=[n["x"] for n in ns], y=[n["y"] for n in ns], name=name,
                             marker=dict(color=col, size=[12 + n["payers"] ** 0.5 / 2 for n in ns], line=dict(color="#fff", width=1)),
                             mode="markers+text", text=[n["label"].split(" (")[0].replace("ring member ", "#") for n in ns],
                             textposition="top center", textfont=dict(size=10),
                             hovertext=[f"{n['label']} · {n['payers']} payers" for n in ns], hoverinfo="text"))
fig.update_xaxes(visible=False)
fig.update_yaxes(visible=False)
fig.update_layout(height=470, title="Merchants linked by shared bettors (edge width) and shared device IDs (dotted)", plot_bgcolor="#fff",
                  legend=dict(orientation="h", y=-0.05))
st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
card = {r["id"]: r for r in data.js("eval/scenario_scorecard.json")}
C.note(f"E2 result (simulated): {card['E2']['actual']}. Honest merchants share ordinary local payers with each other, but almost no known bettors.")
