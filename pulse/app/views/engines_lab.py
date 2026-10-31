"""Engines lab: per-engine deep dives with adjustable thresholds over cached arrays."""
import sys

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from scipy.stats import hypergeom, norm

from ui import charts, components as C, data
from ui.theme import DARK, DARK_SOFT, EMERALD, GREY_DARK, JADE, MINT, NEON

sys.path.insert(0, str(data.ROOT))
from pulse.engines.invariants import match_beta, placebo_shifts  # noqa: E402

C.title("Engines lab", simulated=True, sub="Each engine in detail. Sliders recompute on cached arrays; nothing here retrains the model.")
meta = data.meta()
cfg = meta["config"]
M = data.merchants()
A = data.lab_arrays()
lab = data.js("eval/engines_lab.json")


@st.cache_data(show_spinner=False)
def front_post_mask():
    H = A["active"].shape[1]
    t = M.sort_values("merchant_id").takeover_t_min.fillna(1e12).to_numpy() // 60
    fr = M.sort_values("merchant_id").truth.isin(["front", "banned_front"]).to_numpy()
    return fr[:, None] & (np.arange(H)[None, :] >= t[:, None]) & A["active"]


tabs = st.tabs(["1 · Drift", "2 · Peers", "3 · Betting invariants", "4 · Network graph"])

# ---------------------------------------------------------------- drift
with tabs[0]:
    c1, c2 = st.columns([3, 1])
    focus = ["HERO", "HERO_TWIN", "S1_SWEETS", "S2_SPORTSBAR", "S4", "S5", "E1", "E3"]
    code = c2.selectbox("Merchant", focus, format_func=lambda c: M[M.code == c].iloc[0]["name"])
    thr = c2.slider("Fire threshold (cohort-adjusted drift)", 0.2, 0.9, float(cfg["engines"]["drift"]["fire_threshold"]), 0.05)
    hh = data.hourly(code)
    sl = slice(23, None, 24)
    x = [data.date_of_hour(h) for h in hh.hour[sl]]
    fig = go.Figure()
    for k, nm, col in [("js_24h", "JS hours (24 h)", MINT), ("js_7d", "JS hour-of-week (7 d)", EMERALD), ("js_declared", "JS vs declared profile", JADE),
                       ("wasserstein", "Wasserstein log-amount", GREY_DARK), ("round_excess", "Round-amount excess", NEON)]:
        fig.add_trace(go.Scatter(x=x, y=hh[k].to_numpy()[sl], name=nm, line=dict(color=col, width=2)))
    fig.add_trace(go.Scatter(x=x, y=hh.drift_adj.to_numpy()[sl], name="Drift score (cohort-adjusted)", line=dict(color=DARK, width=3)))
    fig.add_hline(y=thr, line_dash="dash", line_color=DARK, annotation_text="threshold", annotation_position="top left")
    fig.update_layout(height=420, title="Drift components at the end of each day", yaxis_range=[0, 1.05], legend=dict(y=1.02),
                      margin=dict(t=120))
    c1.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    da = A["drift_adj"].astype(np.float32)
    act = A["active"]
    hon = A["honest"][:, None] & act
    fp = front_post_mask()
    c2.markdown(C.kpi("Honest merchant-hours firing", f"{100 * ((da >= thr) & hon).sum() / hon.sum():.2f}%", "all honest merchants", light=True),
                unsafe_allow_html=True)
    c2.markdown(C.kpi("Front hours firing (after takeover)", f"{100 * ((da >= thr) & fp).sum() / fp.sum():.1f}%", "", light=True), unsafe_allow_html=True)
    C.note("Frozen anchor = first 30 eligible days, never updated by flagged days; rolling baseline = 30 days lagged by 7, excluding "
           "flagged days; the score takes the max drift against either, plus drift from the KYB-declared profile. CUSUM k = 0.5, h = 5. "
           "The score is cohort-adjusted: the peer group's median drift at the same hour is subtracted, so a festival that moves everyone does not count.")

# ---------------------------------------------------------------- peers
with tabs[1]:
    st.markdown("#### Why a naive peer z-score floods analysts")
    p3 = norm.sf(3)
    c1, c2, c3 = st.columns(3)
    c1.markdown(C.kpi("P(z > 3), normal tail", f"{100 * p3:.3f}%", "one-sided"), unsafe_allow_html=True)
    c2.markdown(C.kpi("Merchant-hours per hour", "1,000,000", "illustrative scale"), unsafe_allow_html=True)
    c3.markdown(C.kpi("Naive alarms per hour", f"{p3 * 1e6:,.0f}", "if every z > 3 raised an alarm"), unsafe_allow_html=True)
    st.write("")
    st.markdown("#### Measured on honest simulated merchants: what persistence and corroboration remove")
    s1, s2 = st.columns([1, 3])
    zt = s1.slider("z threshold", 2.0, 5.0, float(cfg["engines"]["peers"]["z_threshold"]), 0.25)
    pk = s1.slider("Persistence: windows over threshold (of last 6)", 1, 6, int(cfg["engines"]["peers"]["persist_k"]))
    z = A["peer_z"].astype(np.float32)
    act = A["active"]
    hon = A["honest"][:, None] & act
    over = (z > zt) & act
    c = np.cumsum(np.concatenate([np.zeros((over.shape[0], 1)), over], axis=1), axis=1)
    n = 6
    pers = np.empty(over.shape)
    pers[:, n:] = c[:, n + 1:] - c[:, 1:-n]
    pers[:, :n] = c[:, 1:n + 1]
    fire = over & (pers >= pk)
    other = A["drift_fire"] | A["invariants_fire"] | A["graph_fire"]
    mh = hon.sum()
    vals = [p3 * 1e6, (over & hon).sum() / mh * 1e6, (fire & hon).sum() / mh * 1e6, (fire & other & hon).sum() / mh * 1e6]
    labels = ["Normal-tail theory", f"Measured z > {zt:g}", f"+ persistence ({pk} of 6)", "+ a second engine fires"]
    fig = go.Figure(go.Bar(x=vals, y=labels, orientation="h", marker_color=[GREY_DARK, MINT, JADE, DARK],
                           text=[f"{v:,.0f}" for v in vals], textposition="outside"))
    fig.update_layout(height=300, title=f"Alarms per million honest merchant-hours ({mh:,} measured)", xaxis_title="Alarms per 1,000,000 merchant-hours",
                      yaxis=dict(autorange="reversed"), margin=dict(l=210))
    s2.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    fp = front_post_mask()
    C.note(f"At these settings the peer engine fires on {100 * (fire & fp).sum() / fp.sum():.1f}% of front hours after takeover. "
           "Lift = log(actual ÷ expected) per trailing 24 h; gap = lift − median peer lift; robust z = gap ÷ (1.4826 × MAD of peer gaps). "
           "Peer groups: category and city, HDBSCAN on baseline size, falling back to category × size band.")

# ---------------------------------------------------------------- invariants
with tabs[2]:
    c1, c2 = st.columns([1, 3])
    code = c1.selectbox("Merchant ", ["HERO", "S2_SPORTSBAR", "E3", "HERO_TWIN"], format_func=lambda c: M[M.code == c].iloc[0]["name"])
    hh = data.hourly(code)
    r = M[M.code == code].iloc[0]
    default_h = int(r.first_l2_h) if r.first_l2_h >= 0 else int(hh.match_beta.idxmax())
    h = c1.number_input("Hour index", 0, len(hh) - 1, default_h, help="Hour in the 162-day grid")
    c1.markdown(f"<div class='muted'>{data.hour_label(h)}</div>", unsafe_allow_html=True)
    live = np.array(meta["live_hour"], np.float32)
    mc = cfg["engines"]["invariants"]["match_clock"]
    w = mc["window_hours"]
    y = hh.cnt.to_numpy().astype(np.float32)
    e = hh.E.to_numpy().astype(np.float32) + 0.02
    lo = max(0, h + 1 - w)
    Y, Ev = y[lo:h + 1].sum(), e[lo:h + 1].sum()
    b = match_beta((y * live)[lo:h + 1].sum(), (e * live)[lo:h + 1].sum(), Y - (y * live)[lo:h + 1].sum(), Ev - (e * live)[lo:h + 1].sum())
    shifts = placebo_shifts(len(hh), mc["n_placebo"], mc["min_shift_hours"], cfg["settings"]["seed"])
    Lp = np.stack([np.roll(live, s) for s in shifts])[:, lo:h + 1]
    y1, e1 = (Lp * y[lo:h + 1]).sum(axis=1), (Lp * e[lo:h + 1]).sum(axis=1)
    bp = match_beta(y1, e1, Y - y1, Ev - e1)
    pv = float((bp >= b).mean())
    fig = go.Figure(go.Histogram(x=bp, nbinsx=50, marker_color=MINT, name="Placebo β (1,000 shifted calendars)"))
    fig.add_vline(x=b, line_color=DARK, line_width=4, annotation_text=f"real β = {b:.2f}", annotation_position="top")
    fig.update_layout(height=320, title=f"Match clock: placebo p = {pv:.3f}", xaxis_title="β (log rate ratio in live-match hours)", yaxis_title="count")
    c2.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    k1, k2, k3, k4 = st.columns(4)
    k1.markdown(C.kpi("Loop ratio |A∩B| ÷ |B|", f"{hh.loop_ratio.iloc[h]:.2f}", "payout recipients who paid in (7 d)", light=True), unsafe_allow_html=True)
    k2.markdown(C.kpi("Refunds with no matching order", f"{100 * hh.unmatched_share.iloc[h]:.0f}%", "amount never paid by that payer", light=True), unsafe_allow_html=True)
    k3.markdown(C.kpi("Payouts ÷ pay-ins (₹, 7 d)", f"{hh.payout_ratio.iloc[h]:.2f}", "", light=True), unsafe_allow_html=True)
    k4.markdown(C.kpi("New distant payers (excess)", f"{100 * hh.distant_excess_24h.iloc[h]:.0f} pts", "vs its baseline share", light=True), unsafe_allow_html=True)
    C.note("Poisson GLM with an hour-of-week offset and a live-match indicator has a closed-form β = log((Y₁/E₁)/(Y₀/E₀)). "
           "Sports bars show β > 0 too, so the match clock fires only with new distant payers; the loop needs payouts to earlier payers "
           "whose amounts match no order. Placebo tests are computed live here; in the pipeline they run where β ≥ 0.5.")

# ---------------------------------------------------------------- graph
with tabs[3]:
    net = data.js("network.json")
    s5 = net["s5_card"]
    c1, c2 = st.columns([1, 2])
    N = c1.number_input("Payer pool N", 1000, 10_000_000, int(s5["N"]), step=1000)
    K = c1.number_input("Banned front's bettors K", 1, 100_000, int(s5["K"]))
    n = c1.number_input("Merchant's payers n", 1, 10_000, int(s5["n"]))
    k = c1.number_input("Shared payers observed k", 0, 10_000, int(s5["k"]))
    ex = n * K / N
    pv = float(hypergeom.sf(k - 1, N, K, n)) if k > 0 else 1.0
    with c2:
        C.kpi_row([("Expected by chance", f"{ex:.3f}", "n × K ÷ N"), ("Observed", f"{k}", ""), ("Hypergeometric tail p", f"{pv:.1e}", "P(X ≥ k)")])
        st.write("")
        st.markdown(f"Defaults are the simulated S5 case. In the deck's worked example (N = 5,000,000, K = 2,000, n = 20) chance gives "
                    f"**{net['worked_example']['expected']:.3f}** shared payers; in our 50,000-payer simulation it gives **{s5['expected']:.2f}**.")
        C.note("Graph score uses the Bonferroni-adjusted tail across known banned fronts over the trailing 30 days of payers, "
               "plus Adamic–Adar similarity and hard links (shared device, director or settlement account).")
_ = (DARK_SOFT, charts)
