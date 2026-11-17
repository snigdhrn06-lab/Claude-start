"""Mock production scoring API: POST /score scores one merchant-window before the settlement batch.

How the work splits in production (and here):
- An hourly COHORT JOB computes what needs other merchants or long windows: peer z and persistence (Engine B), the
  match-clock beta and placebo p (Engine C), shared-bettor overlap with banned fronts (Engine D) and the cohort's
  median drift. It hands these to the API as `context`.
- The API scores ONE merchant's trailing window against that merchant's frozen baseline profile (kept in memory):
  hour-shape divergence, amount shift, round-amount excess and CUSUM (Engine A), the refund loop and new-distant-payer
  share (Engine C), then fuses everything with the day-one scorecard and the ladder rules.

Run as a service:   python -m pulse.scoring_api --serve 8765     (stdlib only; POST JSON to /score)
Benchmark:          python -m pulse.scoring_api --bench 10000    (writes artifacts/eval/latency.json)
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import pandas as pd

from .config import ROOT, load_config
from .engines.drift import js_divergence, noisy_or, wasserstein_hist
from .response import level_thresholds

ART = ROOT / "artifacts"
_CFG = load_config()
_STATE: dict | None = None


def state() -> dict:
    global _STATE
    if _STATE is None:
        _STATE = json.loads((ART / "merchant_state.json").read_text())
    return _STATE


def score_window(merchant: str, payments: list[dict], context: dict, cfg: dict = _CFG) -> dict:
    """payments: the merchant's trailing 7 days; each {hour_of_week, hours_ago, amount_inr, payer_id, type,
    in_match_window, new_distant_payer, refund_matches_payment, payer_paid_in_last_7d}."""
    st = state()[merchant]
    ec = cfg["engines"]
    dc = ec["drift"]
    edges = np.linspace(*dc["amount_bins"][:2], int(dc["amount_bins"][2]) + 1)
    day = [p for p in payments if p["hours_ago"] < 24 and p["type"] == "payment"]
    n = len(day)
    # ---- Engine A: drift against the frozen anchor
    rate = np.asarray(st["rate_how"], float)
    hw = sorted({p["hour_of_week"] for p in day}) if day else []
    now_how = context["hour_of_week"]
    cells = [(now_how - k) % 168 for k in range(24)]
    obs = np.zeros(24)
    for p in day:
        obs[p["hours_ago"]] += 1
    q = rate[cells] + 0.01 * rate.mean() + 1e-3
    q = q / q.sum()
    a = dc["shrink_24h"]
    js24 = float(js_divergence((obs + a * q) / (n + a), q))
    hist = np.histogram(np.log10(np.maximum([p["amount_inr"] for p in day] or [1], 1)), bins=edges)[0].astype(float) if day else np.zeros(len(edges) - 1)
    hb = np.asarray(st["hist"], float)
    wass = float(wasserstein_hist((hist + a * hb) / (n + a), hb, edges))
    r0 = st["round"]
    rnd = sum(1 for p in day if p["amount_inr"] % dc["round_modulus"] == 0)
    round_ex = max(0.0, (rnd + a * r0) / (n + a) - r0)
    e24 = float(rate[cells].sum())
    sd24 = max(st["daily_std"] * e24 / max(st["daily_mean"], 1e-6), np.sqrt(max(e24, 1)))
    cusum = float(np.clip(max(0.0, context.get("cusum_prev", 0.0) + (n - e24) / sd24 - dc["cusum"]["k"]), 0, 50))
    parts = {"js_24h": js24, "wasserstein": wass, "round_excess": round_ex, "cusum": cusum}
    dscore = float(noisy_or(parts, dc["refs"], dc["weights"], dc["floors"]))
    drift_adj = max(0.0, dscore - context.get("peer_median_drift", 0.0))
    drift_fire = drift_adj >= dc["fire_threshold"]
    # ---- Engine B: from the cohort job
    pc = ec["peers"]
    peer_fire = context["peer_z"] > pc["z_threshold"] and context["peer_persist"] >= pc["persist_k"]
    # ---- Engine C: refund loop (7 days) + match clock (cohort job) with the distant-payer guard
    ic = ec["invariants"]
    outs = [p for p in payments if p["type"] in ("refund", "payout")]
    nr = len(outs)
    loop_ratio = sum(p["payer_paid_in_last_7d"] for p in outs) / nr if nr else 0.0
    unmatched = sum(not p["refund_matches_payment"] for p in outs) / nr if nr else 0.0
    pin7 = sum(p["amount_inr"] for p in payments if p["type"] == "payment")
    payout_ratio = sum(p["amount_inr"] for p in outs) / max(pin7, 1)
    lc = ic["loop"]
    loop_fire = nr >= lc["min_payouts"] and loop_ratio >= lc["loop_ratio"] and unmatched >= lc["unmatched_share"] and payout_ratio >= lc["payout_ratio_min"]
    d0 = st["distant_share"]
    dist = sum(p["new_distant_payer"] for p in day)
    distant_ex = max(0.0, (dist + a * d0) / (n + a) - d0)
    mc = ic["match_clock"]
    match_fire = context["match_beta"] >= mc["beta_threshold"] and context["match_p"] <= mc["p_threshold"] and distant_ex >= mc["distant_new_excess"]
    inv_fire = loop_fire or match_fire
    # ---- Engine D: from the cohort job
    gc = ec["graph"]
    graph_fire = context["graph_neglogp"] >= -np.log10(gc["p_threshold"]) or context.get("hard_links", 0) >= 1
    # ---- fusion: day-one scorecard + ladder
    w = ec["fusion"]["scorecard"]
    peers_score = min(max(context["peer_z"] / 6, 0), 1) * min(context["peer_persist"] / 6, 1)
    loop_score = loop_ratio * unmatched * min(payout_ratio / (2 * lc["payout_ratio_min"]), 1) * min(nr / lc["min_payouts"], 1)
    match_score = min(max(context["match_beta"] / (2 * mc["beta_threshold"]), 0), 1) * (context["match_p"] <= mc["p_threshold"]) * min(distant_ex / (2 * mc["distant_new_excess"]), 1)
    inv_score = max(loop_score, match_score)
    graph_score = max(min(context["graph_neglogp"] / (2 * -np.log10(gc["p_threshold"])), 1), 0.8 if context.get("hard_links", 0) >= 1 else 0)
    n_eng = int(drift_fire) + int(peer_fire) + int(inv_fire) + int(graph_fire)
    z = (w["intercept"] + w["drift"] * drift_adj + w["peers"] * peers_score + w["invariants"] * inv_score + w["graph"] * graph_score
         + w["two_engines_bonus"] * (n_eng >= 2))
    p = 1 / (1 + np.exp(-z))
    costs = cfg["costs"]
    thr = level_thresholds(costs)
    level = 0
    for k, L in enumerate(["L1", "L2", "L3", "L4", "L5"], start=1):
        if p > thr[L] and n_eng >= costs["min_engines"][L]:
            level = k
    band = "Act" if level >= 3 else ("Review" if level == 2 else "Watch")
    reasons = []
    ms = sum(p_["in_match_window"] for p_ in day) / n if n else 0.0
    if match_fire or ms > 0.3:
        reasons.append(f"{round(100 * ms)}% of the last 24 h's payments fell inside live-match windows vs {round(100 * st['match_share'])}% in its baseline")
    if graph_fire:
        reasons.append(f"{int(context.get('shared_bettors', 0))} of its recent payers also paid a banned front (cohort job, -log10 p = {context['graph_neglogp']:.1f})")
    if loop_fire:
        reasons.append(f"{nr} refunds/payouts in 7 days, {round(100 * loop_ratio)}% to people who had just paid in, {round(100 * unmatched)}% matching no order")
    if drift_fire and len(reasons) < 3:
        reasons.append(f"{n} payments in 24 h against about {e24:.0f} expected from its own frozen baseline; round-amount excess {round_ex:.2f}")
    return {"merchant": merchant, "band": band, "recommended_level": f"L{level}", "automatic_level": f"L{min(level, costs['auto_max_level'])}",
            "engines": {"drift": bool(drift_fire), "peers": bool(peer_fire), "invariants": bool(inv_fire), "graph": bool(graph_fire)},
            "engines_agreeing": n_eng, "model_score": round(float(p), 4), "reasons": reasons[:3],
            "readings": {"js_24h": round(js24, 3), "wasserstein": round(wass, 3), "round_excess": round(round_ex, 3), "cusum": round(cusum, 2),
                         "loop_ratio": round(loop_ratio, 2), "unmatched_refund_share": round(unmatched, 2), "new_distant_excess": round(distant_ex, 3)}}


# --------------------------------------------------------------------------------------
# Building real requests from the artefacts (for the in-app sample, the benchmark and the agreement check)
# --------------------------------------------------------------------------------------
def build_request(code: str, h: int, pay: pd.DataFrame, hourly: pd.DataFrame, merchants: pd.DataFrame, start: pd.Timestamp) -> dict:
    i = int(merchants.merchant_id[merchants.code == code].iloc[0])
    p = pay[(pay.merchant_id == i) & (pay.t_min < (h + 1) * 60) & (pay.t_min >= (h - 167) * 60)].sort_values("t_min")
    ins = p[p.kind == 0]
    rows = []
    paid_amounts = {}
    for r in p.itertuples():
        ha = h - int(r.t_min // 60)
        how = int((start.dayofweek * 24 + r.t_min // 60) % 168)
        if r.kind == 0:
            paid_amounts.setdefault(int(r.payer_id), set()).add(int(r.amount))
            rows.append({"hour_of_week": how, "hours_ago": ha, "amount_inr": int(r.amount), "payer_id": int(r.payer_id), "type": "payment",
                         "in_match_window": bool(r.fp_match), "new_distant_payer": bool(r.fp_newdistant), "refund_matches_payment": False,
                         "payer_paid_in_last_7d": False, "channel": str(r.channel), "payer_city": str(r.payer_city)})
        else:
            earlier = ins[(ins.payer_id == r.payer_id) & (ins.t_min < r.t_min)]
            rows.append({"hour_of_week": how, "hours_ago": ha, "amount_inr": int(r.amount), "payer_id": int(r.payer_id), "type": str(r.type),
                         "in_match_window": False, "new_distant_payer": False,
                         "refund_matches_payment": int(r.amount) in paid_amounts.get(int(r.payer_id), set()),
                         "payer_paid_in_last_7d": len(earlier) > 0, "channel": str(r.channel), "payer_city": str(r.payer_city)})
    hr = hourly[(hourly.merchant_id == i) & (hourly.hour == h)].iloc[0]
    prev = hourly[(hourly.merchant_id == i) & (hourly.hour == max(0, (h // 24) * 24 - 1))].iloc[0]
    context = {"hour_of_week": int((start.dayofweek * 24 + h) % 168), "peer_z": float(hr.peer_z), "peer_persist": int(hr.peer_persist),
               "match_beta": float(hr.match_beta), "match_p": float(hr.match_p), "graph_neglogp": float(hr.graph_neglogp),
               "shared_bettors": int(hr.shared_k), "hard_links": int(hr.hard_links), "peer_median_drift": float(hr.drift_peer_median),
               "cusum_prev": float(prev.cusum) if h >= 24 else 0.0}
    return {"merchant": code, "window_end": str(start + pd.Timedelta(hours=h + 1)), "payments": rows, "context": context}


def load_artifacts():
    m = pd.read_parquet(ART / "merchants.parquet")
    pay = pd.read_parquet(ART / "payments_focus.parquet")
    hourly = pd.read_parquet(ART / "hourly_focus.parquet")
    start = pd.Timestamp(json.loads((ART / "meta.json").read_text())["window_start"])
    return m, pay, hourly, start


def benchmark(n_calls: int = 10_000) -> dict:
    m, pay, hourly, start = load_artifacts()
    codes = ["HERO", "HERO_TWIN", "S1_SWEETS", "S2_SPORTSBAR", "S5", "E1"]
    reqs = []
    for c in codes:
        i = int(m.merchant_id[m.code == c].iloc[0])
        act = hourly[(hourly.merchant_id == i) & hourly.active]
        for h in act.hour.to_numpy()[23::24][-20:]:
            reqs.append(build_request(c, int(h), pay, hourly, m, start))
    lat = []
    for k in range(n_calls):
        r = reqs[k % len(reqs)]
        t = time.perf_counter()
        score_window(r["merchant"], r["payments"], r["context"])
        lat.append((time.perf_counter() - t) * 1000)
    lat = np.array(lat)
    avg_pay = float(np.mean([len(r["payments"]) for r in reqs]))
    return {"calls": n_calls, "distinct_requests": len(reqs), "avg_payments_per_request": avg_pay, "p50_ms": float(np.percentile(lat, 50)),
            "p95_ms": float(np.percentile(lat, 95)), "p99_ms": float(np.percentile(lat, 99)), "note": "Single-threaded Python on a laptop-class CPU"}


def agreement() -> dict:
    """How often the API's per-engine decisions match the full pipeline's on the same merchant-hours."""
    m, pay, hourly, start = load_artifacts()
    rows = []
    for c in ["HERO", "HERO_TWIN", "S1_SWEETS", "S2_SPORTSBAR", "E1", "E3", "S4", "S5"]:
        i = int(m.merchant_id[m.code == c].iloc[0])
        act = hourly[(hourly.merchant_id == i) & hourly.active]
        for h in act.hour.to_numpy()[23::24]:
            req = build_request(c, int(h), pay, hourly, m, start)
            out = score_window(c, req["payments"], req["context"])
            hr = act[act.hour == h].iloc[0]
            rows.append({"merchant": c, "hour": int(h), "api_band": out["band"],
                         "pipe_band": "Act" if hr.level >= 3 else ("Review" if hr.level == 2 else "Watch"),
                         **{f"api_{e}": out["engines"][e] for e in out["engines"]},
                         "pipe_drift": bool(hr.drift_fire), "pipe_peers": bool(hr.peer_fire), "pipe_invariants": bool(hr.invariants_fire), "pipe_graph": bool(hr.graph_fire)})
    df = pd.DataFrame(rows)
    res = {"merchant_days": len(df)}
    for e in ["drift", "peers", "invariants", "graph"]:
        res[f"{e}_agreement"] = float((df[f"api_{e}"] == df[f"pipe_{e}"]).mean())
    res["band_agreement"] = float((df.api_band == df.pipe_band).mean())
    res["act_recall_vs_pipeline"] = float(((df.api_band == "Act") & (df.pipe_band == "Act")).sum() / max((df.pipe_band == "Act").sum(), 1))
    return res


def serve(port: int) -> None:
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class H(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            if self.path != "/score":
                self.send_error(404)
                return
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            t = time.perf_counter()
            out = score_window(body["merchant"], body["payments"], body["context"])
            out["latency_ms"] = round((time.perf_counter() - t) * 1000, 3)
            data = json.dumps(out).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    print(f"PULSE scoring API on http://localhost:{port}/score")
    HTTPServer(("0.0.0.0", port), H).serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--serve", type=int)
    ap.add_argument("--bench", type=int)
    a = ap.parse_args()
    if a.serve:
        serve(a.serve)
    else:
        res = benchmark(a.bench or 10_000)
        res["agreement_with_pipeline"] = agreement()
        (ART / "eval" / "latency.json").write_text(json.dumps(res, indent=1))
        print(json.dumps(res, indent=1))
