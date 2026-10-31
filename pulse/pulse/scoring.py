"""Run the four engines on the hourly grid and assemble the feature table."""
from __future__ import annotations

import time
import warnings

import numpy as np
import pandas as pd

from .engines import drift as E1
from .engines import graph as E4
from .engines import invariants as E3
from .engines import peers as E2
from .features import anchor_baselines, build_tensors, declared_profiles, expected_hourly, peer_groups, window_sum

FEATURES = {
    "drift": ["js_24h", "js_7d", "js_declared", "wasserstein", "round_excess", "cusum", "drift_adj"],
    "peers": ["peer_z", "peer_persist"],
    "invariants": ["loop_ratio", "unmatched_share", "payout_ratio", "fast_payout_share", "log_payout_to_payin",
                   "match_beta", "match_neglogp", "match_share_24h", "match_share_excess", "distant_excess_24h",
                   "newdist_share_24h", "burst_share_24h"],
    "graph": ["graph_neglogp", "shared_k", "aa_score", "hard_links"],
}
ALL_FEATURES = [f for v in FEATURES.values() for f in v]
ENGINE_OF = {f: e for e, v in FEATURES.items() for f in v}


def log(msg, t0=[time.time()]):  # noqa: B006
    print(f"[{time.time() - t0[0]:6.1f}s] {msg}", flush=True)


def run_engines(world: dict, cal, cfg: dict) -> dict:
    warnings.filterwarnings("ignore", category=RuntimeWarning)
    mdf = world["merchants"]
    M, H, D = len(mdf), cal.H, cal.days
    T = build_tensors(world, cal, cfg)
    log("tensors built")
    declared = declared_profiles(world, cal, cfg, T["edges"])
    anchor = anchor_baselines(T, world, cal, cfg, declared)
    how = cal.how_of_hour()
    dec_rate = np.stack([declared[c]["rate_shape"] * d for c, d in zip(mdf.category, mdf.declared_daily)])  # (M,168)
    dec_E = dec_rate[:, how].astype(np.float32)
    E = expected_hourly(anchor["rate"], cal, dec_rate, anchor["ready_h"])
    dec_hist = np.stack([declared[c]["hist"] for c in mdf.category])
    hh = np.arange(H)[None, :]
    alive = (hh >= mdf.onboard_day.to_numpy()[:, None] * 24) & (hh < mdf.offboard_day.to_numpy()[:, None] * 24)
    # Merchants live on day 0 spend their first 30 eligible days building the frozen anchor (warm-up, not
    # scored). Merchants onboarded later are scored from day one against their declared (KYB) profile.
    start = np.where(mdf.onboard_day.to_numpy() == 0, anchor["ready_h"], mdf.onboard_day.to_numpy() * 24)
    active = alive & (hh >= start[:, None])

    # ---- Engine 1, pass 1 (anchor only) -> flagged days for the rolling baseline
    parts = E1.compute_drift(T, E, None, anchor, dec_E, anchor["hist"], None, None, dec_hist, cfg)
    s1, a1, _ = E1.drift_score(parts, cfg)
    flagged_day = a1[:, 23::24] >= cfg["engines"]["drift"]["fire_threshold"]
    E_roll, hist_roll_d, round_roll_d = E1.rolling_baseline(T, cal, flagged_day, cfg, anchor)
    has_roll = ~np.isnan(E_roll)
    E_roll = np.where(has_roll, E_roll, E)
    hist_roll_h = np.repeat(hist_roll_d, 24, axis=1)
    round_roll_h = np.repeat(round_roll_d, 24, axis=1)
    no_roll_day = ~has_roll[:, ::24]
    hist_roll_h[np.repeat(no_roll_day, 24, axis=1)] = np.broadcast_to(anchor["hist"][:, None, :], (M, H, anchor["hist"].shape[1]))[np.repeat(no_roll_day, 24, axis=1)]
    round_roll_h = np.where(np.repeat(no_roll_day, 24, axis=1), anchor["round"][:, None], round_roll_h)
    log("drift pass 1 + rolling baseline")
    parts = E1.compute_drift(T, E, E_roll, anchor, dec_E, anchor["hist"], hist_roll_h, round_roll_h, dec_hist, cfg)
    del hist_roll_h
    dscore, dA, dR = E1.drift_score(parts, cfg)
    log("drift pass 2")

    # ---- Engine 2
    groups = peer_groups(world, cal, cfg, anchor, T)
    cnt24 = window_sum(T["cnt"], 24)
    E24 = window_sum(E, 24)
    P = E2.compute_peers(cnt24, E24, active, groups, cfg)
    # cohort-adjusted drift: own drift minus the median drift of its peer group at the same hour
    dmed = np.zeros_like(dscore)
    for g, idx in groups.groupby(groups).groups.items():
        idx = np.asarray(list(idx))
        dmed[idx] = np.nanmedian(np.where(active[idx], dscore[idx], np.nan), axis=0)[None, :]
    drift_adj = np.clip(dscore - np.nan_to_num(dmed), 0, 1)
    log("peers")

    # ---- Engine 3
    L = E3.compute_loop(T, cfg)
    MC = E3.compute_match_clock(T["cnt"], E, cal.live_hour, active, cfg, cfg["settings"]["seed"])
    INV = E3.invariants_summary(T, L, MC, anchor, cfg)
    log("invariants")

    # ---- Engine 4
    G = E4.compute_graph(world, cal, cfg)
    log("graph")

    F = {}
    F.update({k: parts[k] for k in ["js_24h", "js_7d", "js_declared", "wasserstein", "round_excess", "cusum", "volume_z",
                                    "js_24h_roll", "js_7d_roll", "wasserstein_roll", "round_excess_roll"]})
    F["drift_score"] = dscore
    F["drift_anchor"] = dA
    F["drift_rolling"] = dR
    F["drift_peer_median"] = np.nan_to_num(dmed)
    F["drift_adj"] = drift_adj
    F["drift_fire"] = drift_adj >= cfg["engines"]["drift"]["fire_threshold"]
    F.update({k: P[k] for k in ["lift", "peer_median_lift", "peer_z", "peer_persist", "peer_fire"]})
    F["peer_z"] = np.clip(F["peer_z"], -20, 20)
    F.update({k: L[k] for k in ["n_payouts_7d", "loop_ratio", "unmatched_share", "fast_payout_share", "log_payout_to_payin",
                                "payout_ratio", "loop_score", "loop_fire"]})
    F["match_beta"] = MC["match_beta"]
    F["match_p"] = MC["match_p"]
    F["match_neglogp"] = -np.log10(np.maximum(MC["match_p"], 1.0 / (cfg["engines"]["invariants"]["match_clock"]["n_placebo"] + 1)))
    F.update(INV)
    F.update({k: G[k] for k in ["graph_neglogp", "shared_k", "n_payers_30d", "aa_score", "hard_links", "graph_front", "graph_fire", "graph_score"]})
    F["cnt"] = T["cnt"]
    F["cnt24"] = cnt24
    F["E24"] = E24
    F["amt"] = T["amt"]
    F["active"] = active
    # engine-level scores (0..1) for the scorecard and the UI
    F["peers_score"] = (np.clip(F["peer_z"] / 6, 0, 1) * np.clip(F["peer_persist"] / 6, 0, 1)).astype(np.float32)
    F["n_engines"] = (F["drift_fire"].astype(np.int8) + F["peer_fire"] + F["invariants_fire"] + F["graph_fire"]).astype(np.int8)
    raw = {"cnt", "amt", "cnt24", "E24"}  # raw data and expectations are never masked; only scores are
    for k, v in F.items():
        if k in raw:
            continue
        if isinstance(v, np.ndarray) and v.shape == (M, H) and v.dtype != bool:
            F[k] = np.where(active, v, 0).astype(v.dtype)
        elif isinstance(v, np.ndarray) and v.shape == (M, H):
            F[k] = v & active
    ctx = {"T": T, "E": E, "anchor": anchor, "declared": declared, "groups": groups, "placebo_shifts": MC["placebo_shifts"],
           "payer_degree": G["payer_degree"], "dec_E": dec_E}
    return {"F": F, "ctx": ctx}


def feature_frame(F: dict, idx_m: np.ndarray, idx_h: np.ndarray, cols=None) -> pd.DataFrame:
    cols = cols or ALL_FEATURES
    return pd.DataFrame({c: F[c][idx_m, idx_h] for c in cols})
