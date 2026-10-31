"""Engine 1: drift from its own past (and from its declared business profile)."""
from __future__ import annotations

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from ..features import window_sum


# ---------------------------------------------------------------- pure functions (unit-tested)
def js_divergence(p: np.ndarray, q: np.ndarray, axis: int = -1) -> np.ndarray:
    """Jensen-Shannon divergence, base 2, in [0, 1]. Inputs are normalised along `axis`."""
    p = p / np.maximum(p.sum(axis=axis, keepdims=True), 1e-12)
    q = q / np.maximum(q.sum(axis=axis, keepdims=True), 1e-12)
    m = 0.5 * (p + q)
    with np.errstate(divide="ignore", invalid="ignore"):
        kp = np.where(p > 0, p * np.log2(p / np.maximum(m, 1e-300)), 0.0)
        kq = np.where(q > 0, q * np.log2(q / np.maximum(m, 1e-300)), 0.0)
    return np.clip(0.5 * kp.sum(axis=axis) + 0.5 * kq.sum(axis=axis), 0.0, 1.0)


def wasserstein_hist(p: np.ndarray, q: np.ndarray, edges: np.ndarray, axis: int = -1) -> np.ndarray:
    """1-D Wasserstein distance between two histograms on the same bins (units of the bin axis)."""
    p = p / np.maximum(p.sum(axis=axis, keepdims=True), 1e-12)
    q = q / np.maximum(q.sum(axis=axis, keepdims=True), 1e-12)
    width = np.diff(edges)
    return (np.abs(np.cumsum(p, axis=axis) - np.cumsum(q, axis=axis)) * width).sum(axis=axis)


def cusum_upper(z: np.ndarray, k: float) -> np.ndarray:
    """Upper CUSUM S_t = max(0, S_{t-1} + z_t - k) along the last axis."""
    s = np.zeros_like(z, dtype=float)
    prev = np.zeros(z.shape[:-1])
    for t in range(z.shape[-1]):
        prev = np.maximum(0.0, prev + z[..., t] - k)
        s[..., t] = prev
    return s


def noisy_or(parts: dict, refs: dict, weights: dict, floors: dict | None = None) -> np.ndarray:
    keep = None
    floors = floors or {}
    for k, x in parts.items():
        f = floors.get(k, 0.0)
        c = weights[k] * np.clip((x - f) / (refs[k] - f), 0, 1)
        keep = (1 - c) if keep is None else keep * (1 - c)
    return 1 - keep


# ---------------------------------------------------------------- hourly computation
def _shrunk_js(counts_win: np.ndarray, base_win: np.ndarray, alpha: float, eps: np.ndarray) -> np.ndarray:
    q = base_win + eps[:, None, None]
    q = q / q.sum(axis=2, keepdims=True)
    n = counts_win.sum(axis=2, keepdims=True)
    p = (counts_win + alpha * q) / (n + alpha)
    return js_divergence(p, q, axis=2)


def compute_drift(T: dict, E: np.ndarray, E_roll: np.ndarray | None, anchor: dict, declared_E: np.ndarray,
                  hist_base: np.ndarray, hist_roll_h: np.ndarray | None, round_roll_h: np.ndarray | None,
                  dec_hist: np.ndarray, cfg: dict, chunk: int = 24) -> dict:
    """All drift components on the (M, H) grid.

    E: expected hourly pay-ins under the frozen anchor (declared profile until the anchor exists).
    E_roll: expected hourly pay-ins under the rolling baseline (None on the first pass).
    declared_E: expected hourly pay-ins under the KYB-declared category profile.
    """
    dc = cfg["engines"]["drift"]
    cnt = T["cnt"]
    M, H = cnt.shape
    edges = T["edges"]
    a24, a7 = dc["shrink_24h"], dc["shrink_7d"]
    out = {k: np.zeros((M, H), np.float32) for k in ["js_24h", "js_7d", "js_declared", "wasserstein", "round_excess",
                                                       "js_24h_roll", "js_7d_roll", "wasserstein_roll", "round_excess_roll"]}
    pad24 = lambda x: np.concatenate([np.zeros((x.shape[0], 23), x.dtype), x], axis=1)  # noqa: E731
    pad168 = lambda x: np.concatenate([np.zeros((x.shape[0], 167), x.dtype), x], axis=1)  # noqa: E731
    hist24 = window_sum(T["hist"].astype(np.float32), 24)  # (M, H, B)
    cnt24 = window_sum(cnt, 24)
    rnd24 = window_sum(T["rnd"], 24)
    for s in range(0, M, chunk):
        sl = slice(s, min(M, s + chunk))
        c = cnt[sl]
        eps = 0.01 * E[sl].mean(axis=1) + 1e-3
        cw24 = sliding_window_view(pad24(c), 24, axis=1)
        out["js_24h"][sl] = _shrunk_js(cw24, sliding_window_view(pad24(E[sl]), 24, axis=1), a24, eps)
        cw7 = sliding_window_view(pad168(c), 168, axis=1)
        out["js_7d"][sl] = _shrunk_js(cw7, sliding_window_view(pad168(E[sl]), 168, axis=1), a7, eps)
        eps_d = 0.01 * declared_E[sl].mean(axis=1) + 1e-3
        out["js_declared"][sl] = _shrunk_js(cw7, sliding_window_view(pad168(declared_E[sl]), 168, axis=1), a7, eps_d)
        if E_roll is not None:
            eps_r = 0.01 * E_roll[sl].mean(axis=1) + 1e-3
            out["js_24h_roll"][sl] = _shrunk_js(cw24, sliding_window_view(pad24(E_roll[sl]), 24, axis=1), a24, eps_r)
            out["js_7d_roll"][sl] = _shrunk_js(cw7, sliding_window_view(pad168(E_roll[sl]), 168, axis=1), a7, eps_r)
        # amounts (24 h window), shrunk toward the baseline histogram
        hw = hist24[sl]
        n = hw.sum(axis=2, keepdims=True)
        q = hist_base[sl][:, None, :]
        p = (hw + a24 * q) / (n + a24)
        out["wasserstein"][sl] = wasserstein_hist(p, np.broadcast_to(q, p.shape), edges, axis=2)
        if hist_roll_h is not None:
            qr = hist_roll_h[sl]
            pr = (hw + a24 * qr) / (n + a24)
            out["wasserstein_roll"][sl] = wasserstein_hist(pr, qr, edges, axis=2)
    r0 = anchor["round"][:, None]
    out["round_excess"] = np.clip((rnd24 + a24 * r0) / (cnt24 + a24) - r0, 0, 1)
    if round_roll_h is not None:
        out["round_excess_roll"] = np.clip((rnd24 + a24 * round_roll_h) / (cnt24 + a24) - round_roll_h, 0, 1)
    # CUSUM on standardised volume: hourly value uses the trailing-24 h count; state carries day to day
    E24 = window_sum(E, 24)
    sd24 = np.maximum(anchor["daily_std"][:, None] * E24 / np.maximum(anchor["daily_mean"][:, None], 1e-6), np.sqrt(np.maximum(E24, 1)))
    z24 = (cnt24 - E24) / sd24
    # CUSUM accumulates only once the frozen anchor exists (no volume reference before that)
    z24 = np.where(np.arange(H)[None, :] >= anchor["ready_h"][:, None], z24, 0.0)
    D = H // 24
    zd = z24[:, 23::24]
    Sd = cusum_upper(zd, dc["cusum"]["k"])
    prev = np.concatenate([np.zeros((M, 1)), Sd[:, :-1]], axis=1)
    out["cusum"] = np.clip(np.maximum(0, np.repeat(prev, 24, axis=1) + z24 - dc["cusum"]["k"]), 0, 50).astype(np.float32)
    out["volume_z"] = z24.astype(np.float32)
    # dec_hist is kept for the evidence pack (amounts vs declared business)
    _ = dec_hist, D
    return out


def drift_score(parts: dict, cfg: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Noisy-OR drift score: max(vs anchor, vs rolling) combined with drift vs the declared profile."""
    dc = cfg["engines"]["drift"]
    refs, w, fl = dc["refs"], dc["weights"], dc["floors"]
    a = noisy_or({k: parts[k] for k in ["js_24h", "js_7d", "wasserstein", "round_excess", "cusum"]}, refs, w, fl)
    r = noisy_or({"js_24h": parts["js_24h_roll"], "js_7d": parts["js_7d_roll"], "wasserstein": parts["wasserstein_roll"],
                  "round_excess": parts["round_excess_roll"]}, refs, w, fl)
    d = noisy_or({"js_declared": parts["js_declared"]}, refs, w, fl)
    score = 1 - (1 - np.maximum(a, r)) * (1 - d)
    return score.astype(np.float32), a.astype(np.float32), r.astype(np.float32)


def rolling_baseline(T: dict, cal, flagged_day: np.ndarray, cfg: dict, anchor: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Rolling baseline per merchant-day: days [d - lag - n, d - lag), excluding flagged days.
    Returns hourly expected counts (M, H), hourly-broadcast amount histogram (M, H, B) and round share (M, H)."""
    dc = cfg["engines"]["drift"]
    n, lag = dc["rolling_days"], dc["rolling_lag_days"]
    M, H = T["cnt"].shape
    D = H // 24
    how = cal.how_of_hour()
    dow = cal.dow()
    keep = (~flagged_day).astype(np.float32)  # (M, D)
    # daily counts per hour-of-day, weighted by keep
    cnt_dh = T["cnt"].reshape(M, D, 24) * keep[:, :, None]
    hist_d = T["hist"].reshape(M, D, 24, -1).sum(axis=2) * keep[:, :, None]
    rnd_d = T["rnd"].reshape(M, D, 24).sum(axis=2) * keep
    tot_d = T["cnt"].reshape(M, D, 24).sum(axis=2) * keep
    # per day-of-week sums over the rolling window via cumulative sums per dow
    E_roll = np.zeros((M, H), np.float32)
    hist_roll = np.zeros((M, D, hist_d.shape[2]), np.float32)
    round_roll = np.zeros((M, D), np.float32)
    cs_hist = np.concatenate([np.zeros((M, 1, hist_d.shape[2])), np.cumsum(hist_d, axis=1)], axis=1)
    cs_rnd = np.concatenate([np.zeros((M, 1)), np.cumsum(rnd_d, axis=1)], axis=1)
    cs_tot = np.concatenate([np.zeros((M, 1)), np.cumsum(tot_d, axis=1)], axis=1)
    cs_keep = np.concatenate([np.zeros((M, 1)), np.cumsum(keep, axis=1)], axis=1)
    for d in range(D):
        a, b = d - lag - n, d - lag
        if a < 0:
            E_roll[:, d * 24:(d + 1) * 24] = np.nan
            continue
        sel = np.arange(a, b)
        same = sel[dow[sel] == dow[d]]
        k = keep[:, same].sum(axis=1)
        prof = cnt_dh[:, same, :].sum(axis=1) / np.maximum(k, 1)[:, None]
        E_roll[:, d * 24:(d + 1) * 24] = prof
        hist_roll[:, d] = cs_hist[:, b] - cs_hist[:, a]
        round_roll[:, d] = (cs_rnd[:, b] - cs_rnd[:, a]) / np.maximum(cs_tot[:, b] - cs_tot[:, a], 1)
        # merchants with too few kept days fall back to the anchor
        few = (cs_keep[:, b] - cs_keep[:, a]) < n / 3
        E_roll[few, d * 24:(d + 1) * 24] = np.nan
    # NaN -> anchor (handled by caller); smooth histograms
    hist_roll = hist_roll + 0.5
    hist_roll = hist_roll / hist_roll.sum(axis=2, keepdims=True)
    _ = how
    return E_roll, hist_roll, round_roll
