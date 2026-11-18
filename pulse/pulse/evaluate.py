"""Evaluation on TEST merchants only (simulated data). Thresholds and costs are frozen before this runs."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score

from .calendar import MIN_PER_DAY


def merchant_summary(mdf: pd.DataFrame, F: dict, p: np.ndarray, lad: dict, cal) -> pd.DataFrame:
    """One row per merchant: peak score, first L2+/L3+ hour, detection delay, max levels."""
    M, H = p.shape
    lvl, auto = lad["level"], lad["level_auto"]
    start_h = np.maximum(mdf.onboard_day.to_numpy() * 24, 0)
    t_h = (mdf.takeover_t_min.to_numpy() // 60)
    rows = []
    for i in range(M):
        act = F["active"][i]
        is_front = mdf.truth.iloc[i] in ("front", "banned_front")
        th = t_h[i] if is_front and not np.isnan(t_h[i]) else None
        post = np.arange(H) >= (th if th is not None else 0)
        l2 = np.where((lvl[i] >= 2) & act & post)[0]
        l3 = np.where((auto[i] >= 3) & act & post)[0]
        pre_l2 = np.where((lvl[i] >= 2) & act & (np.arange(H) < (th if th is not None else H)))[0]
        rows.append({
            "merchant_id": i,
            "max_p": float(p[i][act].max()) if act.any() else 0.0,
            "max_p_post": float(p[i][act & post].max()) if (act & post).any() else 0.0,
            "max_level": int(lvl[i][act].max()) if act.any() else 0,
            "max_level_auto": int(auto[i][act].max()) if act.any() else 0,
            "first_l2_h": int(l2[0]) if len(l2) else -1,
            "first_l3_h": int(l3[0]) if len(l3) else -1,
            "detect_hours": float(l2[0] - th) if (th is not None and len(l2)) else np.nan,
            "detect_hours_l3": float(l3[0] - th) if (th is not None and len(l3)) else np.nan,
            "pre_takeover_l2": int(len(pre_l2) > 0) if is_front else 0,
            "l2_hours": int(((lvl[i] >= 2) & act).sum()),
            "active_hours": int(act.sum()),
            "max_engines": int(F["n_engines"][i][act].max()) if act.any() else 0,
        })
    _ = start_h, cal
    return pd.DataFrame(rows)


def episodes(level_row: np.ndarray, thr: int) -> int:
    above = level_row >= thr
    return int((above & ~np.r_[False, above[:-1]]).sum())


def precision_at_k(scores: np.ndarray, y: np.ndarray, k: int) -> float:
    order = np.argsort(-scores, kind="mergesort")[:k]
    return float(y[order].mean()) if len(order) else 0.0


def core_metrics(mdf: pd.DataFrame, summ: pd.DataFrame, daily: pd.DataFrame, lad: dict, F: dict, p_daily: np.ndarray) -> dict:
    test = (mdf.split == "test").to_numpy()
    is_front = mdf.truth.isin(["front", "banned_front"]).to_numpy()
    s = summ[test]
    y = is_front[test].astype(int)
    out = {"n_test_merchants": int(test.sum()), "n_test_fronts": int(y.sum()), "n_test_honest": int((1 - y).sum())}
    score = s.max_p_post.to_numpy()
    for k in (10, 25, 50):
        out[f"precision_at_{k}"] = precision_at_k(score, y, k)
    flagged = s.first_l2_h.to_numpy() >= 0
    out["recall_l2"] = float(flagged[y == 1].mean())
    out["recall_l3"] = float((s.first_l3_h.to_numpy() >= 0)[y == 1].mean())
    out["merchant_pr_auc"] = float(average_precision_score(y, score))
    dt = daily[daily.split == "test"]
    out["merchant_day_pr_auc"] = float(average_precision_score(dt.y, p_daily[dt.index]))
    out["merchant_day_base_rate"] = float(dt.y.mean())
    # false alarms: honest test merchants entering L3+ (episodes) per 1,000 merchant-months
    hon_idx = np.where(test & ~is_front)[0]
    eps = sum(episodes(lad["level"][i][F["active"][i]], 3) for i in hon_idx)
    months = sum(F["active"][i].sum() for i in hon_idx) / (24 * 30.4)
    out["false_alarm_l3_episodes"] = int(eps)
    out["honest_merchant_months"] = float(months)
    out["false_alarms_l3_per_1000_merchant_months"] = float(1000 * eps / months) if months else 0.0
    eps2 = sum(episodes(lad["level"][i][F["active"][i]], 2) for i in hon_idx)
    out["false_alarms_l2_per_1000_merchant_months"] = float(1000 * eps2 / months) if months else 0.0
    out["honest_ever_l2_share"] = float((s.max_level.to_numpy()[y == 0] >= 2).mean())
    out["honest_ever_l3_share"] = float((s.max_level.to_numpy()[y == 0] >= 3).mean())
    d = s.detect_hours.to_numpy()[y == 1]
    d = d[~np.isnan(d)]
    out["detect_hours_median"] = float(np.median(d)) if len(d) else None
    out["detect_hours_p90"] = float(np.percentile(d, 90)) if len(d) else None
    out["detect_within_24h_share"] = float((d <= 24).sum() / max(y.sum(), 1))
    return out


def money_contained(mdf: pd.DataFrame, pay_fp: pd.DataFrame, lad: dict, reserve_daily: pd.DataFrame) -> dict:
    """Rs held at L3 vs Rs betting volume that settled out before the first flag (test fronts)."""
    test_fronts = mdf[(mdf.split == "test") & (mdf.truth == "front")]
    rows = []
    for _, r in test_fronts.iterrows():
        i = r.merchant_id
        bets = pay_fp[(pay_fp.merchant_id == i) & pay_fp.is_bet & (pay_fp.kind == 0)]
        l3 = np.where(lad["level_auto"][i] >= 3)[0]
        first = l3.min() if len(l3) else np.inf
        bday = bets.t_min // MIN_PER_DAY
        settle_h = (bday + 1) * 24 + 11
        settled_before = float(bets.amount[settle_h < first].sum())
        held = float(reserve_daily[reserve_daily.merchant_id == i].held.sum()) if len(reserve_daily) else 0.0
        rows.append({"merchant_id": int(i), "code": r.code, "betting_inr": float(bets.amount.sum()),
                     "settled_before_flag_inr": settled_before, "held_inr": held})
    df = pd.DataFrame(rows)
    return {"per_merchant": df.to_dict("records"),
            "total_betting_inr": float(df.betting_inr.sum()) if len(df) else 0.0,
            "total_settled_before_flag_inr": float(df.settled_before_flag_inr.sum()) if len(df) else 0.0,
            "total_held_inr": float(df.held_inr.sum()) if len(df) else 0.0}


def fairness(mdf: pd.DataFrame, summ: pd.DataFrame) -> list[dict]:
    """Flag rates among honest test merchants by city tier, size band and category."""
    s = summ.merge(mdf[["merchant_id", "tier", "category", "split", "truth", "base_daily_tx"]], on="merchant_id")
    s = s[(s.split == "test") & (s.truth == "honest")].copy()
    s["size_band"] = pd.qcut(s.base_daily_tx.rank(method="first"), 3, labels=["small", "medium", "large"])
    out = []
    for dim in ["tier", "size_band", "category"]:
        for v, g in s.groupby(dim, observed=True):
            out.append({"dimension": dim, "value": str(v), "n": int(len(g)), "ever_l1": float((g.max_level >= 1).mean()),
                        "ever_l2": float((g.max_level >= 2).mean()), "ever_l3": float((g.max_level >= 3).mean())})
    return out


def real_shops_report(mdf: pd.DataFrame, summ: pd.DataFrame, summA: pd.DataFrame, F: dict, pay: pd.DataFrame,
                      reserve_fn, cal) -> dict:
    """Out-of-sample false-alarm test on real honest shops (split == 'real'). Nothing here was used to train or tune."""
    real = mdf[mdf.split == "real"]
    if real.empty:
        return {"summary": {"shops": 0}, "shops": []}
    S, SA = summ.set_index("merchant_id"), summA.set_index("merchant_id")
    cnt = pay.groupby(["merchant_id", "kind"]).size().unstack(fill_value=0)
    rows = []
    for r in real.itertuples():
        i = int(r.merchant_id)
        act = F["active"][i]
        ah = int(act.sum())
        fires = {k: float((F[f"{k}_fire"][i] & act).sum() / max(ah, 1)) for k in ("drift", "peer", "invariants", "graph")}
        two = float(((F["n_engines"][i] >= 2) & act).sum() / max(ah, 1))
        held = float(reserve_fn(i).held.sum()) if int(S.loc[i, "max_level_auto"]) >= 3 else 0.0
        rows.append({
            "merchant_id": i, "code": r.code, "name": r.name, "source": r.data_source, "city": r.city,
            "payments": int(cnt.loc[i, 0]) if 0 in cnt.columns and i in cnt.index else 0,
            "refunds": int(cnt.loc[i, 1]) if 1 in cnt.columns and i in cnt.index else 0,
            "per_day": round(float(r.base_daily_tx), 2),
            "scored_days": round(ah / 24, 1),
            "max_level": int(S.loc[i, "max_level"]), "max_level_auto": int(S.loc[i, "max_level_auto"]),
            "max_level_stage_a": int(SA.loc[i, "max_level"]),
            "max_score": round(float(S.loc[i, "max_p"]), 4),
            "first_l2": str((cal.start + pd.Timedelta(hours=int(S.loc[i, "first_l2_h"]))).date()) if S.loc[i, "first_l2_h"] >= 0 else None,
            "fire_share": {k: round(v, 4) for k, v in fires.items()},
            "two_engine_share": round(two, 4),
            "held_inr": round(held),
        })
    df = pd.DataFrame(rows)
    months = df.scored_days.sum() / 30.44
    summary = {
        "shops": int(len(df)),
        "by_source": df.source.value_counts().to_dict(),
        "payments": int(df.payments.sum()), "refunds": int(df.refunds.sum()),
        "merchant_months": round(float(months), 1),
        "ever_l1": int((df.max_level >= 1).sum()), "ever_l2": int((df.max_level >= 2).sum()),
        "ever_l3": int((df.max_level_auto >= 3).sum()),
        "ever_l2_stage_a": int((df.max_level_stage_a >= 2).sum()),
        "l3_per_1000_merchant_months": round(float((df.max_level_auto >= 3).sum() / max(months, 1e-9) * 1000), 1),
        "held_inr": round(float(df.held_inr.sum())),
        "engine_fire_share": {k: round(float(np.mean([x[k] for x in df.fire_share])), 4) for k in ("drift", "peer", "invariants", "graph")},
        "two_engine_share": round(float(df.two_engine_share.mean()), 4),
    }
    return {"summary": summary, "shops": rows}
