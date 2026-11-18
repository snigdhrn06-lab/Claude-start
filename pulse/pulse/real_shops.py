"""Real honest shops PULSE was never designed around (out-of-sample false-alarm test).

Two public datasets, each turned into a payment stream the same way as the hero bakery:
  * Olist (Brazilian marketplace, public data released by Olist): every seller with 100+ orders between
    Sun 3 Sep 2017 and Sun 11 Feb 2018 becomes one merchant. The slice contains Black Friday, Christmas and Carnival.
  * UCI Online Retail (a UK gift wholesaler): Sun 26 Jun 2011 to Sun 4 Dec 2011. Cancelled invoices are real refunds
    to the same customer, which is exactly what the refund-loop engine looks at.

Dates are shifted by whole weeks onto the simulation window (day of week and time of day kept); amounts are converted
to rupees at a fixed rate. Real customer IDs are mapped one-to-one onto simulated payer IDs: a customer in the seller's
own state/country becomes a payer from the merchant's city, anyone else a payer from another city. Nothing about
betting is added: every one of these merchants is honest by construction.
"""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY


def _shift(ts: pd.Series, slice_start: pd.Timestamp) -> np.ndarray:
    return ((ts - slice_start).dt.total_seconds() // 60).astype(np.int64).to_numpy()


def load_olist(raw, rc: dict, days: int, slice_start: str | None = None, prefix: str = "R_OL") -> list[dict]:
    o = pd.read_csv(raw / "olist_orders_dataset.csv", usecols=["order_id", "customer_id", "order_status", "order_purchase_timestamp"],
                    parse_dates=["order_purchase_timestamp"])
    it = pd.read_csv(raw / "olist_order_items_dataset.csv", usecols=["order_id", "seller_id", "price", "freight_value"])
    cu = pd.read_csv(raw / "olist_customers_dataset.csv", usecols=["customer_id", "customer_unique_id", "customer_state"])
    se = pd.read_csv(raw / "olist_sellers_dataset.csv", usecols=["seller_id", "seller_state", "seller_city"])
    start = pd.Timestamp(slice_start or rc["olist"]["slice_start"])
    assert start.dayofweek == 6, "slice must start on a Sunday to keep day-of-week"
    end = start + pd.Timedelta(days=days)
    x = (it.assign(v=it.price + it.freight_value).groupby(["order_id", "seller_id"], as_index=False).v.sum()
         .merge(o, on="order_id").merge(cu, on="customer_id").merge(se, on="seller_id"))
    x = x[(x.order_purchase_timestamp >= start) & (x.order_purchase_timestamp < end) & (x.order_status != "canceled")]
    n = x.groupby("seller_id").size()
    keep = n[n >= rc["olist"]["min_orders"]].sort_values(ascending=False).index
    shops = []
    for k, sid in enumerate(keep):
        d = x[x.seller_id == sid].sort_values("order_purchase_timestamp")
        st = d.seller_state.iloc[0]
        shops.append({
            "code": f"{prefix}{k + 1:02d}",
            "name": f"{'Online seller' if prefix == 'R_OL' else 'Holdout seller'} {k + 1} ({d.seller_city.iloc[0].title()}, {st})",
            "source": "real (Olist, Brazil)",
            "t_min": _shift(d.order_purchase_timestamp, start),
            "amount": np.maximum(1, np.round(d.v.to_numpy() * rc["olist"]["inr_per_unit"])).astype(np.int64),
            "customer": ("ol:" + d.customer_unique_id).to_numpy(),
            "local": (d.customer_state == st).to_numpy(),
            "kind": np.zeros(len(d), np.int8),
        })
    return shops


def load_uci(raw, rc: dict, days: int) -> list[dict]:
    r = pd.read_csv(raw / "online_retail.csv", dtype={"InvoiceNo": str, "CustomerID": str})
    r["dt"] = pd.to_datetime(r.InvoiceDate, format="%m/%d/%Y %H:%M")
    r["val"] = r.Quantity * r.UnitPrice
    inv = r.groupby("InvoiceNo").agg(dt=("dt", "first"), cust=("CustomerID", "first"), val=("val", "sum"),
                                     country=("Country", "first")).reset_index()
    start = pd.Timestamp(rc["uci"]["slice_start"])
    assert start.dayofweek == 6
    inv = inv[(inv.dt >= start) & (inv.dt < start + pd.Timedelta(days=days)) & (inv.val != 0)].sort_values("dt")
    cancel = inv.InvoiceNo.str.startswith("C").to_numpy()
    # guests (no customer ID) are a fresh payer each time
    cust = np.where(inv.cust.isna(), "uci-guest:" + inv.InvoiceNo, "uci:" + inv.cust.fillna(""))
    return [{
        "code": "R_UK01",
        "name": "UK gift wholesaler (UCI Online Retail)",
        "source": "real (UCI Online Retail, UK)",
        "t_min": _shift(inv.dt, start),
        "amount": np.maximum(1, np.round(np.abs(inv.val.to_numpy()) * rc["uci"]["inr_per_unit"])).astype(np.int64),
        "customer": cust,
        "local": (inv.country == "United Kingdom").to_numpy(),
        "kind": cancel.astype(np.int8),           # 1 = refund (cancelled invoice) to the same customer
    }]


def load_real_shops(cfg: dict, root, holdout: bool = False) -> tuple[list[dict], dict]:
    rc = cfg["settings"].get("real_shops", {})
    if not rc.get("enabled"):
        return [], {"enabled": False}
    raw = root / cfg["settings"]["paths"]["raw"]
    days = cfg["settings"]["window"]["days"]
    shops, missing = [], []
    olist = (lambda raw_, rc_, days_: load_olist(raw_, rc_, days_, rc_["holdout"]["olist_slice_start"], "R_HO")) if holdout else load_olist
    sources = [("olist", olist, ["olist_orders_dataset.csv", "olist_order_items_dataset.csv",
                                 "olist_customers_dataset.csv", "olist_sellers_dataset.csv"])]
    if not holdout:
        sources.append(("uci", load_uci, ["online_retail.csv"]))
    for name, fn, files in sources:
        if all((raw / f).exists() for f in files):
            shops += fn(raw, rc, days)
        else:
            missing.append(name)
    for s in shops:
        ok = (s["t_min"] >= 0) & (s["t_min"] < days * MIN_PER_DAY)
        for k in ("t_min", "amount", "customer", "local", "kind"):
            s[k] = s[k][ok]
    return shops, {"enabled": True, "missing": missing, "shops": len(shops)}


def map_customers(shops: list[dict], merchant_city: dict, city_payers: dict, seed: int) -> None:
    """One-to-one map from real customer IDs to simulated payer IDs (deterministic, no reuse across customers)."""
    used: set[int] = set()
    lookup: dict[str, int] = {}
    cities = sorted(city_payers)
    for s in shops:
        home = merchant_city[s["code"]]
        pid = np.empty(len(s["customer"]), np.int64)
        for j, (c, loc) in enumerate(zip(s["customer"], s["local"])):
            if c not in lookup:
                h = int(hashlib.sha256(f"{seed}:{c}".encode()).hexdigest()[:12], 16)
                pools = [home] if loc else [x for x in cities if x != home]
                pool = city_payers[pools[h % len(pools)]]
                k = h % len(pool)
                for _ in range(len(pool)):
                    if int(pool[k]) not in used:
                        break
                    k = (k + 1) % len(pool)
                lookup[c] = int(pool[k])
                used.add(lookup[c])
            pid[j] = lookup[c]
        s["payer_id"] = pid


def build_real_world(world: dict, cfg: dict, cal, root, holdout: bool = False) -> dict | None:
    """The main simulated world plus the real shops appended as newcomers (split = 'real').

    Used only for a second, scoring-only pass with the frozen model, so the main results stay exactly as they are."""
    from .simulate import KIND_PAYIN, add_payment_fields
    from .config import rng_for

    shops, report = load_real_shops(cfg, root, holdout)
    if not shops:
        return None
    seed = cfg["settings"]["seed"]
    mdf, pay, payers = world["merchants"], world["payments"], world["payers"]
    tpl = cfg["merchant_templates"]["categories"]["online_store"]
    cities = [c["name"] for c in cfg["settings"]["region"]["cities"]]
    share = np.array([c["share"] for c in cfg["settings"]["region"]["cities"]])
    city_payers = {c: payers.payer_id[payers.city == c].to_numpy() for c in cities}
    wards = {c: sorted(payers.ward[payers.city == c].unique()) for c in cities}
    tier = mdf.drop_duplicates("city").set_index("city").tier.to_dict()
    base = mdf.iloc[0].to_dict()
    rows, real_city = [], {}
    for k, rs in enumerate(shops):
        rng = rng_for(seed, f"real-{rs['code']}")
        city = cities[rng.choice(len(cities), p=share)]
        first_day = int(rs["t_min"].min() // MIN_PER_DAY) if len(rs["t_min"]) else 0
        onboard = first_day if first_day > 7 else 0
        mid = len(mdf) + k
        daily = float((rs["kind"] == KIND_PAYIN).sum() / max(1, cal.days - onboard))
        row = {**base, "merchant_id": mid, "code": rs["code"], "name": rs["name"], "category": "online_store",
               "ward": int(rng.choice(wards[city])), "city": city, "tier": tier.get(city, base["tier"]), "onboard_day": onboard,
               "offboard_day": cal.days, "truth": "honest", "scenario": "R", "takeover_day": np.nan, "syndicate": "",
               "round_stakes": np.nan, "payouts": "", "ramp": np.nan, "quirk": "", "device_id": f"DEV{mid:04d}",
               "director_id": f"DIR{mid:04d}", "settlement_account": f"ACC{mid:04d}", "data_source": rs["source"],
               "base_daily_tx": daily, "declared_daily": max(daily, tpl["daily_tx_median"]), "takeover_t_min": np.nan,
               "split": "real"}
        rows.append(row)
        real_city[rs["code"]] = city
    map_customers(shops, real_city, city_payers, seed)
    new_pay = []
    for row, rs in zip(rows, shops):
        d = pd.DataFrame({"t_min": rs["t_min"].astype(np.int32), "amount": rs["amount"].astype(np.int64),
                          "payer_id": rs["payer_id"].astype(np.int32), "kind": rs["kind"].astype(np.int8), "is_bet": False,
                          "merchant_id": np.int16(row["merchant_id"]), "match_id": ""})
        new_pay.append(d[d.t_min >= row["onboard_day"] * MIN_PER_DAY])
    npay = pd.concat(new_pay, ignore_index=True).sort_values(["merchant_id", "t_min", "kind", "payer_id", "amount"], kind="mergesort")
    npay["merchant_id"] = npay["merchant_id"].astype(np.int16)
    add_payment_fields(npay, payers, seed + 1)
    mdf_b = pd.concat([mdf, pd.DataFrame(rows)[mdf.columns]], ignore_index=True)
    pay_b = pd.concat([pay, npay[pay.columns]], ignore_index=True)
    for c in ("type", "channel", "payer_city"):
        pay_b[c] = pay_b[c].astype("category")
    return {**world, "merchants": mdf_b, "payments": pay_b, "real_report": report}
