"""Plain-language reasons. SHAP picks the top contributions; templates fill in numbers that are
recomputed from the raw payments at that moment (nothing is hard-coded)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY

TEMPLATE_OF = {
    "js_24h": "hours", "js_7d": "hours", "drift_adj": "hours", "js_declared": "declared", "wasserstein": "amount",
    "round_excess": "round", "cusum": "volume", "peer_z": "peer", "peer_persist": "peer",
    "loop_ratio": "loop", "unmatched_share": "loop", "payout_ratio": "loop", "fast_payout_share": "loop", "log_payout_to_payin": "loop",
    "match_beta": "match", "match_neglogp": "match", "match_share_24h": "match", "match_share_excess": "match",
    "distant_excess_24h": "newpayers", "newdist_share_24h": "newpayers", "burst_share_24h": "burst",
    "graph_neglogp": "graph", "shared_k": "graph", "aa_score": "graph", "hard_links": "hardlink",
}
ENGINE_OF_TEMPLATE = {"hours": "drift", "declared": "drift", "amount": "drift", "round": "drift", "volume": "drift",
                      "peer": "peers", "loop": "invariants", "match": "invariants", "newpayers": "invariants", "burst": "invariants",
                      "graph": "graph", "hardlink": "graph"}


def inr(x: float) -> str:
    x = int(round(x))
    s = str(abs(x))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return ("-" if x < 0 else "") + "Rs " + s


class ReasonContext:
    def __init__(self, world: dict, cal, anchor: dict, F: dict, cfg: dict):
        self.w, self.cal, self.anchor, self.F, self.cfg = world, cal, anchor, F, cfg
        pay = world["payments"]
        self.pay = pay
        mid = pay.merchant_id.to_numpy()
        self.bounds = np.searchsorted(mid, np.arange(len(world["merchants"]) + 1))
        self.ward = world["payers"].ward.to_numpy()
        self.banned = world["banned"]

    def mpay(self, m: int) -> pd.DataFrame:
        a, b = self.bounds[m], self.bounds[m + 1]
        return self.pay.iloc[a:b]

    def baseline_slice(self, m: int):
        """Pay-ins in the merchant's anchor window, or None if it is still on its declared profile."""
        a, b = self.anchor["from_day"][m], self.anchor["to_day"][m]
        if a < 0:
            return None
        p = self.mpay(m)
        p = p[(p.kind == 0)]
        return p[(p.t_min >= a * MIN_PER_DAY) & (p.t_min < (b + 1) * MIN_PER_DAY)]

    def window(self, m: int, h: int, hours: int, kind: int = 0) -> pd.DataFrame:
        p = self.mpay(m)
        end = (h + 1) * 60
        return p[(p.kind == kind) & (p.t_min >= end - hours * 60) & (p.t_min < end)]


def _pct(x):
    return int(round(100 * x))


def reason_numbers(ctx: ReasonContext, m: int, h: int, template: str) -> dict | None:
    """Compute the numbers for one template from raw payments. Returns dict with 'text' or None."""
    cal = ctx.cal
    mer = ctx.w["merchants"].iloc[m]
    last = ctx.window(m, h, 24)
    base = ctx.baseline_slice(m)
    base_label = "in its baseline" if base is not None else f"expected for a declared {mer.category.replace('_', ' ')}"
    n = len(last)
    if template == "match":
        if n == 0:
            return None
        x = cal.in_windows(last.t_min.to_numpy(), "match").mean()
        y = cal.in_windows(base.t_min.to_numpy(), "match").mean() if base is not None and len(base) else 0.0
        if x <= y:
            return None
        return {"text": f"{_pct(x)}% of payments in the last 24 h fell inside live-match windows vs {_pct(y)}% {base_label}",
                "numbers": {"share_last24": float(x), "share_baseline": float(y), "n_last24": n}}
    if template == "loop":
        out = ctx.window(m, h, 168, kind=1)
        if len(out) == 0:
            return None
        ins = ctx.mpay(m)
        ins = ins[(ins.kind == 0) & (ins.t_min < (h + 1) * 60)]
        merged = pd.merge_asof(out.sort_values("t_min"), ins[["payer_id", "t_min"]].rename(columns={"t_min": "t_in"}).sort_values("t_in"),
                               left_on="t_min", right_on="t_in", by="payer_id", direction="backward")
        earlier = merged[merged.t_in.notna() & ((merged.t_min - merged.t_in) <= 7 * MIN_PER_DAY)]
        if len(earlier) == 0:
            return None
        med_h = float(np.median((earlier.t_min - earlier.t_in) / 60))
        k = int(earlier.payer_id.nunique())
        amt = float(out.amount.sum())
        return {"text": f"{inr(amt)} paid out as 'refunds' to {k} earlier payers in the last 7 days, a median {med_h:.1f} hours after they paid",
                "numbers": {"refund_inr_7d": amt, "recipients_who_paid": k, "median_hours": med_h, "n_refunds": int(len(out))}}
    if template in ("hours", "declared"):
        if n == 0:
            return None
        hod = (last.t_min.to_numpy() // 60) % 24
        if base is not None and len(base):
            bh = (base.t_min.to_numpy() // 60) % 24
            bshare = np.bincount(bh, minlength=24) / len(bh)
        else:
            from .simulate import _how_template
            how = ctx.anchor["declared_how"][mer.category].reshape(7, 24).sum(axis=0)
            bshare = how / how.sum()
        lshare = np.bincount(hod, minlength=24) / n
        best, bi = -1, 0
        for a in range(24):
            idx = [(a + j) % 24 for j in range(4)]
            ex = lshare[idx].sum() - bshare[idx].sum()
            if ex > best:
                best, bi = ex, a
        idx = [(bi + j) % 24 for j in range(4)]
        x, y = lshare[idx].sum(), bshare[idx].sum()
        if x - y < 0.1:
            return None
        txt = f"{_pct(x)}% of payments in the last 24 h came between {bi:02d}:00 and {(bi + 4) % 24:02d}:00, vs {_pct(y)}% {base_label}"
        if template == "declared":
            txt = f"Payment hours no longer fit its declared business ({mer.category.replace('_', ' ')}): " + txt[0].lower() + txt[1:]
        return {"text": txt, "numbers": {"share_last24": float(x), "share_baseline": float(y), "from_hour": bi}}
    if template == "round":
        if n == 0:
            return None
        x = float((last.amount % 100 == 0).mean())
        y = float((base.amount % 100 == 0).mean()) if base is not None and len(base) else float(ctx.anchor["round"][m])
        if x - y < 0.1:
            return None
        return {"text": f"{_pct(x)}% of payments in the last 24 h were round multiples of Rs 100 vs {_pct(y)}% {base_label}",
                "numbers": {"share_last24": x, "share_baseline": y}}
    if template == "amount":
        if n == 0:
            return None
        a = float(last.amount.median())
        b = float(base.amount.median()) if base is not None and len(base) else float("nan")
        if base is None or not (a > 1.5 * b):
            return None
        return {"text": f"Median payment {inr(a)} in the last 24 h vs {inr(b)} in its baseline",
                "numbers": {"median_last24": a, "median_baseline": b}}
    if template == "volume" or template == "peer":
        e24 = float(ctx.F["E24"][m, h])
        r = (n + 1) / (e24 + 1)
        q = float(np.exp(ctx.F["peer_median_lift"][m, h]))
        if r < 1.5:
            return None
        if template == "peer":
            return {"text": f"Payments ran {r:.1f}x its expected level over the last 24 h while its peer group ran {q:.1f}x",
                    "numbers": {"ratio": r, "peer_ratio": q, "n_last24": n, "expected": e24}}
        return {"text": f"{n} payments in the last 24 h against about {e24:.0f} expected from its own history",
                "numbers": {"n_last24": n, "expected": e24}}
    if template == "newpayers":
        if n == 0:
            return None
        pin = ctx.mpay(m)
        pin = pin[pin.kind == 0]
        first = pin.groupby("payer_id").t_min.min()
        lp = last.payer_id.to_numpy()
        is_new = (last.t_min.to_numpy() - first.reindex(lp).to_numpy()) <= 7 * MIN_PER_DAY
        distant = ctx.ward[lp] != mer.ward
        sel = is_new & distant
        k = int(sel.sum())
        u = int(len(np.unique(lp[sel])))
        if k < 5:
            return None
        return {"text": f"{k} of {n} payments in the last 24 h came from {u} new payers outside its neighbourhood",
                "numbers": {"payments": k, "payers": u, "n_last24": n}}
    if template == "burst":
        if n == 0:
            return None
        s = last.sort_values(["payer_id", "t_min"])
        same = s.payer_id.to_numpy()[1:] == s.payer_id.to_numpy()[:-1]
        gap = np.diff(s.t_min.to_numpy())
        rep = same & (gap <= 10)
        k = int(len(np.unique(s.payer_id.to_numpy()[1:][rep])))
        if k < 5:
            return None
        return {"text": f"{k} payers paid again within 10 minutes in the last 24 h", "numbers": {"payers": k}}
    if template in ("graph", "hardlink"):
        j = int(ctx.F["graph_front"][m, h])
        if template == "hardlink":
            links = []
            for bf in ctx.banned:
                if bf["ban_t_min"] // 60 > h:
                    continue
                row = ctx.w["merchants"].iloc[bf["merchant_id"]]
                for col, lab in [("device_id", "device ID"), ("director_id", "director"), ("settlement_account", "settlement account")]:
                    if row[col] == mer[col] and bf["merchant_id"] != m:
                        links.append((lab, bf))
            if not links:
                return None
            lab, bf = links[0]
            return {"text": f"Shares a {lab} with {bf['name']}, a front banned on {cal.date_of_day(bf['ban_day']).strftime('%d %b')}",
                    "numbers": {"links": len(links)}}
        if j < 0:
            return None
        bf = ctx.banned[j]
        pin = ctx.mpay(m)
        pin = pin[(pin.kind == 0) & (pin.t_min < (h + 1) * 60)]
        age_h = h - int(mer.onboard_day) * 24
        N = ctx.cfg["settings"]["region"]["payer_pool"]
        K = len(bf["bettors"])
        ban = cal.date_of_day(bf["ban_day"]).strftime("%d %b")
        if age_h <= 72:
            firsts = pin.drop_duplicates("payer_id").payer_id.to_numpy()[:20]
            k = int(np.isin(firsts, bf["bettors"]).sum())
            nn = len(firsts)
            exp = nn * K / N
            return {"text": f"{k} of its first {nn} payers also paid {bf['name']}, a front banned on {ban} (about {exp:.1f} expected by chance)",
                    "numbers": {"shared": k, "n_payers": nn, "expected": exp, "front_bettors": K}}
        win = pin[pin.t_min >= (h + 1) * 60 - ctx.cfg["engines"]["graph"]["window_hours"] * 60]
        u = win.payer_id.unique()
        k = int(np.isin(u, bf["bettors"]).sum())
        exp = len(u) * K / N
        return {"text": f"{k} of its {len(u)} payers in the last 30 days also paid {bf['name']}, banned on {ban} (about {exp:.1f} expected by chance)",
                "numbers": {"shared": k, "n_payers": int(len(u)), "expected": exp, "front_bettors": K}}
    return None


def top_reasons(ctx: ReasonContext, m: int, h: int, shap_row: dict, k: int = 3) -> list[dict]:
    """Group SHAP by template; return the top-k positive templates that produce a sentence."""
    agg: dict[str, float] = {}
    for f, v in shap_row.items():
        t = TEMPLATE_OF.get(f)
        if t is None:
            continue
        agg[t] = agg.get(t, 0.0) + float(v)
    if ctx.F["hard_links"][m, h] >= 1:
        agg["hardlink"] = max(agg.get("hardlink", 0.0), agg.get("graph", 0.0) * 0.5 + 1e-6)
    out = []
    for t, v in sorted(agg.items(), key=lambda kv: -kv[1]):
        if v <= 0 or len(out) >= k:
            break
        r = reason_numbers(ctx, m, h, t)
        if r is not None:
            out.append({"template": t, "engine": ENGINE_OF_TEMPLATE[t], "shap": v, **r})
    return out
