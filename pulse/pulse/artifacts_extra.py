"""Extra artefacts for the app: network views, evidence packs, earned trust, story-mode data."""
from __future__ import annotations

import json

import networkx as nx
import numpy as np
import pandas as pd
from scipy.stats import hypergeom

from . import response as RS
from .calendar import MIN_PER_DAY
from .reasons import inr


def log10_tail(k, N, K, n) -> float:
    """log10 P(X >= k), summed exactly in log space (sf underflows for tiny tails)."""
    from scipy.special import logsumexp

    js = np.arange(k, min(n, K) + 1)
    return float(logsumexp(hypergeom.logpmf(js, N, K, n)) / np.log(10))


def tail(k, N, K, n) -> float:
    return float(10 ** log10_tail(k, N, K, n))


def _w(path, obj):
    from .pipeline import write_json

    write_json(path, obj)


def network_views(world, cal, cfg, F, art):
    mdf, pay = world["merchants"], world["payments"]
    code_i = dict(zip(mdf.code, mdf.merchant_id))
    bf2 = next(b for b in world["banned"] if b["code"] == "BF2")
    s5 = code_i["S5"]
    N = cfg["settings"]["region"]["payer_pool"]
    K = len(bf2["bettors"])
    p5 = pay[(pay.merchant_id == s5) & (pay.kind == 0)].sort_values("t_min")
    first = p5.drop_duplicates("payer_id").head(20)
    firsts = first.payer_id.to_numpy()
    shared = np.isin(firsts, bf2["bettors"])
    k, n = int(shared.sum()), len(firsts)
    sim = {"N": N, "K": K, "n": n, "k": k, "expected": n * K / N, "p_value": tail(k, N, K, n), "log10_p": log10_tail(k, N, K, n)}
    worked = {"N": 5_000_000, "K": 2000, "n": 20, "k": 12, "expected": 20 * 2000 / 5_000_000,
              "p_value": tail(12, 5_000_000, 2000, 20), "log10_p": log10_tail(12, 5_000_000, 2000, 20)}
    # bipartite egonet: S5, BF2, first 20 payers, and other merchants those payers used (top by overlap)
    G = nx.Graph()
    G.add_node(f"M{s5}", kind="merchant", label="S5 shell (new)", role="s5")
    G.add_node(f"M{bf2['merchant_id']}", kind="merchant", label=f"{bf2['name']} (banned)", role="banned")
    for u, sh in zip(firsts, shared):
        G.add_node(f"P{u}", kind="payer", label=f"payer {u}", role="shared" if sh else "other")
        G.add_edge(f"M{s5}", f"P{u}")
        if sh:
            G.add_edge(f"M{bf2['merchant_id']}", f"P{u}")
    others = pay[(pay.payer_id.isin(firsts)) & (pay.kind == 0) & (~pay.merchant_id.isin([s5, bf2["merchant_id"]])) &
                 (pay.t_min < (cfg["scenarios"]["scenarios"]["S5"]["onboard_day"] + 1) * MIN_PER_DAY)]
    top = others.groupby("merchant_id").payer_id.nunique().sort_values(ascending=False).head(6)
    for mid, cnt in top.items():
        r = mdf.iloc[mid]
        G.add_node(f"M{mid}", kind="merchant", label=r["name"], role="context")
        for u in others[others.merchant_id == mid].payer_id.unique():
            G.add_edge(f"M{mid}", f"P{u}")
    pos = nx.spring_layout(G, seed=cfg["settings"]["seed"], k=0.6, iterations=200)
    ego = {"nodes": [{"id": v, **G.nodes[v], "x": float(pos[v][0]), "y": float(pos[v][1])} for v in sorted(G.nodes)],
           "edges": [{"a": a, "b": b} for a, b in sorted(G.edges)]}
    # ring projection: E2 members, BF2, S5 and a few honest merchants; edge weight = shared bettors (whole window)
    ring = mdf[mdf.scenario == "E2"].merchant_id.tolist()
    honest_pick = mdf[(mdf.truth == "honest") & (mdf.category.isin(["kirana", "bakery", "pharmacy"]))].merchant_id.head(6).tolist()
    nodes = ring + [bf2["merchant_id"], s5] + honest_pick
    bettor_set = set(np.concatenate([b["bettors"] for b in world["banned"]]))
    pin = pay[(pay.kind == 0) & pay.merchant_id.isin(nodes)]
    sets = {mid: set(pin[pin.merchant_id == mid].payer_id.unique()) for mid in nodes}
    PG = nx.Graph()
    for mid in nodes:
        r = mdf.iloc[mid]
        role = "ring" if mid in ring else ("banned" if mid == bf2["merchant_id"] else ("s5" if mid == s5 else "honest"))
        PG.add_node(mid, label=r["name"], role=role, payers=len(sets[mid]))
    for a_i, a in enumerate(nodes):
        for b in nodes[a_i + 1:]:
            sh = sets[a] & sets[b]
            shb = len(sh & bettor_set)
            if len(sh) >= 5:
                PG.add_edge(a, b, shared=len(sh), shared_bettors=shb)
    dev = mdf.set_index("merchant_id").device_id
    hard = [(a, b) for a_i, a in enumerate(nodes) for b in nodes[a_i + 1:] if dev[a] == dev[b]]
    pos2 = nx.spring_layout(PG, seed=cfg["settings"]["seed"], weight="shared", k=0.9, iterations=300)
    proj = {"nodes": [{"id": int(v), **PG.nodes[v], "x": float(pos2[v][0]), "y": float(pos2[v][1])} for v in PG.nodes],
            "edges": [{"a": int(a), "b": int(b), **d} for a, b, d in PG.edges(data=True)],
            "hard_links": [{"a": int(a), "b": int(b), "type": "device_id"} for a, b in hard]}
    _w(art / "network.json", {"s5_card": sim, "worked_example": worked, "ego": ego, "ring": proj,
                              "s5_first_payers": [{"payer_id": int(u), "t_min": int(t), "amount": int(a), "bf2_bettor": bool(s)}
                                                  for u, t, a, s in zip(first.payer_id, first.t_min, first.amount, shared)]})


def earned_trust(world, cal, cfg, F, p, art):
    mdf, pay = world["merchants"], world["payments"]
    code_i = dict(zip(mdf.code, mdf.merchant_id))
    out = {}
    T0 = int(mdf.loc[code_i["HERO"], "takeover_day"])
    for code, label in [("HERO_TWIN", "Honest twin (S0)"), ("HERO", "Taken-over bakery (S3)")]:
        i = code_i[code]
        a, b = T0, cal.days
        pp = pay[(pay.merchant_id == i) & (pay.kind == 0) & (pay.t_min >= a * MIN_PER_DAY)]
        settled = float(pp.amount.sum())
        normal = float(pp.amount[~pp.is_bet].sum())
        is_front = code == "HERO"
        feats = RS.consented_features(mdf.iloc[i], settled, normal, is_front, cfg)
        h = int(np.argmax(np.where(F["active"][i, a * 24:], p[i, a * 24:], -1))) + a * 24
        p0 = float(p[i, h])
        tiers = []
        for t in range(4):
            r = RS.apply_consent(p0, feats if t > 0 else None, t, cfg)
            tiers.append({"tier": t, "name": cfg["costs"]["earned_trust"]["tiers"][t]["name"], **r})
        out[code] = {"label": label, "hour": h, "p_before": p0, "features": feats, "settled_inr": settled,
                     "normal_inr": normal, "tiers": tiers}
    _w(art / "earned_trust.json", out)


def story_data(world, cal, cfg, F, ctx, art):
    mdf, pay = world["merchants"], world["payments"]
    code_i = dict(zip(mdf.code, mdf.merchant_id))
    i = code_i["HERO_TWIN"]
    pp = pay[(pay.merchant_id == i) & (pay.kind == 0)]
    hours = (pp.t_min // 60) % 24
    dow = ((pp.t_min // MIN_PER_DAY) + cal.start.dayofweek) % 7
    days = cal.days
    weekday = hours[dow < 5].value_counts().reindex(range(24), fill_value=0) / (days * 5 / 7)
    weekend = hours[dow >= 5].value_counts().reindex(range(24), fill_value=0) / (days * 2 / 7)
    vc = pp.payer_id.value_counts()
    regular = vc[vc >= 4]
    daily = pp.groupby(pp.t_min // MIN_PER_DAY).size()
    prof = {
        "weekday_by_hour": weekday.round(3).tolist(), "weekend_by_hour": weekend.round(3).tolist(),
        "amounts": pp.amount.tolist(), "avg_daily_payments": float(len(pp) / days), "median_bill": float(pp.amount.median()),
        "regulars": int(len(regular)), "share_from_regulars": float(vc[vc >= 4].sum() / len(pp)),
        "unique_payers": int(pp.payer_id.nunique()), "days_open": int(daily.shape[0]), "total_payments": int(len(pp)),
        "daily_counts": daily.reindex(range(days), fill_value=0).tolist(),
    }
    _w(art / "hero_profile.json", prof)


def fmt_p(p, eq=False):
    if p >= 0.995:
        return "> 0.99"
    return f"= {p:.2f}" if eq else f"{p:.2f}"


def _fmt_day(cal, h):
    return (cal.start + pd.Timedelta(hours=int(h))).strftime("%a %d %b %Y, %H:00")


def evidence_pack(world, cal, cfg, F, p, lad, summ, reasons, reserves, art, code):
    import plotly.graph_objects as go
    import plotly.io as pio

    mdf, pay = world["merchants"], world["payments"]
    i = int(mdf.index[mdf.code == code][0])
    r = mdf.iloc[i]
    s = summ.iloc[i]
    h_flag = int(s.first_l3_h if s.first_l3_h >= 0 else s.first_l2_h)
    if h_flag < 0:
        return None
    rs = next((x for x in reasons if x["merchant_id"] == i and x["kind"] == ("first_l3" if s.first_l3_h >= 0 else "first_l2")), None)
    first = {}
    for e, k in [("Drift", "drift_fire"), ("Peers", "peer_fire"), ("Invariants", "invariants_fire"), ("Graph", "graph_fire")]:
        hh = np.where(F[k][i] & F["active"][i])[0]
        first[e] = int(hh[0]) if len(hh) else None
    t_h = int(r.takeover_t_min // 60) if not np.isnan(r.takeover_t_min) else None
    events = [(int(r.onboard_day) * 24, "Onboarded (KYB passed as " + r.category.replace("_", " ") + ")")]
    events.append((h_flag, f"PULSE reached L{int(lad['level'][i, h_flag])} (calibrated p {fmt_p(p[i, h_flag], eq=True)}; {int(F['n_engines'][i, h_flag])} engines agree)"))
    for e, hh in first.items():
        if hh is not None and hh >= (t_h or 0) - 48:
            events.append((hh, f"{e} engine crossed its threshold"))
    if s.first_l2_h >= 0:
        events.append((int(s.first_l2_h), "L2 micro-proof requested (OTP + supplier invoice)"))
    if s.first_l3_h >= 0:
        events.append((int(s.first_l3_h), "L3 delta reserve and video KYC"))
    events = sorted(set(events))
    held = float(reserves["S3"].held.sum()) if code == "HERO" and "S3" in reserves else None
    pp = pay[(pay.merchant_id == i)]
    win = pp[(pp.t_min >= (h_flag - 167) * 60) & (pp.t_min < (h_flag + 1) * 60)]
    refunds = win[win.kind == 1]
    banned_links = []
    for b in world["banned"]:
        if b["ban_t_min"] // 60 > h_flag:
            continue
        payers = pp[(pp.kind == 0) & (pp.t_min < (h_flag + 1) * 60)].payer_id.unique()
        k = int(np.isin(payers, b["bettors"]).sum())
        row = mdf.iloc[b["merchant_id"]]
        hard = [lab for col, lab in [("device_id", "device ID"), ("director_id", "director"), ("settlement_account", "settlement account")] if row[col] == r[col]]
        if k or hard:
            banned_links.append({"front": b["name"], "ban_date": str(cal.date_of_day(b["ban_day"]).date()), "shared_payers": k, "hard_links": hard})
    lvl = int(lad["level"][i].max())
    name = r["name"]
    lines = [
        f"# Analyst case file: {name}",
        "",
        "> **SIMULATED DATA.** Prototype output on a synthetic scenario. Not a real merchant, not a real case.",
        "",
        f"- **Case ID:** PULSE-{code}-{h_flag}",
        f"- **Merchant:** {name} (`{code}`), declared category: {r.category.replace('_', ' ')}, {r.city} (tier {r.tier})",
        f"- **Data source:** {r.data_source}",
        f"- **Flag time:** {_fmt_day(cal, h_flag)}; calibrated probability {fmt_p(p[i, h_flag])}; engines agreeing: {int(F['n_engines'][i, h_flag])} of 4",
        f"- **Highest ladder level:** L{lvl}" + (" (L4/L5 recommendation requires analyst approval)" if lvl >= 4 else ""),
        "",
        "## Timeline",
        "",
        "| When | Event |",
        "|---|---|",
    ] + [f"| {_fmt_day(cal, h)} | {e} |" for h, e in events] + [
        "",
        "## Why PULSE flagged it (top three reasons)",
        "",
    ] + ([f"{k + 1}. **{x['engine'].title()}**: {x['text']}" for k, x in enumerate(rs["reasons"])] if rs else ["(no reasons recorded)"]) + [
        "",
        "## Engine readings at flag time",
        "",
        "| Engine | Score (0-1) | Fired | Key reading |",
        "|---|---|---|---|",
        f"| Drift (own past + declared profile) | {F['drift_adj'][i, h_flag]:.2f} | {'yes' if F['drift_fire'][i, h_flag] else 'no'} | JS(24 h) {F['js_24h'][i, h_flag]:.2f}, round-amount excess {F['round_excess'][i, h_flag]:.2f}, CUSUM {F['cusum'][i, h_flag]:.1f} |",
        f"| Peers | {F['peers_score'][i, h_flag]:.2f} | {'yes' if F['peer_fire'][i, h_flag] else 'no'} | robust z {F['peer_z'][i, h_flag]:.1f}, persistent in {int(F['peer_persist'][i, h_flag])} of last 6 h |",
        f"| Betting invariants | {F['invariants_score'][i, h_flag]:.2f} | {'yes' if F['invariants_fire'][i, h_flag] else 'no'} | match-clock beta {F['match_beta'][i, h_flag]:.1f} (placebo p {F['match_p'][i, h_flag]:.3f}); loop ratio {F['loop_ratio'][i, h_flag]:.2f} |",
        f"| Network graph | {F['graph_score'][i, h_flag]:.2f} | {'yes' if F['graph_fire'][i, h_flag] else 'no'} | -log10 p {F['graph_neglogp'][i, h_flag]:.1f}; shared payers {int(F['shared_k'][i, h_flag])}; hard links {int(F['hard_links'][i, h_flag])} |",
        "",
        "## Graph links to banned fronts",
        "",
    ] + ([f"- {b['front']} (banned {b['ban_date']}): {b['shared_payers']} shared payers" + (f"; shared {', '.join(b['hard_links'])}" if b['hard_links'] else "") for b in banned_links] or ["- None at flag time"]) + [
        "",
        "## Money movement in the 7 days before the flag",
        "",
        f"- Pay-ins: {int((win.kind == 0).sum())} payments, {inr(win.amount[win.kind == 0].sum())}",
        f"- 'Refunds' / payouts: {len(refunds)} payments, {inr(refunds.amount.sum())} to {refunds.payer_id.nunique()} recipients",
    ] + ([f"- Delta reserve held (whole window): {inr(held)}; everything else settled T+1"] if held is not None else []) + [
        "",
        "## Action taken: two tracks",
        "",
        "| Visible to the merchant | Hidden compliance track |",
        "|---|---|",
        "| L2: OTP re-verification and one recent supplier invoice | Case opened, analyst queue, evidence frozen |",
        "| L3: video KYC; part of the day's settlement delayed for review | Only the fingerprinted surplus above Tolerated is held |",
        "| (L4/L5 only after analyst approval) | STR draft prepared below; merchant is **not** informed (no tipping-off) |",
        "",
        "## Draft STR narrative (template)",
        "",
        "> **Draft for compliance review — not filed; filed within 7 working days per PMLA rules; merchant is not informed.**",
        "",
        f"> {name}, onboarded as a {r.category.replace('_', ' ')} in {r.city}, showed a sustained change in its pattern of payments from "
        f"{_fmt_day(cal, t_h if t_h is not None else h_flag)}. "
        + " ".join(x["text"] + "." for x in (rs["reasons"] if rs else []))
        + " The pattern is consistent with collection of betting stakes and disguised payouts, which does not match the declared business. "
        "[Analyst to add: KYB documents reviewed, contact attempts (none, to avoid tipping off), linked accounts, amounts and date range.]",
        "",
        "---",
        "_Generated by the PULSE prototype from simulated data. All thresholds and costs are design parameters._",
    ]
    md = "\n".join(lines)
    (art / "evidence").mkdir(parents=True, exist_ok=True)
    (art / "evidence" / f"{code}_case_file.md").write_text(md)
    # HTML version with two charts
    D = cal.days
    daily_cnt = F["cnt"][i].reshape(D, 24).sum(axis=1)
    daily_lvl = lad["level"][i].reshape(D, 24).max(axis=1)
    x = [str(cal.date_of_day(d).date()) for d in range(D)]
    f1 = go.Figure([go.Bar(x=x, y=daily_cnt, name="Payments per day", marker_color="#00AD7D"),
                    go.Scatter(x=x, y=daily_lvl, name="Ladder level", yaxis="y2", line=dict(color="#002124", width=2))])
    f1.update_layout(title="Daily payments and ladder level", yaxis2=dict(overlaying="y", side="right", range=[0, 5.5], title="Level"),
                     template="plotly_white", height=320, margin=dict(l=40, r=40, t=50, b=40))
    h0 = max(0, h_flag - 36)
    hh = list(range(h0, min(cal.H, h_flag + 24)))
    f2 = go.Figure([go.Bar(x=[cal.hour_label(h) for h in hh], y=F["cnt"][i, hh], name="Payments per hour", marker_color="#00AD7D"),
                    go.Scatter(x=[cal.hour_label(h) for h in hh], y=p[i, hh], name="Calibrated p", yaxis="y2", line=dict(color="#002124"))])
    f2.update_layout(title="Hours around the flag", yaxis2=dict(overlaying="y", side="right", range=[0, 1]), template="plotly_white",
                     height=320, margin=dict(l=40, r=40, t=50, b=80))
    body = md
    html = ("<!doctype html><html><head><meta charset='utf-8'><title>PULSE case file</title>"
            "<style>body{font-family:Poppins,Arial,sans-serif;max-width:960px;margin:24px auto;color:#002124;padding:0 16px}"
            "table{border-collapse:collapse}td,th{border:1px solid #E3E3E3;padding:4px 8px}blockquote{background:#F7F7F7;border-left:4px solid #00AD7D;margin:0;padding:8px 12px}</style>"
            "</head><body>" + _md_to_html(body) + pio.to_html(f1, include_plotlyjs="cdn", full_html=False, div_id=f"{code}-daily")
            + pio.to_html(f2, include_plotlyjs=False, full_html=False, div_id=f"{code}-hours") + "</body></html>")
    (art / "evidence" / f"{code}_case_file.html").write_text(html)
    return md


def _md_to_html(md: str) -> str:
    """Very small Markdown subset converter (headings, lists, tables, quotes, bold)."""
    import html as H
    import re

    out, in_table, in_list = [], False, None
    for line in md.split("\n"):
        esc = H.escape(line)
        esc = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", esc)
        esc = re.sub(r"`(.+?)`", r"<code>\1</code>", esc)
        esc = re.sub(r"_(.+?)_$", r"<i>\1</i>", esc)
        if line.startswith("|"):
            cells = [c.strip() for c in esc.strip("|").split("|")]
            if set("".join(cells)) <= set("-"):
                continue
            if not in_table:
                out.append("<table>")
                in_table = True
                out.append("<tr>" + "".join(f"<th>{c}</th>" for c in cells) + "</tr>")
            else:
                out.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>")
            continue
        if in_table:
            out.append("</table>")
            in_table = False
        m = re.match(r"^(\d+)\. (.*)", esc)
        if line.startswith("- ") or m:
            tag = "ol" if m else "ul"
            if in_list != tag:
                if in_list:
                    out.append(f"</{in_list}>")
                out.append(f"<{tag}>")
                in_list = tag
            out.append(f"<li>{m.group(2) if m else esc[2:]}</li>")
            continue
        if in_list:
            out.append(f"</{in_list}>")
            in_list = None
        if line.startswith("# "):
            out.append(f"<h1>{esc[2:]}</h1>")
        elif line.startswith("## "):
            out.append(f"<h2>{esc[3:]}</h2>")
        elif line.startswith("&gt; "):
            out.append(f"<blockquote>{esc[5:]}</blockquote>")
        elif line.strip() == "---":
            out.append("<hr>")
        elif line.strip():
            out.append(f"<p>{esc}</p>")
    if in_table:
        out.append("</table>")
    if in_list:
        out.append(f"</{in_list}>")
    return "\n".join(out)


def build_extras(world, cal, cfg, F, ctx, p, lad, summ, reasons, reserves, art, rctx):
    network_views(world, cal, cfg, F, art)
    earned_trust(world, cal, cfg, F, p, art)
    story_data(world, cal, cfg, F, ctx, art)
    for code in ["HERO", "S5"]:
        evidence_pack(world, cal, cfg, F, p, lad, summ, reasons, reserves, art, code)
    _ = json, rctx
