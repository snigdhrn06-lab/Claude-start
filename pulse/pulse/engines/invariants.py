"""Engine 3: what betting can't hide (closed loop, match clock)."""
from __future__ import annotations

import numpy as np

from ..config import rng_for
from ..features import window_sum


# ---------------------------------------------------------------- pure functions (unit-tested)
def loop_ratio(payers_in: set, recipients: set) -> float:
    """|A intersect B| / |B|: share of payout recipients who also paid in."""
    if not recipients:
        return 0.0
    return len(set(payers_in) & set(recipients)) / len(set(recipients))


def match_beta(y1, e1, y0, e0, s: float = 0.5):
    """Poisson GLM with offset and a binary live-match indicator has a closed-form MLE:
    beta = log((Y1/E1) / (Y0/E0)). A 0.5 pseudo-count keeps it finite."""
    return np.log((y1 + s) / (e1 + s)) - np.log((y0 + s) / (e0 + s))


def placebo_shifts(H: int, n: int, min_shift: int, seed: int) -> np.ndarray:
    rng = rng_for(seed, "placebo")
    return rng.integers(min_shift, H - min_shift, size=n)


# ---------------------------------------------------------------- hourly computation
def compute_loop(T: dict, cfg: dict) -> dict:
    ic = cfg["engines"]["invariants"]
    w = ic["window_hours"]
    n = window_sum(T["rcnt"], w)
    safe = np.maximum(n, 1)
    ratio = window_sum(T["r_matched"], w) / safe
    unmatched = window_sum(T["r_unmatched"], w) / safe
    fast = window_sum(T["r_fast"], w) / safe
    logr = window_sum(T["r_logratio"], w) / safe
    payout_ratio = window_sum(T["ramt"], w) / np.maximum(window_sum(T["amt"], w), 1)
    lc = ic["loop"]
    fire = (n >= lc["min_payouts"]) & (ratio >= lc["loop_ratio"]) & (unmatched >= lc["unmatched_share"]) & (payout_ratio >= lc["payout_ratio_min"])
    score = ratio * unmatched * np.clip(payout_ratio / (2 * lc["payout_ratio_min"]), 0, 1) * np.clip(n / lc["min_payouts"], 0, 1)
    return {"n_payouts_7d": n, "loop_ratio": ratio, "unmatched_share": unmatched, "fast_payout_share": fast,
            "log_payout_to_payin": np.where(n > 0, logr, 0).astype(np.float32), "payout_ratio": payout_ratio.astype(np.float32),
            "loop_score": score.astype(np.float32), "loop_fire": fire}


def compute_match_clock(cnt: np.ndarray, E: np.ndarray, live: np.ndarray, active: np.ndarray, cfg: dict, seed: int) -> dict:
    """beta = log rate ratio of pay-ins in live-match hours vs other hours, against the merchant's
    own hour-of-week baseline (offset), over a trailing 14-day window. Placebo p-value = share of
    1,000 shifted fixture calendars whose beta >= the real beta."""
    mc = cfg["engines"]["invariants"]["match_clock"]
    M, H = cnt.shape
    w = mc["window_hours"]
    shifts = placebo_shifts(H, mc["n_placebo"], mc["min_shift_hours"], seed)
    Lp = np.stack([np.roll(live, s) for s in shifts]).astype(np.float32)  # (P, H)
    Lr = live.astype(np.float32)
    beta = np.zeros((M, H), np.float32)
    pval = np.ones((M, H), np.float32)
    mu = (E + 0.02).astype(np.float32)  # floor so that closed hours still have a tiny expectation
    pre = mc.get("placebo_min_beta", 0.5)
    for i in range(M):
        y, e = cnt[i].astype(np.float32), mu[i]
        Y = window_sum(y[None, :], w)[0]
        Ev = window_sum(e[None, :], w)[0]
        Y1 = window_sum((y * Lr)[None, :], w)[0]
        E1 = window_sum((e * Lr)[None, :], w)[0]
        b = match_beta(Y1, E1, Y - Y1, Ev - E1)
        beta[i] = b
        # The placebo test only matters where the real beta could fire; elsewhere p is reported as 1.
        sel = np.where((b >= pre) & active[i])[0]
        if len(sel) == 0:
            continue
        cy = np.concatenate([np.zeros((len(shifts), 1), np.float32), np.cumsum(y[None, :] * Lp, axis=1, dtype=np.float32)], axis=1)
        ce = np.concatenate([np.zeros((len(shifts), 1), np.float32), np.cumsum(e[None, :] * Lp, axis=1, dtype=np.float32)], axis=1)
        lo = np.maximum(sel + 1 - w, 0)
        Y1p = cy[:, sel + 1] - cy[:, lo]
        E1p = ce[:, sel + 1] - ce[:, lo]
        bp = match_beta(Y1p, E1p, Y[None, sel] - Y1p, Ev[None, sel] - E1p)
        pval[i, sel] = (bp >= b[None, sel]).mean(axis=0)
    beta = np.where(active, beta, 0)
    pval = np.where(active, pval, 1)
    return {"match_beta": beta.astype(np.float32), "match_p": pval.astype(np.float32), "placebo_shifts": shifts}


def invariants_summary(T: dict, loop: dict, mclock: dict, anchor: dict, cfg: dict) -> dict:
    ic = cfg["engines"]["invariants"]
    mc = ic["match_clock"]
    a = cfg["engines"]["drift"]["shrink_24h"]
    cnt24 = window_sum(T["cnt"], 24)
    d0 = anchor["distant_share"][:, None]
    distant24 = (window_sum(T["distant"], 24) + a * d0) / (cnt24 + a)
    distant_excess = np.clip(distant24 - d0, 0, 1)
    match_share24 = window_sum(T["inmatch"], 24) / np.maximum(cnt24, 1)
    cnt7 = window_sum(T["cnt"], 168)
    match_share7 = window_sum(T["inmatch"], 168) / np.maximum(cnt7, 1)
    newdist24 = window_sum(T["newdist"], 24) / np.maximum(cnt24, 1)
    burst24 = window_sum(T["burst"], 24) / np.maximum(cnt24, 1)
    match_fire = (mclock["match_beta"] >= mc["beta_threshold"]) & (mclock["match_p"] <= mc["p_threshold"]) & (distant_excess >= mc["distant_new_excess"])
    match_score = np.clip(mclock["match_beta"] / (2 * mc["beta_threshold"]), 0, 1) * (mclock["match_p"] <= mc["p_threshold"]) * np.clip(distant_excess / (2 * mc["distant_new_excess"]), 0, 1)
    score = np.maximum(loop["loop_score"], match_score)
    return {"distant_excess_24h": distant_excess.astype(np.float32), "match_share_24h": match_share24.astype(np.float32),
            "match_share_7d": match_share7.astype(np.float32),
            "match_share_excess": np.clip(match_share7 - anchor["match_share"][:, None], 0, 1).astype(np.float32),
            "newdist_share_24h": newdist24.astype(np.float32), "burst_share_24h": burst24.astype(np.float32),
            "match_fire": match_fire, "invariants_score": score.astype(np.float32), "invariants_fire": loop["loop_fire"] | match_fire}
