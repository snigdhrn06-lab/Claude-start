"""Engine 2: compare with peers, without the alarm flood."""
from __future__ import annotations

import numpy as np
import pandas as pd


def robust_z(gaps: np.ndarray, mad_floor: float) -> np.ndarray:
    """z = gap / (1.4826 * MAD of peer gaps), column-wise over peers (axis 0)."""
    mad = np.nanmedian(np.abs(gaps - np.nanmedian(gaps, axis=0, keepdims=True)), axis=0, keepdims=True)
    return gaps / np.maximum(1.4826 * mad, mad_floor)


def persistence(fire: np.ndarray, n: int) -> np.ndarray:
    """Number of the last n windows (inclusive) in which `fire` was true, along axis 1."""
    c = np.cumsum(np.concatenate([np.zeros((fire.shape[0], 1)), fire.astype(float)], axis=1), axis=1)
    out = np.empty(fire.shape, float)
    out[:, n:] = c[:, n + 1:] - c[:, 1:-n]
    out[:, :n] = c[:, 1:n + 1]
    return out


def naive_false_alarms(z: float = 3.0, merchant_hours: float = 1_000_000) -> dict:
    from scipy.stats import norm

    p = float(norm.sf(z))
    return {"p_tail": p, "merchant_hours": merchant_hours, "expected_alarms": p * merchant_hours}


def compute_peers(cnt24: np.ndarray, E24: np.ndarray, active: np.ndarray, groups: pd.Series, cfg: dict) -> dict:
    """Lift = log(actual / expected) per trailing 24 h window; gap = lift - median peer lift;
    robust z over the peer group; fires if z > 3 in >= 3 of the last 6 windows."""
    pc = cfg["engines"]["peers"]
    lift = np.log((cnt24 + 1.0) / (E24 + 1.0)).astype(np.float32)
    lift = np.where(active, lift, np.nan)
    M, H = lift.shape
    med = np.full((M, H), np.nan, np.float32)
    z = np.zeros((M, H), np.float32)
    for g, idx in groups.groupby(groups).groups.items():
        idx = np.asarray(list(idx))
        L = lift[idx]
        m = np.nanmedian(L, axis=0) if len(idx) > 1 else np.zeros(H)
        gaps = L - m[None, :]
        zz = robust_z(gaps, pc["mad_floor"])
        med[idx] = m[None, :]
        z[idx] = np.nan_to_num(zz, nan=0.0)
    over = z > pc["z_threshold"]
    pers = persistence(over, pc["persist_n"]).astype(np.float32)
    fire = over & (pers >= pc["persist_k"])
    return {"lift": np.nan_to_num(lift), "peer_median_lift": np.nan_to_num(med), "peer_z": z, "peer_persist": pers,
            "peer_over": over, "peer_fire": fire}
