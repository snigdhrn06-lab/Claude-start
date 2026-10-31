"""Response layer: friction ladder, corroboration, decision rule, delta reserve, earned trust."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY
from .config import rng_for

LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"]


# ---------------------------------------------------------------- decision rule
def level_thresholds(costs: dict) -> dict:
    """Act at L only if p * C_fraud > (1 - p) * C_friction(L)  <=>  p > C_L / (C_fraud + C_L)."""
    cf = costs["c_fraud"]
    return {L: c / (cf + c) for L, c in costs["c_friction"].items()}


def decide_level(p: np.ndarray, n_engines: np.ndarray, costs: dict) -> np.ndarray:
    """Highest level whose cost inequality holds AND whose corroboration requirement is met."""
    thr = level_thresholds(costs)
    lvl = np.zeros(p.shape, np.int8)
    for k, L in enumerate(LEVELS[1:], start=1):
        ok = (p > thr[L]) & (n_engines >= costs["min_engines"][L])
        lvl = np.where(ok, k, lvl)
    return lvl


def hold(levels: np.ndarray, hours: int) -> np.ndarray:
    """A level, once reached, is held for `hours` (cooling-off) - trailing max along axis 1."""
    from scipy.ndimage import maximum_filter1d

    return maximum_filter1d(levels, size=hours, axis=-1, origin=(hours - 1) // 2, mode="constant", cval=0).astype(np.int8)


def ladder(p: np.ndarray, n_engines: np.ndarray, active: np.ndarray, costs: dict) -> dict:
    raw = decide_level(p, n_engines, costs) * active
    held = hold(raw, costs["hold_hours"]) * active
    auto = np.minimum(held, costs["auto_max_level"]).astype(np.int8)
    return {"level_raw": raw.astype(np.int8), "level": held, "level_auto": auto}


# ---------------------------------------------------------------- fingerprints
def fingerprint_flags(pay: pd.DataFrame, cal, payers: pd.DataFrame, merchants: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Betting fingerprints per pay-in: match-window, round amount, new distant payer, loop payer."""
    ic = cfg["engines"]["invariants"]
    p = pay.copy()
    pin = p.kind == 0
    p["fp_match"] = cal.in_windows(p.t_min.to_numpy(), "match") & pin
    p["fp_round"] = (p.amount % cfg["engines"]["drift"]["round_modulus"] == 0) & pin
    first = p[pin].groupby(["merchant_id", "payer_id"]).t_min.transform("min")
    p["first_seen"] = np.nan
    p.loc[pin, "first_seen"] = first
    distant = payers.ward.to_numpy()[p.payer_id.to_numpy()] != merchants.ward.to_numpy()[p.merchant_id.to_numpy()]
    p["fp_newdistant"] = pin & distant & ((p.t_min - p.first_seen) <= ic["new_payer_days"] * MIN_PER_DAY)
    # loop payer: has already received a payout/refund from this merchant in the last 7 days
    out = p[~pin][["merchant_id", "payer_id", "t_min"]].rename(columns={"t_min": "t_out"}).sort_values("t_out")
    ins = p[pin][["merchant_id", "payer_id", "t_min"]].reset_index().sort_values("t_min")
    j = pd.merge_asof(ins, out, left_on="t_min", right_on="t_out", by=["merchant_id", "payer_id"], direction="backward")
    loop = (j.t_min - j.t_out) <= 7 * MIN_PER_DAY
    p["fp_loop"] = False
    p.loc[j["index"].to_numpy()[loop.to_numpy()], "fp_loop"] = True
    p["fingerprinted"] = p.fp_match | p.fp_round | p.fp_newdistant | p.fp_loop
    return p.drop(columns=["first_seen"])


# ---------------------------------------------------------------- delta reserve
def delta_reserve(cnt: np.ndarray, amt: np.ndarray, fp_amt: np.ndarray, E: np.ndarray, avg_ticket: float,
                  cohort_lift_day: np.ndarray, sigma: float, level_auto: np.ndarray, costs: dict,
                  k: float | None = None, force: bool = False) -> pd.DataFrame:
    """Delta reserve per settlement window (one day, settled T+1).

    Tolerated_day = baseline_day x exp(cohort lift_day + k * sigma), where baseline_day is the merchant's own
    expected rupees for that day and the cohort lift is its peer group's median rupee lift that day.
    Held_day = min(surplus above Tolerated_day, rupees carried by fingerprinted payments). It applies if L3 is
    reached before that day's settlement cut-off. The hourly rows split the day's figures for display: the
    hourly Tolerated follows the baseline's hour shape, and Held is allocated to hours in proportion to their
    fingerprinted surplus. `force=True` computes the reserve as if L3 applied (for side-by-side views)."""
    dr = costs["delta_reserve"]
    k = dr["sigma_multiplier"] if k is None else k
    H = len(cnt)
    D = H // 24
    base_h = np.maximum(E * avg_ticket, dr["min_hourly_baseline_inr"] / 24)
    base_d = base_h.reshape(D, 24).sum(axis=1)
    mult_d = np.exp(np.maximum(cohort_lift_day, 0) + k * sigma)
    tol_d = base_d * mult_d
    amt_d = amt.reshape(D, 24).sum(axis=1)
    fp_d = fp_amt.reshape(D, 24).sum(axis=1)
    held_if_d = np.minimum(np.maximum(0, amt_d - tol_d), fp_d)
    cutoff = (np.arange(D) + 1) * 24 + dr["settlement_hour"]
    day_held = np.array([force or bool((level_auto[d * 24: min(H, cutoff[d])] >= 3).any()) for d in range(D)])
    held_d = np.where(day_held, held_if_d, 0.0)
    tol_h = base_h * np.repeat(mult_d, 24)
    w = np.minimum(np.maximum(0, amt - tol_h), fp_amt).reshape(D, 24)
    wsum = w.sum(axis=1, keepdims=True)
    fpw = fp_amt.reshape(D, 24)
    share = np.where(wsum > 0, w / np.maximum(wsum, 1e-9), fpw / np.maximum(fpw.sum(axis=1, keepdims=True), 1e-9))
    held_h = (share * held_d[:, None]).reshape(-1)
    held_h = np.minimum(held_h, fp_amt)  # never more than the fingerprinted rupees in that hour
    return pd.DataFrame({"hour": np.arange(H), "amount": amt, "count": cnt, "baseline": base_h, "tolerated": tol_h,
                         "fingerprinted": fp_amt, "held": held_h, "settled_on_time": amt - held_h, "applies": np.repeat(day_held, 24),
                         "cohort_lift_day": np.repeat(cohort_lift_day, 24), "tolerated_day": np.repeat(tol_d, 24),
                         "held_day": np.repeat(held_d, 24), "sigma": sigma, "k": k})


# ---------------------------------------------------------------- earned trust (simulated consented data)
def consented_features(merchant: pd.Series, settled_inr: float, normal_inr: float, period_is_front: bool, cfg: dict) -> dict:
    """SIMULATED consented bank / GST data. Honest shops move money slowly to suppliers and rent and
    declare their turnover; a front sweeps settlements to many individuals within hours."""
    rng = rng_for(cfg["settings"]["seed"], f"consent-{merchant.code}-{int(period_is_front)}")
    if period_is_front:
        sweep2, sweep6 = rng.beta(10, 3), None
        indiv = rng.beta(8, 3)
    else:
        sweep2, sweep6 = rng.beta(2, 14), None
        indiv = rng.beta(2, 10)
    sweep6 = min(1.0, sweep2 + rng.beta(2, 8))
    gst_turnover = normal_inr * rng.uniform(0.95, 1.1)  # GST declares only the genuine business
    coverage = settled_inr / max(gst_turnover, 1)
    return {"sweep_2h": float(sweep2), "sweep_6h": float(sweep6), "individual_recipients": float(indiv),
            "supplier_rent_share": float(1 - indiv), "gst_coverage": float(coverage)}


def apply_consent(p: float, feats: dict | None, tier: int, cfg: dict) -> dict:
    """Update the calibrated score with consented evidence (log-likelihood-ratio weights are design
    parameters). No consent (tier 0) changes nothing: refusing is never a penalty."""
    et = cfg["costs"]["earned_trust"]
    if tier == 0 or feats is None:
        return {"p": p, "delta_logit": 0.0, "k": et["sigma_multiplier_by_tier"][0], "perk": et["tiers"][0]["perk"], "terms": {}}
    w = et["llr_weights"]
    terms = {}
    if tier >= 1:
        terms["gst_gap"] = w["gst_gap"] * float(np.clip(np.log(max(feats["gst_coverage"], 1e-3)) - 0.2, -0.5, 3))
    if tier >= 2:
        terms["sweep_2h"] = w["sweep_2h"] * float(np.clip(feats["sweep_2h"] - 0.25, -0.15, 1))
        terms["individual_recipients"] = w["individual_recipients"] * float(np.clip(feats["individual_recipients"] - 0.30, -0.15, 1))
    dl = sum(terms.values())
    lg = np.log(max(p, 1e-6) / max(1 - p, 1e-6)) + dl
    p2 = float(1 / (1 + np.exp(-lg)))
    confirms = dl <= 0
    return {"p": p2, "delta_logit": float(dl), "terms": terms,
            "k": et["sigma_multiplier_by_tier"][tier] if confirms else et["sigma_multiplier_by_tier"][0],
            "perk": et["tiers"][tier]["perk"] if confirms else "No perks: consented data contradicts the declared business"}
