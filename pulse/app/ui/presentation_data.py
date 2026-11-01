"""Builds the data for the cinematic Presentation Mode from the SAME artefacts the app uses.

Nothing here is invented: every figure is read or derived from artifacts/ exactly as the Story-mode pages do,
so the presentation can never disagree with the rest of the app.
"""
from __future__ import annotations

import json
import re

import numpy as np
import pandas as pd

from . import data


def _hour_label(h: int, fmt: str) -> str:
    return data.hour_label(int(h), fmt)


def build() -> dict:
    M = data.merchants()
    meta = data.meta()
    costs = meta["config"]["costs"]
    hero = M[M.code == "HERO"].iloc[0]
    twin = M[M.code == "HERO_TWIN"].iloc[0]
    H = data.hourly("HERO")
    P = data.payments("HERO")
    T0 = int(hero.takeover_t_min // 60)
    TD = T0 // 24
    first_l2 = int(hero.first_l2_h)

    # ---------------- scene 2: the real bakery's normal
    prof = data.js("hero_profile.json")
    amts = np.array(prof["amounts"])
    edges = np.arange(0, 1240, 40)
    bill_hist = np.histogram(amts, bins=edges)[0]
    share_100_300 = float(((amts >= 100) & (amts <= 300)).mean())
    ing = meta["ingest_report"]

    # ---------------- scene 3: the takeover (same windows and maths as Story step 2)
    pin = P[P.kind == 0]
    ph = (pin.t_min // 60).to_numpy()
    h0, h1 = TD * 24 + 6, TD * 24 + 28  # 06:00 Day T -> 04:00 next day
    hrs = np.arange(h0, h1)
    inside = np.array([int(((ph == h) & pin.fp_match.to_numpy()).sum()) for h in hrs])
    outside = np.array([int(((ph == h) & ~pin.fp_match.to_numpy()).sum()) for h in hrs])
    day = (ph >= TD * 24) & (ph < TD * 24 + 24)
    day_total = int(day.sum())
    day_inside = int((day & pin.fp_match.to_numpy()).sum())
    r0, r1 = TD * 24 + 10, (TD + 6) * 24 + 4  # replay window used in Story step 2
    refunds = P[(P.kind == 1) & (P.t_min // 60 >= r0) & (P.t_min // 60 < r1)]
    windows = [(f["w0"] / 60 - h0, f["t_end"] / 60 - h0, f["teams"], f["competition"]) for f in meta["fixtures_in_window"]
               if f["t_end"] / 60 > h0 and f["w0"] / 60 < h1]
    # a deterministic sample of the day's individual payments for the "stream"
    dpay = pin[day].sort_values("t_min")
    idx = np.linspace(0, len(dpay) - 1, 26).round().astype(int)
    stream = [{"t": _hour_label(0, "%H:%M") if False else f"{(int(r.t_min) // 60) % 24:02d}:{int(r.t_min) % 60:02d}",
               "payer": f"UPI ••{int(r.payer_id) % 10000:04d}", "amount": int(r.amount), "match": bool(r.fp_match)}
              for r in dpay.iloc[idx].itertuples()]
    fixture = next((f for f in meta["fixtures_in_window"] if f["date"] == str(data.date_of_hour(TD * 24).date()) and f["day_k"] == 0), None)

    # ---------------- scene 4: the four engines at the hour all four agree (same choice as Story step 3/4)
    opts = list(range(TD * 24 + 17, TD * 24 + 28))
    all4 = [o for o in opts if int(H.n_engines.iloc[o]) == 4]
    h4 = all4[0] if all4 else first_l2 + 2
    r = H.iloc[h4]
    w24 = np.arange(h4 - 23, h4 + 1)
    w72 = np.arange(h4 - 71, h4 + 1)
    lo = (max(h4, TD * 24 + 26) - 167) * 60
    hi = (max(h4, TD * 24 + 26) + 1) * 60
    A = set(P.payer_id[(P.kind == 0) & (P.t_min >= lo) & (P.t_min < hi)])
    B = set(P.payer_id[(P.kind == 1) & (P.t_min >= lo) & (P.t_min < hi)])
    bf1 = next(b for b in meta["banned"] if b["code"] == "BF1")
    n30, k = int(r.n_payers_30d), int(r.shared_k)
    expected_bf1 = n30 * bf1["n_bettors"] / meta["payer_pool"]

    # ---------------- scene 5: decision (same reason selection as Story step 4)
    rep = data.reasons_for("HERO", "replay")
    night = [x for x in rep if TD * 24 + 17 <= x["hour"] <= TD * 24 + 27]
    full = [x for x in night if x["n_engines"] == 4 and len(x["reasons"]) >= 3]
    rr = full[0] if full else (data.reasons_for("HERO", "first_l3") or data.reasons_for("HERO", "first_l2"))[0]
    hd = rr["hour"]

    # ---------------- scene 6: settlement split (reserve artefact of Story step 5)
    R = data.pq("reserve_S3.parquet")
    dayR = R.iloc[TD * 24: TD * 24 + 24]
    RS1 = data.pq("reserve_S1_forced.parquet")
    s1d = RS1.groupby(RS1.hour // 24).agg(amount=("amount", "sum"), tolerated=("tolerated_day", "first"), held=("held", "sum"))

    # ---------------- scene 7: honest cases (same windows as Story step 6)
    S1 = data.hourly("S1_SWEETS")
    S2 = data.hourly("S2_SPORTSBAR")
    s1_days = list(range(140, 156))
    s1_cnt = [int(S1.cnt.to_numpy()[d * 24:(d + 1) * 24].sum()) for d in s1_days]
    s1_exp = [float((S1.E.to_numpy()[d * 24:(d + 1) * 24] * np.exp(np.maximum(0, S1.peer_median_lift.to_numpy()[d * 24:(d + 1) * 24]))).sum())
              for d in s1_days]
    fest = {data.meta()["festivals"][i]["date"]: data.meta()["festivals"][i]["name"] for i in range(len(meta["festivals"]))}
    s1_labels = [str(data.date_of_hour(d * 24).date()) for d in s1_days]
    s2h = np.arange(108 * 24 + 12, 116 * 24)
    s2_windows = [(f["w0"] / 60 - s2h[0], f["t_end"] / 60 - s2h[0]) for f in meta["fixtures_in_window"]
                  if f["t_end"] / 60 > s2h[0] and f["w0"] / 60 < s2h[-1]]
    m_s1 = M[M.code == "S1_SWEETS"].iloc[0]
    m_s2 = M[M.code == "S2_SPORTSBAR"].iloc[0]

    # ---------------- scene 8: network (network artefact)
    net = data.js("network.json")
    s5 = M[M.code == "S5"].iloc[0]
    bf2 = next(b for b in meta["banned"] if b["code"] == "BF2")

    # ---------------- scene 9: evidence pack (the real case file)
    md = data.text("artifacts/evidence/HERO_case_file.md")
    case_id = re.search(r"\*\*Case ID:\*\* (\S+)", md).group(1)
    timeline_rows = re.findall(r"^\| ([A-Z][a-z]{2} \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}) \| (.+?) \|$", md, flags=re.M)
    links = re.findall(r"^- (.+?banned .+?)$", md, flags=re.M)
    money = re.findall(r"^- ((?:Pay-ins|'Refunds'|Delta reserve).+)$", md, flags=re.M)
    str_text = re.search(r"^> (?!\*\*)(.+)$", md, flags=re.M)

    # ---------------- scene 10: evaluation
    met = data.js("eval/metrics.json")["stage_c_calibrated_lightgbm"]
    card = data.js("eval/scenario_scorecard.json")
    abl = data.js("eval/ablation.json")
    ttd = data.js("eval/time_to_detect.json")
    d = np.array([x["detect_hours"] for x in ttd if x["detect_hours"] is not None])
    tedges = [0, 1, 6, 24, 96, 336, 1200]
    tcnt = np.histogram(d, bins=tedges)[0].tolist()
    tmiss = sum(x["detect_hours"] is None for x in ttd)

    def lvl_name(k):
        return {0: "Watch", 1: "Silent check", 2: "Micro-proof", 3: "Delta reserve", 4: "Restrict", 5: "Exit + STR draft"}[int(k)]

    out = {
        "brand": {"name": "PULSE"},
        "hero": {
            "name": twin["name"].split(" (")[0], "city": twin.city, "category": "Bakery",
            "avg_daily": prof["avg_daily_payments"], "median_bill": prof["median_bill"], "regulars": prof["regulars"],
            "share_regulars": prof["share_from_regulars"], "days_open": prof["days_open"],
            "weekday": prof["weekday_by_hour"], "weekend": prof["weekend_by_hour"],
            "bill_edges": edges.tolist(), "bill_hist": bill_hist.tolist(), "share_100_300": share_100_300,
            "baskets": ing["transactions_used"], "source_note": "Real transactions from the public Bread Basket dataset (a UK bakery), "
            "moved onto the 2025 calendar with day-of-week kept. Rupee prices and customer IDs are assumptions. Not PayU data.",
        },
        "takeover": {
            "date": _hour_label(TD * 24, "%a %d %b %Y"), "date_next": _hour_label(TD * 24 + 24, "%a %d %b %Y"), "fixture": (f"{fixture['teams']} · {fixture['competition']}" if fixture else ""),
            "kickoff": fixture["start_time_ist"] if fixture else "", "hour0": int(h0 % 24),
            "hours": [_hour_label(h, "%H:00") for h in hrs], "inside": inside.tolist(), "outside": outside.tolist(),
            "p": [float(x) for x in H.p.to_numpy()[hrs]], "windows": windows,
            "normal_daily": round(float(twin.base_daily_tx)), "day_total": day_total, "share_inside": day_inside / max(day_total, 1),
            "refunds_inr": float(refunds.amount.sum()), "refunds_n": int(len(refunds)),
            "refund_window": f"{_hour_label(r0, '%d %b')}–{_hour_label(r1, '%d %b')}",
            "first_flag": _hour_label(first_l2, "%H:00, %d %b"), "first_flag_idx": int(first_l2 - h0),
            "first_flag_same_hour": first_l2 == T0, "stream": stream,
        },
        "engines": {
            "hour": _hour_label(h4, "%a %d %b, %H:00"),
            "drift": {"score": float(r.drift_adj), "thr": meta["config"]["engines"]["drift"]["fire_threshold"],
                      "cnt": H.cnt.to_numpy()[w24].astype(int).tolist(), "E": [float(x) for x in H.E.to_numpy()[w24]],
                      "labels": [_hour_label(h, "%H") for h in w24]},
            "peers": {"z": float(r.peer_z), "persist": int(r.peer_persist), "lift": [float(x) for x in H.lift.to_numpy()[w72]],
                      "peer": [float(x) for x in H.peer_median_lift.to_numpy()[w72]], "day_labels": [_hour_label(h, "%d %b") for h in w72[::24]]},
            "loop": {"A": len(A), "B": len(B), "AB": len(A & B), "beta": float(r.match_beta), "p": float(r.match_p)},
            "graph": {"k": k, "n": n30, "expected": expected_bf1, "front": bf1["name"], "ban": _hour_label(bf1["ban_day"] * 24, "%d %b"),
                      "neglogp": float(r.graph_neglogp)},
            "fired": {"drift": bool(r.drift_fire), "peers": bool(r.peer_fire), "invariants": bool(r.invariants_fire), "graph": bool(r.graph_fire)},
        },
        "decision": {
            "hour": _hour_label(hd, "%a %d %b, %H:00"), "p": float(rr["p"]), "n_engines": int(rr["n_engines"]),
            "reasons": [{"engine": x["engine"], "text": x["text"]} for x in rr["reasons"]],
            "auto": int(H.level_auto.iloc[hd]), "rec": int(H.level.iloc[hd]),
            "auto_name": lvl_name(H.level_auto.iloc[hd]), "rec_name": lvl_name(H.level.iloc[hd]),
            "c_fraud": costs["c_fraud"], "c_l3": costs["c_friction"]["L3"], "thresholds": meta["level_thresholds"],
            "auto_max": costs["auto_max_level"],
        },
        "reserve": {
            "paid": float(dayR.amount.sum()), "held": float(dayR.held.sum()), "settled": float(dayR.settled_on_time.sum()),
            "hours": [_hour_label(h, "%H") for h in dayR.hour], "amount": dayR.amount.round().tolist(), "held_h": dayR.held.round().tolist(),
            "tolerated": dayR.tolerated.round().tolist(), "total_case": float(R.held.sum()), "k": costs["delta_reserve"]["sigma_multiplier"],
            "s1_days": [_hour_label(int(dd) * 24, "%d %b") for dd in s1d.index], "s1_amount": s1d.amount.round().tolist(),
            "s1_tol": s1d.tolerated.round().tolist(), "s1_held": float(s1d.held.sum()),
        },
        "honest": {
            "s1": {"name": m_s1["name"].replace(" (S1)", ""), "labels": [_hour_label(dd * 24, "%d %b") for dd in s1_days], "cnt": s1_cnt,
                   "exp": s1_exp, "fest": [fest.get(x, "") for x in s1_labels], "max_level": int(m_s1.max_level),
                   "held": float(RS1.held.sum())},
            "s2": {"name": m_s2["name"].replace(" (S2)", ""), "cnt": S2.cnt.to_numpy()[s2h].astype(int).tolist(),
                   "windows": s2_windows, "max_level": int(m_s2.max_level), "label0": _hour_label(int(s2h[0]), "%d %b"),
                   "label1": _hour_label(int(s2h[-1]), "%d %b")},
            "hero_level": int(hero.max_level_auto),
        },
        "network": {
            "ego": net["ego"], "card": net["s5_card"], "worked": net["worked_example"],
            "first": net["s5_first_payers"], "s5_name": s5["name"].replace(" (S5)", ""),
            "onboard": _hour_label(int(s5.onboard_day) * 24, "%d %b"), "front": bf2["name"],
            "ban": _hour_label(bf2["ban_day"] * 24, "%d %b"), "detect_h": float(s5.detect_hours),
        },
        "evidence": {
            "case_id": case_id, "timeline": [{"when": a, "what": b} for a, b in timeline_rows[:6]], "links": links[:2],
            "money": money[:3], "str": (str_text.group(1)[:330] + "…") if str_text else "",
            "readings": [
                {"engine": "Drift", "score": float(H.drift_adj.iloc[hd]), "fired": bool(H.drift_fire.iloc[hd])},
                {"engine": "Peers", "score": float(H.peers_score.iloc[hd]), "fired": bool(H.peer_fire.iloc[hd])},
                {"engine": "Invariants", "score": float(H.invariants_score.iloc[hd]), "fired": bool(H.invariants_fire.iloc[hd])},
                {"engine": "Graph", "score": float(H.graph_score.iloc[hd]), "fired": bool(H.graph_fire.iloc[hd])}],
        },
        "eval": {
            "n_fronts": met["n_test_fronts"], "caught": int(round(met["recall_l2"] * met["n_test_fronts"])), "recall": met["recall_l2"],
            "p10": met["precision_at_10"], "prauc": met["merchant_day_pr_auc"], "n_honest": met["n_test_honest"],
            "honest_l3": int(round(met["honest_ever_l3_share"] * met["n_test_honest"])),
            "scenarios": [{"id": c["id"], "label": c["label"], "pass": c["pass"]} for c in card],
            "ablation": [{"variant": a["variant"], "recall": a["recall_l2"]} for a in abl],
            "ttd_labels": ["<1 h", "1–6 h", "6–24 h", "1–4 d", "4–14 d", "14+ d"], "ttd": tcnt, "ttd_miss": tmiss,
            "median_detect": met["detect_hours_median"],
        },
    }
    return json.loads(json.dumps(out, default=lambda o: o.item() if hasattr(o, "item") else str(o)))


_ = pd


TEMPLATE = data.ROOT / "app" / "presentation" / "presentation.html"


def html(payload: dict | None = None) -> str:
    """The presentation page with the artefact data embedded (no network calls during playback)."""
    payload = payload if payload is not None else build()
    blob = json.dumps(payload, separators=(",", ":")).replace("</", "<\\/")
    return TEMPLATE.read_text().replace("/*__PULSE_DATA__*/null", blob)
