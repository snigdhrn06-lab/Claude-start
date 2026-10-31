"""Real normal (Stream A): Bread Basket -> UPI-style payment stream for the hero bakery."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY


def load_hero_baskets(cfg: dict, root) -> tuple[pd.DataFrame, dict]:
    """Return one row per real transaction: t_min (minutes since window start) and amount (INR).

    If data/raw/partner_bakery.csv exists (consented partner data), it is used instead.
    """
    s = cfg["settings"]
    raw = root / s["paths"]["raw"]
    start = pd.Timestamp(s["window"]["start"])
    partner = raw / "partner_bakery.csv"
    if partner.exists():
        p = pd.read_csv(partner)
        ts = pd.to_datetime(p["timestamp"])
        first = ts.min().normalize()
        # shift by whole weeks so the first partner week lines up with the window start week
        weeks = int(np.floor((start - first).days / 7))
        shifted = ts + pd.Timedelta(weeks=weeks)
        t_min = ((shifted - start).dt.total_seconds() // 60).astype(np.int64)
        df = pd.DataFrame({"t_min": t_min, "amount": p["amount_inr"].round().astype(np.int64), "payer_hash": p.get("payer_hash")})
        df = df[(df.t_min >= 0) & (df.t_min < s["window"]["days"] * MIN_PER_DAY)].sort_values("t_min")
        return df.reset_index(drop=True), {"source": "partner_bakery.csv (consented)", "shift_weeks": weeks, "rows": len(df)}

    path = raw / "bread_basket.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run `make fetch-data`, or download BreadBasket_DMS.csv from Kaggle "
            "('Transactions from a bakery') and save it at that path."
        )
    d = pd.read_csv(path)
    prices = cfg["price_list"]["prices"]
    default = cfg["price_list"]["default_price"]
    d["price"] = d["Item"].map(lambda x: prices.get(x.strip(), prices.get(x, default)))
    n_rows = len(d)
    n_none = int((d["price"] == 0).sum())
    d["dt"] = pd.to_datetime(d["Date"] + " " + d["Time"])
    g = d.groupby("Transaction").agg(dt=("dt", "first"), amount=("price", "sum"), items=("price", lambda x: int((x > 0).sum())))
    n_tx = len(g)
    g = g[g.amount > 0]
    orig_start = pd.Timestamp(d["Date"].min())
    shift_days = (start - orig_start).days
    assert shift_days % 7 == 0, "date shift must preserve day-of-week"
    g["dt_2025"] = g["dt"] + pd.Timedelta(days=shift_days)
    g["t_min"] = ((g["dt_2025"] - start).dt.total_seconds() // 60).astype(np.int64)
    g = g[(g.t_min >= 0) & (g.t_min < s["window"]["days"] * MIN_PER_DAY)]
    out = g.sort_values("t_min")[["t_min", "amount", "items"]].reset_index()
    report = {
        "source": "Bread Basket (Kaggle 'Transactions from a bakery', BreadBasket_DMS.csv)",
        "item_rows": n_rows,
        "rows_priced_zero_dropped": n_none,
        "transactions": n_tx,
        "transactions_dropped_zero_total": int(n_tx - len(g)),
        "transactions_used": int(len(out)),
        "original_first_date": str(orig_start.date()),
        "original_last_date": str(pd.Timestamp(d["Date"].max()).date()),
        "shift_days": int(shift_days),
        "shift_weeks": int(shift_days // 7),
        "mapped_first_date": str((orig_start + pd.Timedelta(days=shift_days)).date()),
        "mapped_last_date": str((pd.Timestamp(d["Date"].max()) + pd.Timedelta(days=shift_days)).date()),
        "closed_days_in_original": [str(x.date()) for x in pd.date_range(orig_start, d["Date"].max()) if x.strftime("%Y-%m-%d") not in set(d["Date"])],
        "median_basket_inr": float(out.amount.median()),
        "mean_daily_transactions": float(len(out) / s["window"]["days"]),
    }
    return out, report


def hour_of_week_profile(t_min: np.ndarray, start: pd.Timestamp, days: int) -> np.ndarray:
    """Average payments per hour-of-week cell (Mon 00:00 = 0), shape (168,)."""
    hours = t_min // 60
    dow0 = start.dayofweek
    how = ((hours // 24 + dow0) % 7) * 24 + hours % 24
    counts = np.bincount(how, minlength=168).astype(float)
    weeks = days / 7
    return counts / weeks
