"""Hourly tensors, baselines and peer groups.

Every quantity is defined on one hourly grid (M merchants x H hours). Window features are trailing
windows that END at an hour, so the daily evaluation snapshot (hour 23) and the live hourly view use
identical definitions.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY, Calendar

KIND_PAYIN, KIND_PAYOUT = 0, 1


def window_sum(x: np.ndarray, w: int) -> np.ndarray:
    """Trailing window sum along axis 1 (inclusive of the current hour). Works for 2D and 3D."""
    c = np.cumsum(x, axis=1, dtype=np.float64)
    pad = np.zeros_like(c[:, :1])
    c = np.concatenate([pad, c], axis=1)
    out = c[:, w:] - c[:, :-w]
    head = c[:, 1:w]
    return np.concatenate([head, out], axis=1).astype(np.float32)


def hourly(m: np.ndarray, h: np.ndarray, M: int, H: int, w=None) -> np.ndarray:
    return np.bincount(m.astype(np.int64) * H + h, weights=w, minlength=M * H).reshape(M, H).astype(np.float32)


def amount_bins(cfg: dict) -> np.ndarray:
    a, b, n = cfg["engines"]["drift"]["amount_bins"]
    return np.linspace(a, b, int(n) + 1)


def build_tensors(world: dict, cal: Calendar, cfg: dict) -> dict:
    mdf = world["merchants"]
    pay = world["payments"]
    payers = world["payers"]
    M, H = len(mdf), cal.H
    ec = cfg["engines"]
    t = pay.t_min.to_numpy()
    m = pay.merchant_id.to_numpy().astype(np.int64)
    h = (t // 60).astype(np.int64)
    kind = pay.kind.to_numpy()
    amt = pay.amount.to_numpy().astype(np.float64)
    payer = pay.payer_id.to_numpy().astype(np.int64)
    pin = kind == KIND_PAYIN

    T = {}
    T["cnt"] = hourly(m[pin], h[pin], M, H)
    T["amt"] = hourly(m[pin], h[pin], M, H, amt[pin])
    rmod = ec["drift"]["round_modulus"]
    is_round = pin & (amt % rmod == 0)
    T["rnd"] = hourly(m[is_round], h[is_round], M, H)
    in_match = cal.in_windows(t, "match")
    T["inmatch"] = hourly(m[pin & in_match], h[pin & in_match], M, H)
    # amount histogram on log10 bins
    edges = amount_bins(cfg)
    B = len(edges) - 1
    b = np.clip(np.digitize(np.log10(np.maximum(amt, 1)), edges) - 1, 0, B - 1)
    hist = np.bincount((m[pin] * H + h[pin]) * B + b[pin], minlength=M * H * B).reshape(M, H, B).astype(np.int32)
    T["hist"] = hist
    T["edges"] = edges

    # payer-level facts
    p_ward = payers.ward.to_numpy()[payer]
    m_ward = mdf.ward.to_numpy()[m]
    distant = pin & (p_ward != m_ward)
    T["distant"] = hourly(m[distant], h[distant], M, H)
    # first seen per (merchant, payer)
    key = m * 10_000_000 + payer
    order = np.lexsort((t, key))
    k_s, t_s = key[order], t[order]
    first_idx = np.r_[True, k_s[1:] != k_s[:-1]]
    first_t = np.maximum.accumulate(np.where(first_idx, t_s, -1))
    first_seen = np.empty_like(t)
    first_seen[order] = first_t
    newp = pin & ((t - first_seen) <= ec["invariants"]["new_payer_days"] * MIN_PER_DAY)
    T["newdist"] = hourly(m[newp & distant], h[newp & distant], M, H)
    # bursts: same payer paid the same merchant again within N minutes
    pin_idx = np.where(pin)[0]
    o2 = pin_idx[np.lexsort((t[pin_idx], key[pin_idx]))]
    same = np.r_[False, key[o2][1:] == key[o2][:-1]]
    gap = np.r_[np.inf, np.diff(t[o2]).astype(float)]
    burst_sel = o2[same & (gap <= ec["invariants"]["burst_minutes"])]
    T["burst"] = hourly(m[burst_sel], h[burst_sel], M, H)

    # refunds / payouts
    T.update(_refund_tensors(pay, M, H))
    return T


def _refund_tensors(pay: pd.DataFrame, M: int, H: int) -> dict:
    pin = pay[pay.kind == KIND_PAYIN][["merchant_id", "payer_id", "t_min", "amount"]].copy()
    ref = pay[pay.kind == KIND_PAYOUT][["merchant_id", "payer_id", "t_min", "amount"]].copy()
    out = {}
    if len(ref) == 0:
        for k in ["rcnt", "ramt", "r_matched", "r_unmatched", "r_fast", "r_logratio"]:
            out[k] = np.zeros((M, H), np.float32)
        return out
    pin = pin.sort_values("t_min")
    pin["cum"] = pin.groupby(["merchant_id", "payer_id"]).amount.cumsum()
    pin["t_last"] = pin["t_min"]
    ref = ref.sort_values("t_min").reset_index(drop=True)
    ref["ref_id"] = np.arange(len(ref))
    a = pd.merge_asof(ref, pin[["merchant_id", "payer_id", "t_min", "cum", "t_last"]], on="t_min",
                      by=["merchant_id", "payer_id"], direction="backward", allow_exact_matches=False)
    ref7 = ref.copy()
    ref7["t_min"] = ref7["t_min"] - 7 * MIN_PER_DAY
    b = pd.merge_asof(ref7.sort_values("t_min"), pin[["merchant_id", "payer_id", "t_min", "cum"]].rename(columns={"cum": "cum7"}),
                      on="t_min", by=["merchant_id", "payer_id"], direction="backward").sort_values("ref_id")
    a = a.sort_values("ref_id")
    cum = a["cum"].fillna(0).to_numpy()
    cum7 = b["cum7"].fillna(0).to_numpy()
    paid7 = cum - cum7
    since = (a["t_min"] - a["t_last"]).to_numpy()
    matched = np.nan_to_num(since, nan=1e9) <= 7 * MIN_PER_DAY
    fast = np.nan_to_num(since, nan=1e9) <= 180
    # refund amount equal to an earlier pay-in amount from that payer at that merchant?
    first_amt = pin.groupby(["merchant_id", "payer_id", "amount"]).t_min.min().rename("t_first_amt").reset_index()
    c = a.merge(first_amt, on=["merchant_id", "payer_id", "amount"], how="left").sort_values("ref_id")
    has_orig = (c["t_first_amt"] < c["t_min"]).to_numpy()
    ratio = np.where(paid7 > 0, a["amount"].to_numpy() / np.maximum(paid7, 1), 10.0)
    mm = a["merchant_id"].to_numpy().astype(np.int64)
    hh = (a["t_min"].to_numpy() // 60).astype(np.int64)
    out["rcnt"] = hourly(mm, hh, M, H)
    out["ramt"] = hourly(mm, hh, M, H, a["amount"].to_numpy().astype(float))
    out["r_matched"] = hourly(mm, hh, M, H, matched.astype(float))
    out["r_unmatched"] = hourly(mm, hh, M, H, (~has_orig).astype(float))
    out["r_fast"] = hourly(mm, hh, M, H, (matched & fast).astype(float))
    out["r_logratio"] = hourly(mm, hh, M, H, np.log(np.clip(ratio, 0.05, 20)))
    return out


# --------------------------------------------------------------------------------------
# Baselines
# --------------------------------------------------------------------------------------
def declared_profiles(world: dict, cal: Calendar, cfg: dict, edges: np.ndarray) -> dict:
    """KYB-declared business profile per category: hour-of-week shape, amount histogram, round share,
    expected daily volume. Bakery shape comes from the real Bread Basket profile."""
    from .simulate import _how_template

    tpls = cfg["merchant_templates"]["categories"]
    out = {}
    B = len(edges) - 1
    centers = (edges[:-1] + edges[1:]) / 2
    hero = world["payments"][world["payments"].merchant_id == 0]
    hero_amt = hero.amount[(hero.kind == KIND_PAYIN) & ~hero.is_bet].to_numpy()
    for cat, tpl in tpls.items():
        how = _how_template(tpl, world["bakery_how"]).ravel()  # (168,), mean daily total = 1
        if cat == "bakery":
            hb = np.histogram(np.log10(hero_amt), bins=edges)[0].astype(float)
        else:
            from scipy.stats import norm

            mu, sd = np.log10(tpl["bill_median"]), tpl["bill_sigma"] / np.log(10)
            cdf = norm.cdf(edges, mu, sd)
            hb = np.diff(cdf)
        hb = hb + 1e-3
        out[cat] = {
            "how": how / how.sum(),
            "rate_shape": how,  # per-hour expected count for a merchant doing 1 payment a day
            "hist": hb / hb.sum(),
            "round": float(max(tpl["round_rate"], 0.02)),
            "daily": float(tpl["daily_tx_median"]),
        }
    return out


def anchor_baselines(T: dict, world: dict, cal: Calendar, cfg: dict, declared: dict) -> dict:
    """Frozen anchor: the first `anchor_days` eligible days after onboarding (days with >= 1 pay-in).
    Until those days exist, the declared (KYB) profile is used. Never updated afterwards."""
    mdf = world["merchants"]
    M, H, D = len(mdf), cal.H, cal.days
    nd = cfg["engines"]["drift"]["anchor_days"]
    how = cal.how_of_hour()
    cnt_d = T["cnt"].reshape(M, D, 24).sum(axis=2)
    rate = np.zeros((M, 168), np.float32)
    hist = np.zeros((M, T["hist"].shape[2]), np.float32)
    rshare = np.zeros(M, np.float32)
    mshare = np.zeros(M, np.float32)
    dshare = np.zeros(M, np.float32)
    dmean = np.zeros(M, np.float32)
    dstd = np.zeros(M, np.float32)
    ready_h = np.full(M, H, np.int64)   # first hour at which the anchor exists
    a_from = np.full(M, -1, np.int64)
    a_to = np.full(M, -1, np.int64)
    dow = cal.dow()
    for i, r in mdf.iterrows():
        on = int(r.onboard_day)
        elig = np.where((cnt_d[i] > 0) & (np.arange(D) >= on))[0]
        cat = declared[r.category]
        if len(elig) >= nd:
            days = elig[:nd]
            ready_h[i] = (days[-1] + 1) * 24
            a_from[i], a_to[i] = days[0], days[-1]
            hmask = np.zeros(H, bool)
            hmask[(days[:, None] * 24 + np.arange(24)).ravel()] = True
            c = np.bincount(how[hmask], weights=T["cnt"][i, hmask], minlength=168)
            n_dow = np.bincount(dow[days], minlength=7).astype(float)
            per_cell = np.repeat(np.maximum(n_dow, 1), 24)
            rate[i] = c / per_cell
            hist[i] = T["hist"][i, hmask].sum(axis=0)
            tot = T["cnt"][i, hmask].sum()
            rshare[i] = T["rnd"][i, hmask].sum() / max(tot, 1)
            mshare[i] = T["inmatch"][i, hmask].sum() / max(tot, 1)
            late = days[nd // 2:]
            lmask = np.zeros(H, bool)
            lmask[(late[:, None] * 24 + np.arange(24)).ravel()] = True
            dshare[i] = T["distant"][i, lmask].sum() / max(T["cnt"][i, lmask].sum(), 1)
            dc = cnt_d[i, days]
            dmean[i] = dc.mean()
            dstd[i] = max(dc.std(), np.sqrt(max(dc.mean(), 1)))
        else:
            dd = float(r.declared_daily)
            rate[i] = cat["rate_shape"] * dd
            hist[i] = cat["hist"] * 100
            rshare[i] = cat["round"]
            mshare[i] = 0.05
            dshare[i] = 0.15
            dmean[i] = dd
            dstd[i] = max(np.sqrt(dd), 0.4 * dd)
    hist = hist + 0.5
    hist = hist / hist.sum(axis=1, keepdims=True)
    return {"rate": rate, "hist": hist, "round": rshare, "match_share": mshare, "distant_share": dshare,
            "daily_mean": dmean, "daily_std": dstd, "ready_h": ready_h,
            "from_day": a_from, "to_day": a_to}


def expected_hourly(base_rate: np.ndarray, cal: Calendar, declared_rate: np.ndarray, ready_h: np.ndarray) -> np.ndarray:
    """(M, H) expected pay-ins per hour: anchor rates once the anchor exists, declared rates before."""
    how = cal.how_of_hour()
    E = base_rate[:, how]
    D = declared_rate[:, how]
    hh = np.arange(cal.H)[None, :]
    return np.where(hh >= ready_h[:, None], E, D).astype(np.float32)


# --------------------------------------------------------------------------------------
# Peer groups
# --------------------------------------------------------------------------------------
def peer_groups(world: dict, cal: Calendar, cfg: dict, anchor: dict, T: dict) -> pd.Series:
    """Same category and city, clustered by size with HDBSCAN on baseline features.
    Small groups fall back to category x size band (region-wide)."""
    from sklearn.cluster import HDBSCAN

    pc = cfg["engines"]["peers"]
    mdf = world["merchants"]
    feats = np.column_stack([
        np.log1p(anchor["daily_mean"]),
        np.log10(np.maximum(1, (anchor["hist"] * ((T["edges"][:-1] + T["edges"][1:]) / 2)).sum(axis=1))),
        anchor["rate"][:, [d * 24 + h for d in range(7) for h in range(18, 24)]].sum(axis=1) / np.maximum(anchor["rate"].sum(axis=1), 1e-6),
    ])
    group = np.array([""] * len(mdf), dtype=object)
    band = np.zeros(len(mdf), int)
    for cat, sub in mdf.groupby("category"):
        q = np.quantile(feats[sub.index, 0], np.linspace(0, 1, pc["size_bands"] + 1)[1:-1])
        band[sub.index] = np.searchsorted(q, feats[sub.index, 0])
    for (cat, city), sub in mdf.groupby(["category", "city"]):
        idx = sub.index.to_numpy()
        if len(idx) >= max(pc["min_group"], pc["min_cluster_size"] * 2):
            X = feats[idx]
            X = (X - X.mean(axis=0)) / np.maximum(X.std(axis=0), 1e-6)
            lab = HDBSCAN(min_cluster_size=pc["min_cluster_size"]).fit_predict(X)
            for li in set(lab):
                members = idx[lab == li]
                if li >= 0 and len(members) >= pc["min_group"]:
                    group[members] = f"{cat}|{city}|c{li}"
    for i in np.where(group == "")[0]:
        group[i] = f"{mdf.category[i]}|band{band[i]}"
    # fallback groups that are still tiny merge into the category
    g = pd.Series(group)
    small = g.map(g.value_counts()) < pc["min_group"]
    g[small] = mdf.category[small] + "|all"
    return g
