"""Engine 4: network graph of payers and merchants, seeded with known banned fronts."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import hypergeom

KIND_PAYIN = 0


# ---------------------------------------------------------------- pure functions (unit-tested)
def expected_shared(pool: int, front_bettors: int, merchant_payers: int) -> float:
    """Expected number of shared payers by chance = n * K / N (hypergeometric mean)."""
    return merchant_payers * front_bettors / pool


def shared_pvalue(k, pool, front_bettors, merchant_payers):
    """P(X >= k) for X ~ Hypergeometric(N=pool, K=front_bettors, n=merchant_payers)."""
    k = np.asarray(k)
    return np.where(k <= 0, 1.0, hypergeom.sf(k - 1, pool, front_bettors, merchant_payers))


def adamic_adar(shared_payers, degree: dict) -> float:
    """Sum over shared payers u of 1 / log(deg(u)) (deg floored at 2)."""
    return float(sum(1.0 / np.log(max(degree.get(u, 2), 2)) for u in shared_payers))


def _sf_unique(k: np.ndarray, n: np.ndarray, N: int, K: int) -> np.ndarray:
    """Exact hypergeometric tail, evaluated once per distinct (k, n) pair (many merchant-hours share them)."""
    key = k.astype(np.int64) * 1_000_000 + n.astype(np.int64)
    u, inv = np.unique(key, return_inverse=True)
    uk, un = u // 1_000_000, u % 1_000_000
    pv = hypergeom.sf(uk - 1, N, K, un)
    return pv[inv]


# ---------------------------------------------------------------- hourly computation
def _distinct_window(m, payer, h, weight, M, H, w):
    """Weighted count of DISTINCT payers per merchant over trailing windows of w hours.

    Each (merchant, payer, hour) occurrence covers windows ending in [h, min(next occurrence, h + w)).
    """
    order = np.lexsort((h, payer, m))
    m, payer, h, weight = m[order], payer[order], h[order], weight[order]
    same_next = np.r_[(m[1:] == m[:-1]) & (payer[1:] == payer[:-1]), False]
    nxt = np.where(same_next, np.r_[h[1:], 0], H)
    end = np.minimum(nxt, h + w)
    end = np.minimum(end, H)
    keep = end > h
    diff = np.zeros(M * (H + 1))
    np.add.at(diff, m[keep] * (H + 1) + h[keep], weight[keep])
    np.add.at(diff, m[keep] * (H + 1) + end[keep], -weight[keep])
    return np.cumsum(diff.reshape(M, H + 1), axis=1)[:, :H].astype(np.float32)


def payer_degree(pay: pd.DataFrame, baseline_minutes: int, n_payers: int) -> np.ndarray:
    """Number of distinct merchants each payer paid during the baseline period."""
    b = pay[(pay.kind == KIND_PAYIN) & (pay.t_min < baseline_minutes)][["payer_id", "merchant_id"]].drop_duplicates()
    return np.bincount(b.payer_id.to_numpy(), minlength=n_payers)


def compute_graph(world: dict, cal, cfg: dict) -> dict:
    gc = cfg["engines"]["graph"]
    mdf = world["merchants"]
    pay = world["payments"]
    M, H = len(mdf), cal.H
    N = cfg["settings"]["region"]["payer_pool"]
    pin = pay[pay.kind == KIND_PAYIN]
    m = pin.merchant_id.to_numpy().astype(np.int64)
    p = pin.payer_id.to_numpy().astype(np.int64)
    h = (pin.t_min.to_numpy() // 60).astype(np.int64)
    key = np.unique((m * H + h) * N + p)
    p = key % N
    mh = key // N
    m, h = mh // H, mh % H
    w = gc["window_hours"]
    n_win = _distinct_window(m, p, h, np.ones(len(m)), M, H, w)
    deg = payer_degree(pay, cal.baseline_days * 1440, N)
    aa_w = 1.0 / np.log(np.maximum(deg + 1, 2))
    banned = world["banned"]
    best_logp = np.zeros((M, H), np.float32)
    best_k = np.zeros((M, H), np.float32)
    best_aa = np.zeros((M, H), np.float32)
    best_front = np.full((M, H), -1, np.int16)
    n_known = np.zeros(H, np.int32)
    for j, bf in enumerate(banned):
        ban_h = bf["ban_t_min"] // 60
        n_known[ban_h:] += 1
    for j, bf in enumerate(banned):
        ban_h = bf["ban_t_min"] // 60
        is_b = np.isin(p, bf["bettors"])
        k = _distinct_window(m[is_b], p[is_b], h[is_b], np.ones(int(is_b.sum())), M, H, w)
        aa = _distinct_window(m[is_b], p[is_b], h[is_b], aa_w[p[is_b]], M, H, w)
        K = len(bf["bettors"])
        valid = np.zeros((M, H), bool)
        valid[:, ban_h:] = True
        valid[bf["merchant_id"], :] = False
        cand = valid & (k >= gc["min_shared"])
        logp = np.zeros((M, H), np.float32)
        if cand.any():
            pv = _sf_unique(k[cand], n_win[cand], N, K)
            adj = np.minimum(1.0, pv * np.maximum(n_known[np.where(cand)[1]], 1))
            logp[cand] = np.minimum(-np.log10(np.maximum(adj, 1e-300)), 30)
        better = logp > best_logp
        best_logp = np.where(better, logp, best_logp)
        best_k = np.where(better, k, best_k)
        best_aa = np.maximum(best_aa, np.where(valid, aa, 0))
        best_front = np.where(better, j, best_front)
    # hard links: shared device, director or settlement account with a banned front (after its ban)
    hard = np.zeros((M, H), np.float32)
    for bf in banned:
        row = mdf.loc[bf["merchant_id"]]
        ban_h = bf["ban_t_min"] // 60
        link = ((mdf.device_id == row.device_id) | (mdf.director_id == row.director_id) |
                (mdf.settlement_account == row.settlement_account)).to_numpy()
        link[bf["merchant_id"]] = False
        hard[link, ban_h:] += 1
    thr = -np.log10(gc["p_threshold"])
    fire = (best_logp >= thr) | (hard >= 1)
    score = np.maximum(np.clip(best_logp / (2 * thr), 0, 1), np.where(hard >= 1, 0.8, 0))
    return {"graph_neglogp": best_logp, "shared_k": best_k, "n_payers_30d": n_win, "aa_score": best_aa,
            "hard_links": hard, "graph_front": best_front, "graph_fire": fire, "graph_score": score.astype(np.float32),
            "payer_degree": deg}
