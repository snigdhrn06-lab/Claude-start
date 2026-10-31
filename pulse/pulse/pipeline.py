"""End-to-end pipeline. `python -m pulse.pipeline data|train|all` writes artifacts/ (Parquet / JSON)."""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import pickle
import time

import numpy as np
import pandas as pd

from . import evaluate as EV
from . import fusion as FU
from . import response as RS
from .calendar import MIN_PER_DAY, build_calendar
from .config import ROOT, load_config
from .reasons import ReasonContext, top_reasons
from .scoring import ALL_FEATURES, FEATURES, log, run_engines
from .simulate import build_world

FOCUS_SCEN = ["S0", "S1", "S2", "S3", "S4", "S5", "E1", "E2", "E3", "BF"]


def _jsonable(o):
    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else round(float(o), 6)
    if isinstance(o, float):
        return None if np.isnan(o) else round(o, 6)
    if isinstance(o, np.ndarray):
        return _jsonable(o.tolist())
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return str(o)
    return o


def write_json(path: pathlib.Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_jsonable(obj), indent=1, sort_keys=True))


def write_parquet(df: pd.DataFrame, path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.reset_index(drop=True).to_parquet(path, index=False, compression="zstd")


# --------------------------------------------------------------------------------------
# Stage: data
# --------------------------------------------------------------------------------------
def apply_scale(cfg: dict, scale: float) -> dict:
    """Shrink the background population (used by the determinism test); scenario merchants are kept."""
    if scale >= 1:
        return cfg
    for c in cfg["merchant_templates"]["categories"].values():
        c["count"] = max(2, int(round(c["count"] * scale)))
    cfg["scenarios"]["extra_fronts"]["count"] = max(6, int(round(cfg["scenarios"]["extra_fronts"]["count"] * scale)))
    cfg["settings"]["region"]["payer_pool"] = int(cfg["settings"]["region"]["payer_pool"])
    return cfg


def stage_data(cfg: dict, root: pathlib.Path, proc: pathlib.Path) -> None:
    cal = build_calendar(cfg, root)
    w = build_world(cfg, cal, root)
    log(f"world: {len(w['merchants'])} merchants, {len(w['payments']):,} payments")
    proc.mkdir(parents=True, exist_ok=True)
    write_parquet(w["merchants"], proc / "merchants.parquet")
    write_parquet(w["payments"], proc / "payments.parquet")
    write_parquet(w["payers"], proc / "payers.parquet")
    with open(proc / "world_extra.pkl", "wb") as f:
        pickle.dump({"banned": w["banned"], "syndicates": w["syndicates"], "ingest_report": w["ingest_report"],
                     "bakery_how": w["bakery_how"]}, f, protocol=4)


def load_world(proc: pathlib.Path) -> dict:
    with open(proc / "world_extra.pkl", "rb") as f:
        extra = pickle.load(f)
    return {"merchants": pd.read_parquet(proc / "merchants.parquet"), "payments": pd.read_parquet(proc / "payments.parquet"),
            "payers": pd.read_parquet(proc / "payers.parquet"), **extra}


# --------------------------------------------------------------------------------------
# Stage: train + evaluate + artefacts
# --------------------------------------------------------------------------------------
def cohort_lift_daily(F: dict, E: np.ndarray, groups: pd.Series, ticket: np.ndarray, D: int) -> np.ndarray:
    """Peer group's median RUPEE lift per day: log((actual Rs + one ticket) / (baseline Rs + one ticket))."""
    M = len(ticket)
    t = ticket[:, None]
    amt_d = F["amt"].reshape(M, D, 24).sum(axis=2)
    base_d = (E * ticket[:, None]).reshape(M, D, 24).sum(axis=2)
    lift = np.log((amt_d + t) / (base_d + t))
    act_d = F["active"].reshape(M, D, 24).any(axis=2)
    lift = np.where(act_d, lift, np.nan)
    out = np.zeros((M, D), np.float32)
    for g, idx in groups.groupby(groups).groups.items():
        idx = np.asarray(list(idx))
        out[idx] = np.nan_to_num(np.nanmedian(lift[idx], axis=0))[None, :]
    return out


def declared_bill(category: str) -> float:
    from .config import load_config

    return float(load_config()["merchant_templates"]["categories"][category]["bill_median"])


def anchor_ticket(F: dict, anchor: dict, mdf: pd.DataFrame, declared: dict) -> np.ndarray:
    out = np.zeros(len(mdf))
    for i in range(len(mdf)):
        a, b = anchor["from_day"][i], anchor["to_day"][i]
        if a >= 0:
            sl = slice(a * 24, (b + 1) * 24)
            out[i] = F["amt"][i, sl].sum() / max(F["cnt"][i, sl].sum(), 1)
        else:
            # no anchor yet: use the declared category's typical bill
            out[i] = float(declared_bill(mdf.category.iloc[i]))
    return out


def fit_and_score(F: dict, mdf: pd.DataFrame, Y: np.ndarray, cfg: dict, features: list[str], n_engines: np.ndarray):
    daily = FU.daily_table(F, mdf, Y, cols=features)
    calib = FU.calibration_merchants(mdf, cfg)
    model = FU.FusionModel(cfg, features).fit(daily, calib)
    p = model.predict_grid(F)
    lad = RS.ladder(p, n_engines, F["active"], cfg["costs"])
    return model, daily, p, lad


def run_ablation(F, mdf, Y, cfg, cal) -> list[dict]:
    rows = []
    fires = {"drift": F["drift_fire"], "peers": F["peer_fire"], "invariants": F["invariants_fire"], "graph": F["graph_fire"]}
    variants = [("full", None)] + [(f"without {e}", e) for e in FEATURES]
    for name, drop in variants:
        feats = [f for f in ALL_FEATURES if drop is None or f not in FEATURES[drop]]
        ne = sum(v.astype(np.int8) for k, v in fires.items() if k != drop)
        model, daily, p, lad = fit_and_score(F, mdf, Y, cfg, feats, ne)
        summ = EV.merchant_summary(mdf, F, p, lad, cal)
        p_daily = p[daily.merchant_id.to_numpy(), daily.hour.to_numpy()]
        m = EV.core_metrics(mdf, summ, daily, lad, F, p_daily)
        rows.append({"variant": name, **{k: m[k] for k in ["precision_at_10", "precision_at_25", "recall_l2", "merchant_day_pr_auc",
                                                           "false_alarms_l3_per_1000_merchant_months", "detect_hours_median",
                                                           "detect_within_24h_share"]}})
        log(f"ablation {name}: recall {m['recall_l2']:.2f}, PR-AUC {m['merchant_day_pr_auc']:.3f}")
    return rows


def betting_share_weekly(pay: pd.DataFrame, i: int, start_day: int, days: int) -> pd.DataFrame:
    p = pay[(pay.merchant_id == i) & (pay.kind == 0)]
    d = p.t_min // MIN_PER_DAY
    rows = []
    for wk in range((days - start_day) // 7 + 1):
        a, b = start_day + 7 * wk, start_day + 7 * wk + 7
        s = p[(d >= a) & (d < b)]
        if len(s) == 0:
            continue
        # share of the week's payments on match days that are bets
        md = s[s.match_id != ""].t_min // MIN_PER_DAY
        on_md = s[(s.t_min // MIN_PER_DAY).isin(set(md))]
        share = float(on_md.is_bet.mean()) if len(on_md) else 0.0
        rows.append({"week": wk + 1, "from_day": a, "share_match_days": share, "share_all": float(s.is_bet.mean())})
    return pd.DataFrame(rows)


def scenario_scorecard(cfg, mdf, summ, F, lad, pay, reserves) -> list[dict]:
    sc = cfg["scenarios"]["scenarios"]
    S = summ.set_index("merchant_id")
    by = {r.code: r for r in mdf.itertuples()}
    out = []

    def row(sid, merchant, actual, ok, why, report_only=False):
        out.append({"id": sid, "label": sc[sid]["label"], "truth": sc[sid]["truth"], "expected": sc[sid]["expected_text"],
                    "actual": actual, "pass": bool(ok), "merchant": merchant, "report_only": report_only, "explanation": why})

    lvl_name = lambda k: f"L{int(k)}"  # noqa: E731
    i = by["HERO_TWIN"].merchant_id
    ml = S.loc[i, "max_level"]
    row("S0", "HERO_TWIN", f"Max level {lvl_name(ml)} over {cfg['settings']['window']['days']} days", ml <= 0,
        "Real bakery data stays inside its own pattern of life." if ml <= 0 else "An honest real-data bakery reached a level above L0; see Merchant explorer.")
    i = by["S1_SWEETS"].merchant_id
    ml = S.loc[i, "max_level"]
    r1 = reserves["S1_forced"]
    held_forced = float(r1.held.sum())
    held_actual = float(reserves["S1"].held.sum())
    row("S1", "S1_SWEETS", f"Max level {lvl_name(ml)}; reserve held Rs {held_actual:,.0f} (Rs {held_forced:,.0f} even if L3 were forced over Diwali)",
        ml < 2 and held_actual == 0 and held_forced == 0,
        "The whole sweet-shop cohort lifts on Diwali, so the peer gap stays small and Tolerated rises with the cohort.")
    i = by["S2_SPORTSBAR"].merchant_id
    ml = S.loc[i, "max_level"]
    row("S2", "S2_SPORTSBAR", f"Max level {lvl_name(ml)}", ml <= 1,
        "Match nights lift every sports bar; payers are local and nobody is paid back, so the match clock alone cannot escalate.")
    i = by["HERO"].merchant_id
    dh, ma = S.loc[i, "detect_hours"], S.loc[i, "max_level_auto"]
    held = float(reserves["S3"].held.sum())
    row("S3", "HERO", f"Flagged L2+ {dh:.0f} h after the first bet; auto level L{ma}; Rs {held:,.0f} held" if not np.isnan(dh) else "Not flagged",
        (not np.isnan(dh)) and dh <= 24 and ma >= 3 and held > 0, "Timing, round stakes, new distant payers and the shared-bettor graph agree within the first match night.")
    i = by["S4"].merchant_id
    t0 = int(by["S4"].takeover_day)
    ws = betting_share_weekly(pay, i, t0, cfg["settings"]["window"]["days"])
    thr = sc["S4"]["flag_before_share"]
    cross = ws[ws.share_match_days >= thr]
    cross_h = int(cross.from_day.iloc[0]) * 24 if len(cross) else None
    fl = S.loc[i, "first_l2_h"]
    share_at_flag = None
    if fl >= 0:
        wk = ws[ws.from_day <= fl // 24]
        share_at_flag = float(wk.share_match_days.iloc[-1]) if len(wk) else 0.0
    ok = fl >= 0 and (cross_h is None or fl < cross_h)
    row("S4", "S4", f"Flagged at week {int((fl // 24 - t0) // 7 + 1)} when betting share on match days was {100 * share_at_flag:.0f}% (limit {100 * thr:.0f}%)" if fl >= 0 else "Not flagged",
        ok, "The frozen anchor keeps the original bakery as the reference, so the slow ramp cannot teach the model that betting is normal.")
    i = by["S5"].merchant_id
    dh = S.loc[i, "detect_hours"]
    d1 = int(by["S5"].onboard_day)
    g1 = bool(F["graph_fire"][i, d1 * 24:(d1 + 1) * 24].any())
    row("S5", "S5", f"Graph fires on day one: {'yes' if g1 else 'no'}; flagged L2+ {dh:.0f} h after its first payment" if not np.isnan(dh) else f"Graph fires on day one: {g1}; not flagged",
        g1 and (not np.isnan(dh)) and dh <= 24, "12 of its first 20 payers are bettors of a front banned two days earlier, and it shares that front's device ID.")
    for sid, code, lim in [("E1", "E1", 48), ("E3", "E3", 72)]:
        i = by[code].merchant_id
        dh = S.loc[i, "detect_hours"]
        ok = (not np.isnan(dh)) and dh <= lim
        why = {"E1": "Removing round amounts removes one drift signal; timing, the refund loop and the graph remain.",
               "E3": "With no refunds on PayU the loop engine is blind; timing, new distant payers and the graph carry the case. "
                     "Seeing the off-platform payouts would need consented bank data (Earned Trust tier 2)."}[sid]
        row(sid, code, f"Flagged L2+ {dh:.0f} h after the first bet" if not np.isnan(dh) else "Not flagged", ok, why, report_only=True)
    ring = mdf[mdf.scenario == "E2"]
    fl = [S.loc[r.merchant_id, "first_l2_h"] >= 0 for r in ring.itertuples()]
    dhs = [S.loc[r.merchant_id, "detect_hours"] for r in ring.itertuples()]
    linked = int(sum(int(F["graph_front"][r.merchant_id].max()) >= 0 for r in ring.itertuples()))
    share = float(np.mean(fl))
    row("E2", "E2_01", f"{int(sum(fl))} of 10 ring fronts flagged L2+ (median {np.nanmedian(dhs):.0f} h after their first bet); {linked} linked to a banned front through shared bettors",
        share >= sc["E2"]["expected"]["ring_flag_share_ge"],
        "Each ring member is small, so volume engines stay quiet; shared bettors with the banned front link them once that front is banned.", report_only=True)
    order = ["S0", "S1", "S2", "S3", "S4", "S5", "E1", "E2", "E3"]
    return sorted(out, key=lambda r: order.index(r["id"]))


def stage_train(cfg: dict, root: pathlib.Path, proc: pathlib.Path, art: pathlib.Path, ablation: bool = True) -> dict:
    cal = build_calendar(cfg, root)
    world = load_world(proc)
    mdf, pay = world["merchants"], world["payments"]
    M, H, D = len(mdf), cal.H, cal.days
    R = run_engines(world, cal, cfg)
    F, ctx = R["F"], R["ctx"]
    Y = FU.labels_hourly(mdf, H)
    model, daily, p, lad = fit_and_score(F, mdf, Y, cfg, ALL_FEATURES, F["n_engines"])
    pA = FU.scorecard(F, cfg)
    log(f"fusion: best_iter={model.best_iter}")
    summ = EV.merchant_summary(mdf, F, p, lad, cal)
    p_daily = p[daily.merchant_id.to_numpy(), daily.hour.to_numpy()]
    metrics = EV.core_metrics(mdf, summ, daily, lad, F, p_daily)
    # Stage A scorecard measured the same way (shadow mode)
    ladA = RS.ladder(pA, F["n_engines"], F["active"], cfg["costs"])
    summA = EV.merchant_summary(mdf, F, pA, ladA, cal)
    mA = EV.core_metrics(mdf, summA, daily, ladA, F, pA[daily.merchant_id.to_numpy(), daily.hour.to_numpy()])
    log("metrics")

    # ---- fingerprints and delta reserve
    pay_fp = RS.fingerprint_flags(pay, cal, world["payers"], mdf, cfg)
    pin = pay_fp[(pay_fp.kind == 0) & pay_fp.fingerprinted]
    fp_amt = np.bincount(pin.merchant_id.to_numpy().astype(np.int64) * H + pin.t_min.to_numpy() // 60, weights=pin.amount.to_numpy(),
                         minlength=M * H).reshape(M, H)
    ticket = anchor_ticket(F, ctx["anchor"], mdf, ctx["declared"])
    lift_d = cohort_lift_daily(F, ctx["E"], ctx["groups"], ticket, D)
    sigma = np.clip(ctx["anchor"]["daily_std"] / np.maximum(ctx["anchor"]["daily_mean"], 1), 0.1, 1.0)

    def reserve(i, force=False, k=None):
        df = RS.delta_reserve(F["cnt"][i], F["amt"][i], fp_amt[i], ctx["E"][i], ticket[i], lift_d[i], sigma[i],
                              lad["level_auto"][i], cfg["costs"], k=k, force=force)
        df["merchant_id"] = i
        return df

    code_i = dict(zip(mdf.code, mdf.merchant_id))
    reserves = {"S3": reserve(code_i["HERO"]), "S1": reserve(code_i["S1_SWEETS"])}
    diwali = cal.festivals[cal.festivals.categories.str.contains("sweet_shop")]
    dw_days = [cal.day_of(d) for d in diwali.date if "Diwali" in str(diwali.set_index("date").loc[d, "name"]) or "Dhanteras" in str(diwali.set_index("date").loc[d, "name"]) or "Bhai" in str(diwali.set_index("date").loc[d, "name"]) or "Naraka" in str(diwali.set_index("date").loc[d, "name"]) or "Bali" in str(diwali.set_index("date").loc[d, "name"])]
    s1f = reserve(code_i["S1_SWEETS"], force=True)
    s1f = s1f[(s1f.hour // 24).isin(dw_days)]
    reserves["S1_forced"] = s1f
    res_daily = []
    for r in mdf[(mdf.split == "test") & (mdf.truth == "front")].itertuples():
        df = reserve(r.merchant_id)
        g = df.groupby(df.hour // 24).agg(held=("held", "sum"), amount=("amount", "sum"), fingerprinted=("fingerprinted", "sum"))
        g["merchant_id"] = r.merchant_id
        res_daily.append(g.reset_index(names="day"))
    res_daily = pd.concat(res_daily, ignore_index=True)
    money = EV.money_contained(mdf, pay_fp, lad, res_daily)
    log("delta reserve")

    fair = EV.fairness(mdf, summ)
    card = scenario_scorecard(cfg, mdf, summ, F, lad, pay, reserves)
    test_daily = daily[daily.split == "test"]
    rel = FU.reliability(p_daily[test_daily.index], test_daily.y.to_numpy())
    rel_cal = FU.reliability(model.iso.predict(model.cal_raw), model.cal_y)
    abl = run_ablation(F, mdf, Y, cfg, cal) if ablation else []

    # ---- engines lab: measured alarm counts on honest merchants
    hon = (mdf.truth == "honest").to_numpy()
    act = F["active"][hon]
    mh = act.sum()
    z = F["peer_z"][hon]
    over = (z > cfg["engines"]["peers"]["z_threshold"]) & act
    lab = {
        "naive": __import__("pulse.engines.peers", fromlist=["x"]).naive_false_alarms(),
        "honest_merchant_hours": int(mh),
        "per_million": {
            "z_gt_3": float(over.sum() / mh * 1e6),
            "z_gt_3_persistent": float((F["peer_fire"][hon] & act).sum() / mh * 1e6),
            "persistent_and_corroborated": float((F["peer_fire"][hon] & (F["n_engines"][hon] >= 2) & act).sum() / mh * 1e6),
            "ladder_l2_plus": float(((lad["level_raw"][hon] >= 2) & act).sum() / mh * 1e6),
        },
        "engine_fire_rate_honest": {e: float((F[f"{k}_fire"][hon] & act).sum() / mh) for e, k in
                                    [("drift", "drift"), ("peers", "peer"), ("invariants", "invariants"), ("graph", "graph")]},
    }
    front_post = Y.astype(bool) & F["active"]
    lab["engine_fire_rate_front_post"] = {e: float((F[f"{k}_fire"] & front_post).sum() / max(front_post.sum(), 1)) for e, k in
                                          [("drift", "drift"), ("peers", "peer"), ("invariants", "invariants"), ("graph", "graph")]}
    log("engines lab")

    # ---- SHAP + reasons for focus moments
    rctx = ReasonContext(world, cal, {**ctx["anchor"], "declared_how": {c: v["how"] for c, v in ctx["declared"].items()}}, F, cfg)
    focus = mdf[mdf.scenario.isin(FOCUS_SCEN)].merchant_id.to_numpy()
    moments = []
    for i in range(M):
        s = summ.iloc[i]
        act_h = np.where(F["active"][i])[0]
        if len(act_h) == 0:
            continue
        peak = int(act_h[np.argmax(p[i][act_h])])
        moments.append((i, peak, "peak"))
        if s.first_l2_h >= 0:
            moments.append((i, int(s.first_l2_h), "first_l2"))
        if s.first_l3_h >= 0:
            moments.append((i, int(s.first_l3_h), "first_l3"))
    hero = code_i["HERO"]
    T0 = int(mdf.loc[hero, "takeover_t_min"] // 60)
    replay_h = list(range((T0 // 24) * 24 + 12, (T0 // 24) * 24 + 24 * 2 + 12))
    for h in replay_h:
        moments.append((hero, h, "replay"))
    mi = np.array([x[0] for x in moments])
    hi = np.array([x[1] for x in moments])
    X = pd.DataFrame({c: F[c][mi, hi] for c in ALL_FEATURES})
    sv = model.shap(X)
    reasons = []
    for j, (i, h, kind) in enumerate(moments):
        row = dict(zip(ALL_FEATURES, sv[j]))
        rs = top_reasons(rctx, i, h, row) if (kind != "peak" or p[i, h] > 0.02) else []
        reasons.append({"merchant_id": int(i), "code": mdf.code.iloc[i], "hour": int(h), "kind": kind, "p": float(p[i, h]),
                        "level": int(lad["level"][i, h]), "n_engines": int(F["n_engines"][i, h]), "reasons": rs,
                        "shap": {k: float(v) for k, v in row.items()}})
    log("SHAP + reasons")

    # ---- write artefacts
    art.mkdir(parents=True, exist_ok=True)
    mout = mdf.merge(summ, on="merchant_id")
    mout["peer_group"] = ctx["groups"].to_numpy()
    mout["calibration_fold"] = FU.calibration_merchants(mdf, cfg)
    mout["avg_ticket"] = ticket
    write_parquet(mout, art / "merchants.parquet")
    # daily per merchant
    dd = []
    for key in ["p", "pA", "level", "level_auto", "n_engines", "drift_adj", "peers_score", "invariants_score", "graph_score",
                "drift_fire", "peer_fire", "invariants_fire", "graph_fire", "cnt", "amt", "active"]:
        arr = {"p": p, "pA": pA, "level": lad["level"], "level_auto": lad["level_auto"]}.get(key, F.get(key))
        a = arr.reshape(M, D, 24)
        if key in ("cnt", "amt"):
            v = a.sum(axis=2)
        elif key == "active":
            v = a.any(axis=2)
        else:
            v = a.max(axis=2)
        dd.append(v.reshape(-1).astype(np.float32 if v.dtype != bool else bool))
    keys = ["p", "pA", "level", "level_auto", "n_engines", "drift_adj", "peers_score", "invariants_score", "graph_score",
            "drift_fire", "peer_fire", "invariants_fire", "graph_fire", "cnt", "amt", "active"]
    ddf = pd.DataFrame(dict(zip(keys, dd)))
    ddf["merchant_id"] = np.repeat(np.arange(M), D).astype(np.int16)
    ddf["day"] = np.tile(np.arange(D), M).astype(np.int16)
    ddf["y"] = Y.reshape(M, D, 24).max(axis=2).reshape(-1)
    write_parquet(ddf, art / "daily.parquet")
    # hourly for focus merchants
    hcols = ["cnt", "amt", "cnt24", "E24", "lift", "peer_median_lift", "peer_z", "peer_persist", "js_24h", "js_7d", "js_declared",
             "wasserstein", "round_excess", "cusum", "drift_score", "drift_adj", "drift_peer_median", "loop_ratio", "unmatched_share",
             "payout_ratio", "n_payouts_7d", "match_beta", "match_p", "match_share_24h", "distant_excess_24h", "newdist_share_24h",
             "graph_neglogp", "shared_k", "n_payers_30d", "hard_links", "graph_front", "drift_fire", "peer_fire", "invariants_fire",
             "loop_fire", "match_fire", "graph_fire", "n_engines", "peers_score", "invariants_score", "graph_score", "active"]
    hf = []
    for i in focus:
        d = pd.DataFrame({c: F[c][i] for c in hcols})
        d["p"], d["pA"] = p[i], pA[i]
        d["level"], d["level_auto"], d["level_raw"] = lad["level"][i], lad["level_auto"][i], lad["level_raw"][i]
        d["fp_amt"] = fp_amt[i]
        d["E"] = ctx["E"][i]
        d["cohort_lift_day"] = np.repeat(lift_d[i], 24)
        d["merchant_id"] = i
        d["hour"] = np.arange(H)
        hf.append(d)
    hf = pd.concat(hf, ignore_index=True)
    for c in hf.columns:
        if hf[c].dtype == np.float64:
            hf[c] = hf[c].astype(np.float32)
    write_parquet(hf, art / "hourly_focus.parquet")
    pf = pay_fp[pay_fp.merchant_id.isin(focus)].copy()
    write_parquet(pf, art / "payments_focus.parquet")
    # compact engine arrays for the Engines lab sliders
    np.savez_compressed(art / "engines_lab_arrays.npz", peer_z=F["peer_z"].astype(np.float16), active=F["active"],
                        drift_fire=F["drift_fire"], invariants_fire=F["invariants_fire"], graph_fire=F["graph_fire"],
                        honest=hon, drift_adj=F["drift_adj"].astype(np.float16))
    for k, v in reserves.items():
        write_parquet(v, art / f"reserve_{k}.parquet")
    write_parquet(res_daily, art / "reserve_daily_test_fronts.parquet")
    write_json(art / "reasons.json", reasons)
    shifts = ctx["placebo_shifts"]
    write_json(art / "meta.json", {
        "window_start": str(cal.start.date()), "days": cal.days, "baseline_days": cal.baseline_days,
        "fixtures_in_window": cal.fixtures[["match_id", "date", "start_time_ist", "teams", "competition", "format", "day_k", "t_start", "t_end", "w0", "verification"]].to_dict("records"),
        "moments": cal.moments.to_dict("records"), "live_hour": cal.live_hour.astype(int), "match_hour": cal.match_hour.astype(int),
        "festivals": cal.festivals.to_dict("records"), "ingest_report": world["ingest_report"],
        "bakery_how": world["bakery_how"], "banned": [{k: v for k, v in b.items() if k != "bettors"} | {"n_bettors": len(b["bettors"])} for b in world["banned"]],
        "level_thresholds": RS.level_thresholds(cfg["costs"]), "features": FEATURES, "placebo_shifts_first10": shifts[:10],
        "payer_pool": cfg["settings"]["region"]["payer_pool"], "best_iter": model.best_iter, "valid_curve": model.valid_curve,
        "config": cfg,
    })
    ev = art / "eval"
    write_json(ev / "metrics.json", {"stage_c_calibrated_lightgbm": metrics, "stage_a_scorecard": mA})
    write_json(ev / "scenario_scorecard.json", card)
    write_json(ev / "ablation.json", abl)
    write_json(ev / "fairness.json", fair)
    write_json(ev / "reliability.json", {"test": rel.to_dict("records"), "calibration_fold": rel_cal.to_dict("records")})
    write_json(ev / "time_to_detect.json", summ.merge(mdf[["merchant_id", "code", "scenario", "split", "truth", "category"]], on="merchant_id")
               .query("split == 'test' and truth == 'front'")[["code", "scenario", "category", "detect_hours", "detect_hours_l3"]].to_dict("records"))
    write_json(ev / "money_contained.json", money)
    write_json(ev / "engines_lab.json", lab)
    from .artifacts_extra import build_extras
    build_extras(world, cal, cfg, F, ctx, p, lad, summ, reasons, reserves, art, rctx)
    log("artefacts written")
    return {"metrics": metrics, "card": card}


def manifest(art: pathlib.Path) -> dict:
    """Content hashes of every artefact (Parquet hashed by values, so file metadata cannot leak in)."""
    out = {}
    for f in sorted(art.rglob("*")):
        if f.is_dir() or "screenshots" in f.parts or f.name == "manifest.json":
            continue
        if f.suffix == ".parquet":
            df = pd.read_parquet(f)
            h = hashlib.sha256(pd.util.hash_pandas_object(df, index=False).values.tobytes() + str(list(df.columns)).encode()).hexdigest()
        else:
            h = hashlib.sha256(f.read_bytes()).hexdigest()
        out[str(f.relative_to(art))] = h
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["data", "train", "all"])
    ap.add_argument("--out", default=None, help="artefacts directory (default artifacts/)")
    ap.add_argument("--proc", default=None, help="processed data directory (default data/processed/)")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--no-ablation", action="store_true")
    a = ap.parse_args(argv)
    cfg = apply_scale(load_config(), a.scale)
    art = pathlib.Path(a.out) if a.out else ROOT / cfg["settings"]["paths"]["artifacts"]
    proc = pathlib.Path(a.proc) if a.proc else ROOT / cfg["settings"]["paths"]["processed"]
    t = time.time()
    if a.stage in ("data", "all"):
        stage_data(cfg, ROOT, proc)
    if a.stage in ("train", "all"):
        res = stage_train(cfg, ROOT, proc, art, ablation=not a.no_ablation)
        write_json(art / "manifest.json", manifest(art))
        from .report import write_report
        if a.out is None:
            write_report(art, ROOT / "REPORT.md")
        print(json.dumps(_jsonable({k: res["metrics"][k] for k in ["recall_l2", "precision_at_10", "merchant_day_pr_auc",
                                                                    "false_alarms_l3_per_1000_merchant_months", "detect_hours_median"]}), indent=1))
        for r in res["card"]:
            print(f"{r['id']:3s} {'PASS' if r['pass'] else 'FAIL'}  {r['actual']}")
    print(f"done in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
