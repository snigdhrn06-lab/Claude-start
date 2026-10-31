"""Synthetic region: payers, ~300 merchants from category templates, scenarios and fronts.

Honest "normal" for simulated merchants comes from category templates (design parameters).
The hero bakery's normal comes from the real Bread Basket data (see ingest.py).
All betting behaviour is synthetic and follows config/scenarios.yaml.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import MIN_PER_DAY, Calendar
from .config import rng_for
from .ingest import hour_of_week_profile, load_hero_baskets

KIND_PAYIN, KIND_PAYOUT = 0, 1


# --------------------------------------------------------------------------------------
# Payers
# --------------------------------------------------------------------------------------
def make_payers(cfg: dict) -> tuple[pd.DataFrame, dict]:
    s = cfg["settings"]
    rng = rng_for(s["seed"], "payers")
    N = s["region"]["payer_pool"]
    rows = []
    ward_id = 0
    city_rows = []
    for c in s["region"]["cities"]:
        n_city = int(round(N * c["share"]))
        for w in range(c["wards"]):
            n_w = n_city // c["wards"]
            rows.append(np.full(n_w, ward_id))
            city_rows.append(np.full(n_w, c["name"], dtype=object))
            ward_id += 1
    ward = np.concatenate(rows)
    city = np.concatenate(city_rows)
    # top up rounding remainder in the first ward
    if len(ward) < N:
        ward = np.concatenate([ward, np.zeros(N - len(ward), int)])
        city = np.concatenate([city, np.full(N - len(city), s["region"]["cities"][0]["name"], dtype=object)])
    payers = pd.DataFrame({"payer_id": np.arange(N), "ward": ward[:N], "city": city[:N]})
    payers["is_bettor"] = rng.random(N) < s["region"]["bettor_share"]
    bettors = payers.payer_id[payers.is_bettor].to_numpy()
    synd = {}
    for name, size in s["region"]["syndicates"].items():
        synd[name] = np.sort(rng_for(s["seed"], f"synd-{name}").choice(bettors, size=min(size, len(bettors)), replace=False))
    return payers, synd


def ward_city_maps(cfg: dict) -> tuple[dict, dict]:
    wards, tiers = {}, {}
    w = 0
    for c in cfg["settings"]["region"]["cities"]:
        for _ in range(c["wards"]):
            wards[w] = c["name"]
            w += 1
        tiers[c["name"]] = c["tier"]
    return wards, tiers


# --------------------------------------------------------------------------------------
# Honest normal behaviour
# --------------------------------------------------------------------------------------
def _how_template(tpl: dict, bakery_how: np.ndarray) -> np.ndarray:
    """(7, 24) relative intensity, normalised so the mean daily total is 1."""
    if tpl["hour_profile"] == "from_bread_basket":
        how = bakery_how.reshape(7, 24).copy()
    else:
        hp = np.array(tpl["hour_profile"], float)
        how = np.outer(np.array(tpl["dow"], float), hp)
    return how / how.sum(axis=1).mean()


def _zipf_weights(n: int, a: float, rng) -> np.ndarray:
    w = 1.0 / np.arange(1, n + 1) ** a
    rng.shuffle(w)
    return w / w.sum()


class PayerPicker:
    """Local regulars with repeat behaviour + walk-ins from the wider city."""

    def __init__(self, local: np.ndarray, weights: np.ndarray, walk_pool: np.ndarray, walk_share: float):
        self.local, self.weights, self.walk_pool, self.walk_share = local, weights, walk_pool, walk_share

    def pick(self, n: int, rng, walk_share: float | None = None) -> np.ndarray:
        ws = self.walk_share if walk_share is None else walk_share
        walk = rng.random(n) < ws
        out = rng.choice(self.local, size=n, p=self.weights)
        if walk.any():
            out[walk] = rng.choice(self.walk_pool, size=int(walk.sum()))
        return out


def simulate_normal(
    cal: Calendar,
    tpl: dict,
    how: np.ndarray,
    daily_tx: float,
    picker: PayerPicker,
    rng,
    category: str,
    var: dict,
    quirk: dict | None,
    onboard_day: int = 0,
    offboard_day: int | None = None,
    bakery_amounts: np.ndarray | None = None,
) -> pd.DataFrame:
    """Hourly Poisson payments from a category template with day noise, festivals and match nights."""
    D = cal.days
    dow = cal.dow()
    shape = var["day_noise_shape"]
    noise = rng.gamma(shape, 1.0 / shape, size=D)
    lam = daily_tx * how[dow] * noise[:, None]  # (D, 24)
    # festivals
    if tpl.get("festival"):
        dm, em = cal.festival_multipliers(category)
        mult = np.repeat(dm[:, None], 24, axis=1)
        mult[:, 17:23] = em[:, None]
        lam = lam * mult
    # match nights
    mm = tpl.get("match_multiplier", 1.0)
    if mm != 1.0:
        lam = lam * np.where(cal.match_hour.reshape(D, 24), mm, 1.0)
    # quirks (honest hard negatives)
    q = quirk or {}
    if q.get("type") == "growth":
        lam = lam * (1.01 ** (np.arange(D) / 7.0))[:, None]
    if q.get("type") == "step_up":
        lam[q["day"]:] *= q["factor"]
    if q.get("type") == "late_hours":
        extra = np.zeros(24)
        extra[[21, 22, 23]] = [0.6, 0.5, 0.35]
        peak = how.max()
        lam[q["day"]:] += daily_tx * peak * extra[None, :] * noise[q["day"]:, None]
    alive = np.zeros(D, bool)
    alive[onboard_day: (offboard_day if offboard_day is not None else D)] = True
    lam = lam * alive[:, None]
    counts = rng.poisson(lam).ravel()
    n = int(counts.sum())
    hours = np.repeat(np.arange(D * 24), counts)
    t_min = hours * 60 + rng.integers(0, 60, size=n)
    # amounts
    if bakery_amounts is not None:
        amt = rng.choice(bakery_amounts, size=n) * rng.uniform(0.8, 1.3)
        amt = np.maximum(10, np.round(amt / 10) * 10)
    else:
        med = tpl["bill_median"] * np.exp(rng.normal(0, 0.25))
        amt = np.exp(rng.normal(np.log(med), tpl["bill_sigma"], size=n))
        amt = np.maximum(10, np.round(amt))
    rnd = rng.random(n) < tpl["round_rate"]
    amt[rnd] = np.maximum(100, np.round(amt[rnd] / 100) * 100)
    payer = picker.pick(n, rng)
    # festival surplus: gift boxes (round amounts) and city-wide walk-ins
    if tpl.get("festival"):
        dm, em = cal.festival_multipliers(category)
        d_of = hours // 24
        fest_mult = np.maximum(dm[d_of], np.where((hours % 24 >= 17) & (hours % 24 < 23), em[d_of], 1.0))
        surplus_p = np.clip(1 - 1 / fest_mult, 0, 1)
        is_surplus = rng.random(n) < surplus_p
        gift = is_surplus & (rng.random(n) < 0.45)
        amt[gift] = rng.choice([500, 1000, 1500, 2000], size=int(gift.sum()), p=[0.45, 0.35, 0.1, 0.1])
        walk = is_surplus & (rng.random(n) < 0.4)
        if walk.any():
            payer[walk] = rng.choice(picker.walk_pool, size=int(walk.sum()))
    df = pd.DataFrame({"t_min": t_min, "amount": amt.astype(np.int64), "payer_id": payer})
    if q.get("type") == "bulk_order":
        k = int(rng.integers(4, 9))
        tb = q["day"] * MIN_PER_DAY + rng.integers(10 * 60, 18 * 60, size=k)
        ab = np.round(rng.uniform(5000, 20000, size=k) / 500) * 500
        df = pd.concat([df, pd.DataFrame({"t_min": tb, "amount": ab.astype(np.int64), "payer_id": rng.choice(picker.walk_pool, size=k)})])
    df["kind"] = KIND_PAYIN
    df["is_bet"] = False
    # genuine refunds: same payer, same amount (or half), a little later
    rr = tpl.get("refund_rate", 0.0)
    if rr > 0 and len(df):
        sel = rng.random(len(df)) < rr
        r = df[sel].copy()
        r["t_min"] = r["t_min"] + rng.integers(10, 3 * MIN_PER_DAY, size=len(r))
        half = rng.random(len(r)) < 0.3
        r.loc[half, "amount"] = (r.loc[half, "amount"] // 2).astype(np.int64)
        r["kind"] = KIND_PAYOUT
        df = pd.concat([df, r[r.t_min < cal.T_MIN]])
    return df


# --------------------------------------------------------------------------------------
# Betting injection (synthetic)
# --------------------------------------------------------------------------------------
def inject_betting(
    cal: Calendar,
    bet_cfg: dict,
    rng,
    bettors: np.ndarray,
    start_day: int,
    end_day: int,
    bets_per_match: float,
    round_amounts: bool = True,
    payouts: str = "refund",
    ramp: float | None = None,
    normal_daily: np.ndarray | None = None,
) -> pd.DataFrame:
    """Bets around live-match moments; winners paid back as 'refunds' (or off-platform)."""
    fx = cal.fixtures
    mo = cal.moments
    pop = rng.lognormal(0, 0.6, size=len(bettors))
    pop /= pop.sum()
    weights = bet_cfg["moment_weights"]
    sess_p = np.array(bet_cfg["bets_per_session_p"])
    sess_k = np.array(bet_cfg["bets_per_session"])
    mean_bets = float((sess_p * sess_k).sum())
    out = []
    for _, f in fx.iterrows():
        d = int(f["t_start"] // MIN_PER_DAY)
        if d < start_day or d >= end_day or f["t_start"] < start_day * MIN_PER_DAY:
            continue
        intensity = bets_per_match * (0.35 if f["format"] == "Test" else 1.0)
        if ramp is not None:
            week = (d - start_day) // 7
            share = min(0.9, ramp * (week + 1))
            base = normal_daily[d] if normal_daily is not None else 60
            intensity = share / (1 - share) * base
        n_sess = rng.poisson(intensity / mean_bets)
        if n_sess == 0:
            continue
        mm = mo[(mo.match_id == f["match_id"]) & (mo.t0 >= f["w0"]) & (mo.t1 <= f["t_end"] + 1)]
        names = list(mm.moment) + ["in_play"]
        w = np.array([weights.get(x, weights.get("final_overs", 0.25)) for x in mm.moment] + [weights["in_play"]])
        w = w / w.sum()
        which = rng.choice(len(names), size=n_sess, p=w)
        t0 = np.empty(n_sess)
        for j, nm in enumerate(names):
            k = which == j
            if not k.any():
                continue
            if nm == "in_play":
                t0[k] = rng.uniform(f["t_start"], f["t_end"], size=int(k.sum()))
            else:
                r = mm.iloc[j]
                t0[k] = rng.uniform(r.t0, r.t1, size=int(k.sum()))
        who = rng.choice(bettors, size=n_sess, p=pop)
        nb = rng.choice(sess_k, size=n_sess, p=sess_p)
        rows_t, rows_a, rows_p, rows_s = [], [], [], []
        for i in range(n_sess):
            gaps = np.concatenate([[0], np.cumsum(rng.uniform(*bet_cfg["session_gap_minutes"], size=nb[i] - 1))])
            ts = (t0[i] + gaps).astype(np.int64)
            if round_amounts:
                a = rng.choice(bet_cfg["stakes_round"], size=nb[i], p=bet_cfg["stakes_round_p"])
            else:
                a = np.round(np.exp(rng.normal(np.log(bet_cfg["stake_nonround_median"]), 0.6, size=nb[i])))
                a = np.where(a % 100 == 0, a + rng.integers(7, 93, size=nb[i]), a)
            rows_t.append(ts)
            rows_a.append(a)
            rows_p.append(np.full(nb[i], who[i]))
            rows_s.append(np.full(nb[i], i))
        t = np.concatenate(rows_t)
        a = np.concatenate(rows_a).astype(np.int64)
        p = np.concatenate(rows_p)
        sid = np.concatenate(rows_s)
        bets = pd.DataFrame({"t_min": t, "amount": a, "payer_id": p, "kind": KIND_PAYIN, "is_bet": True, "match_id": f["match_id"]})
        out.append(bets)
        if payouts == "refund":
            stake = np.bincount(sid, weights=a, minlength=n_sess)
            win = rng.random(n_sess) < bet_cfg["win_prob"]
            if win.any():
                odds = rng.uniform(*bet_cfg["odds"], size=int(win.sum()))
                pay = np.round(stake[win] * odds / 10) * 10
                pay = np.where(np.isin(pay, stake[win]), pay + 10, pay)
                tp = f["t_end"] + rng.integers(bet_cfg["payout_delay_minutes"][0], bet_cfg["payout_delay_minutes"][1], size=int(win.sum()))
                out.append(pd.DataFrame({"t_min": tp, "amount": pay.astype(np.int64), "payer_id": who[win], "kind": KIND_PAYOUT, "is_bet": True, "match_id": f["match_id"]}))
    if not out:
        return pd.DataFrame(columns=["t_min", "amount", "payer_id", "kind", "is_bet", "match_id"])
    df = pd.concat(out, ignore_index=True)
    return df[(df.t_min >= 0) & (df.t_min < cal.T_MIN)]


def _first_match_day_on_or_after(cal: Calendar, d: int) -> int:
    days = sorted(set((cal.fixtures.t_start // MIN_PER_DAY).astype(int)))
    days = [x for x in days if x >= d]
    return days[0] if days else d


# --------------------------------------------------------------------------------------
# Build the whole region
# --------------------------------------------------------------------------------------
def build_world(cfg: dict, cal: Calendar, root) -> dict:
    s = cfg["settings"]
    seed = s["seed"]
    sc = cfg["scenarios"]
    tpls = cfg["merchant_templates"]["categories"]
    var = cfg["merchant_templates"]["variation"]
    bet_cfg = sc["betting"]
    payers, synd = make_payers(cfg)
    ward_city, city_tier = ward_city_maps(cfg)
    n_wards = len(ward_city)
    ward_payers = {w: payers.payer_id[payers.ward == w].to_numpy() for w in range(n_wards)}
    city_payers = {c: payers.payer_id[payers.city == c].to_numpy() for c in city_tier}
    all_payers = payers.payer_id.to_numpy()

    hero_df, ingest_report = load_hero_baskets(cfg, root)
    bakery_how = hour_of_week_profile(hero_df.t_min.to_numpy(), cal.start, cal.days)
    bakery_amounts = hero_df.amount.to_numpy()
    hero_daily = len(hero_df) / cal.days

    merchants: list[dict] = []
    payments: list[pd.DataFrame] = []
    city_names = [c["name"] for c in s["region"]["cities"]]
    city_share = np.array([c["share"] for c in s["region"]["cities"]])
    wards_by_city = {c: [w for w, cc in ward_city.items() if cc == c] for c in city_names}

    def new_merchant(code, name, category, rng, ward=None, **kw) -> dict:
        if ward is None:
            city = city_names[rng.choice(len(city_names), p=city_share)]
            ward = int(rng.choice(wards_by_city[city]))
        m = {
            "merchant_id": len(merchants),
            "code": code,
            "name": name,
            "category": category,
            "ward": int(ward),
            "city": ward_city[int(ward)],
            "tier": city_tier[ward_city[int(ward)]],
            "onboard_day": 0,
            "offboard_day": cal.days,
            "truth": "honest",
            "scenario": "",
            "takeover_day": np.nan,
            "syndicate": "",
            "round_stakes": np.nan,
            "payouts": "",
            "ramp": np.nan,
            "quirk": "",
            "device_id": f"DEV{len(merchants):04d}",
            "director_id": f"DIR{len(merchants):04d}",
            "settlement_account": f"ACC{len(merchants):04d}",
            "data_source": "simulated",
        }
        m.update(kw)
        merchants.append(m)
        return m

    def picker_for(m, tpl, daily, rng, n_local=None):
        n_local = n_local or int(np.clip(tpl["local_payers_per_daily_tx"] * daily, 60, 2000))
        if tpl.get("payer_scope") == "city":
            pool = city_payers[m["city"]]
        else:
            pool = ward_payers[m["ward"]]
        local = rng.choice(pool, size=min(n_local, len(pool)), replace=False)
        return PayerPicker(local, _zipf_weights(len(local), 0.8, rng), city_payers[m["city"]], tpl["walk_in_share"])

    def add(df, m):
        if len(df):
            df = df.copy()
            df["merchant_id"] = m["merchant_id"]
            payments.append(df)

    def normal_for(m, category, rng, daily=None, quirk=None):
        tpl = tpls[category]
        how = _how_template(tpl, bakery_how)
        how = how * np.exp(rng.normal(0, var["hour_jitter_sigma"], size=how.shape)) * (how > 0)
        how = how / how.sum(axis=1).mean()
        if daily is None:
            daily = tpl["daily_tx_median"] * np.exp(rng.normal(0, tpl["daily_tx_sigma"]))
        m["base_daily_tx"] = float(daily)
        picker = picker_for(m, tpl, daily, rng)
        df = simulate_normal(
            cal, tpl, how, daily, picker, rng, category, var, quirk,
            onboard_day=m["onboard_day"], offboard_day=m["offboard_day"],
            bakery_amounts=bakery_amounts if category == "bakery" else None,
        )
        dow = cal.dow()
        normal_daily = daily * how.sum(axis=1)[dow]
        return df, picker, normal_daily

    # ---------------- hero bakery (real data): S3 hero and S0 twin -----------------------
    hcfg = s["hero"]
    hero_ward = wards_by_city[hcfg["city"]][hcfg["ward"]]
    for code, ward_off, scen in [("HERO", 0, "S3"), ("HERO_TWIN", 1, "S0")]:
        rng = rng_for(seed, f"hero-{code}")
        w = wards_by_city[hcfg["city"]][(hcfg["ward"] + ward_off) % len(wards_by_city[hcfg["city"]])]
        name = hcfg["name"] if code == "HERO" else f"{hcfg['name']} (S0 twin, no takeover)"
        m = new_merchant(code, name, "bakery", rng, ward=w, scenario=scen,
                         data_source="real (Bread Basket)" if ingest_report["source"].startswith("Bread") else "partner bakery (consented)")
        local = rng.choice(ward_payers[w], size=hcfg["local_payers"], replace=False)
        picker = PayerPicker(local, _zipf_weights(len(local), hcfg["zipf_exponent"], rng), city_payers[m["city"]], hcfg["walk_in_share"])
        df = hero_df[["t_min", "amount"]].copy()
        df["payer_id"] = picker.pick(len(df), rng)
        df["kind"] = KIND_PAYIN
        df["is_bet"] = False
        m["base_daily_tx"] = hero_daily
        add(df, m)
        if code == "HERO":
            r = sc["scenarios"]["S3"]
            rng_b = rng_for(seed, "S3-bets")
            T = r["takeover_day"]
            m.update(truth="front", takeover_day=T, syndicate=r["syndicate"], round_stakes=r["round"], payouts=r["payouts"])
            bettors = rng_b.choice(synd[r["syndicate"]], size=r["bettors"], replace=False)
            add(inject_betting(cal, bet_cfg, rng_b, bettors, T, cal.days, r["bets_per_match"], r["round"], r["payouts"]), m)

    # ---------------- banned seed fronts ---------------------------------------------------
    for bf in sc["banned_seed_fronts"]:
        rng = rng_for(seed, f"bf-{bf['id']}")
        m = new_merchant(bf["id"], bf["name"], bf["category"], rng, truth="banned_front", scenario="BF",
                         offboard_day=bf["ban_day"], takeover_day=bf["start_day"], syndicate=bf["syndicate"],
                         round_stakes=True, payouts="refund")
        df, _, nd = normal_for(m, bf["category"], rng)
        add(df, m)
        bettors = rng.choice(synd[bf["syndicate"]], size=bf["bettors"], replace=False)
        add(inject_betting(cal, bet_cfg, rng, bettors, bf["start_day"], bf["ban_day"], bf["bets_per_match"]), m)

    # ---------------- honest background (incl. designated S1, S2) --------------------------
    quirk_cfg = var["honest_quirks"]
    for cat, tpl in tpls.items():
        for i in range(tpl["count"]):
            rng = rng_for(seed, f"honest-{cat}-{i}")
            scen = ""
            if cat == "sweet_shop" and i == 0:
                scen = "S1"
            if cat == "sports_bar" and i == 0:
                scen = "S2"
            quirk = None
            if not scen:
                u = rng.random()
                acc = 0.0
                for qn, qp in quirk_cfg.items():
                    acc += qp
                    if u < acc:
                        qd = int(rng.integers(cal.baseline_days, cal.days - 10))
                        quirk = {"type": qn, "day": qd, "factor": float(rng.uniform(1.4, 1.8))}
                        break
            code = {"S1": "S1_SWEETS", "S2": "S2_SPORTSBAR"}.get(scen, f"{cat[:3].upper()}{i:03d}")
            name = {"S1": "Lakshmi Sweets (S1)", "S2": "Third Umpire Sports Bar (S2)"}.get(scen, f"{cat.replace('_', ' ').title()} #{i + 1}")
            onboard = 0
            if not scen and rng.random() < var["honest_new_share"]:
                onboard = int(rng.integers(*var["honest_new_day_range"]))
                quirk = None
            m = new_merchant(code, name, cat, rng, scenario=scen, quirk=(quirk or {}).get("type", "") or ("new" if onboard else ""),
                             onboard_day=onboard)
            if scen == "S1":
                m["ward"], m["city"], m["tier"] = hero_ward, hcfg["city"], 1
            df, _, _ = normal_for(m, cat, rng, quirk=quirk)
            add(df, m)

    # ---------------- scenario fronts S4, S5, E1, E3 --------------------------------------
    scs = sc["scenarios"]
    for sid in ["S4", "E1", "E3"]:
        r = scs[sid]
        rng = rng_for(seed, f"scen-{sid}")
        name = {"S4": "Golden Crust Bakery (S4)", "E1": "Crumbs & Co Bakery (E1)", "E3": "Daily Loaf Bakery (E3)"}[sid]
        m = new_merchant(sid, name, "bakery", rng, scenario=sid, truth="front", takeover_day=r["takeover_day"],
                         syndicate=r["syndicate"], round_stakes=r["round"], payouts=r["payouts"],
                         ramp=r.get("ramp_per_week", np.nan))
        df, _, nd = normal_for(m, "bakery", rng, daily=hero_daily * float(rng.uniform(0.9, 1.1)))
        add(df, m)
        bettors = rng.choice(synd[r["syndicate"]], size=r["bettors"], replace=False)
        add(inject_betting(cal, bet_cfg, rng, bettors, r["takeover_day"], cal.days, r.get("bets_per_match", 0), r["round"],
                           r["payouts"], ramp=r.get("ramp_per_week"), normal_daily=nd), m)

    # S5: brand-new IT services shell
    r = scs["S5"]
    rng = rng_for(seed, "scen-S5")
    bf_row = next(m for m in merchants if m["code"] == r["banned_front"])
    m = new_merchant("S5", "Nimbus Cloud IT Services (S5)", "it_services", rng, scenario="S5", truth="front",
                     onboard_day=r["onboard_day"], takeover_day=r["onboard_day"], syndicate=r["syndicate"],
                     round_stakes=r["round"], payouts=r["payouts"], device_id=bf_row["device_id"])
    # the banned front's bettor list = payers of its betting payments before the ban
    allp = pd.concat(payments)
    bf_bettors = np.unique(allp.payer_id[(allp.merchant_id == bf_row["merchant_id"]) & allp.is_bet & (allp.kind == KIND_PAYIN)])
    from_bf = rng.choice(bf_bettors, size=r["first_payers_from_banned"], replace=False)
    others_pool = np.setdiff1d(synd[r["syndicate"]], bf_bettors)
    others_first = rng.choice(others_pool, size=r["first_payers"] - r["first_payers_from_banned"], replace=False)
    first = np.concatenate([from_bf, others_first])
    rng.shuffle(first)
    d1 = r["onboard_day"] * MIN_PER_DAY
    t_first = np.sort(d1 + rng.integers(18 * 60, 23 * 60 + 50, size=len(first)))
    day1 = pd.DataFrame({"t_min": t_first, "amount": rng.choice([500, 1000, 2000], size=len(first)), "payer_id": first,
                         "kind": KIND_PAYIN, "is_bet": True, "match_id": "S5-day1"})
    later_pool = np.concatenate([from_bf, rng.choice(others_pool, size=r["bettors"] - len(from_bf), replace=False)])
    later = inject_betting(cal, bet_cfg, rng, later_pool, r["onboard_day"] + 1, cal.days, r["bets_per_match"], r["round"], r["payouts"])
    m["base_daily_tx"] = 0.0
    add(pd.concat([day1, later]), m)

    # E2: ring of 10 small fronts
    r = scs["E2"]
    rng_ring = rng_for(seed, "scen-E2")
    ring_device = None
    for k in range(r["merchant"]["ring"]):
        rng = rng_for(seed, f"scen-E2-{k}")
        cat = r["merchant"]["categories"][k % len(r["merchant"]["categories"])]
        T = _first_match_day_on_or_after(cal, int(rng_ring.integers(*r["takeover_day_range"])))
        m = new_merchant(f"E2_{k + 1:02d}", f"{cat.replace('_', ' ').title()} ring member {k + 1} (E2)", cat, rng, scenario="E2",
                         truth="front", takeover_day=T, syndicate=r["syndicate"], round_stakes=r["round"], payouts=r["payouts"])
        if k < 3:
            ring_device = ring_device or m["device_id"]
            m["device_id"] = ring_device
        df, _, nd = normal_for(m, cat, rng, daily=tpls[cat]["daily_tx_median"] * 0.6)
        add(df, m)
        bettors = rng.choice(synd[r["syndicate"]], size=r["bettors"], replace=False)
        add(inject_betting(cal, bet_cfg, rng, bettors, T, cal.days, r["bets_per_match"], r["round"], r["payouts"]), m)

    # ---------------- extra randomised fronts ----------------------------------------------
    ef = sc["extra_fronts"]
    cats = list(ef["host_categories"])
    cat_p = np.array([ef["host_categories"][c] for c in cats])
    syn_names = list(ef["syndicate_p"])
    syn_p = np.array([ef["syndicate_p"][x] for x in syn_names])
    banned_by_synd = {next(m for m in merchants if m["code"] == b["id"])["syndicate"]: next(m for m in merchants if m["code"] == b["id"])
                      for b in sc["banned_seed_fronts"]}
    for k in range(ef["count"]):
        rng = rng_for(seed, f"extra-{k}")
        cat = cats[rng.choice(len(cats), p=cat_p / cat_p.sum())]
        T = _first_match_day_on_or_after(cal, int(rng.integers(*ef["takeover_day_range"])))
        syn = syn_names[rng.choice(len(syn_names), p=syn_p)]
        rnd = bool(rng.random() >= ef["p_nonround"])
        pay = "none" if rng.random() < ef["p_no_payouts"] else "refund"
        ramp = ef["ramp_per_week"] if rng.random() < ef["p_ramp"] else None
        onboard = 0
        if cat == "it_services":
            onboard = int(max(0, T - rng.integers(0, 10)))
        extra = {}
        if rng.random() < ef["hard_link_p"] and syn in banned_by_synd:
            extra["director_id"] = banned_by_synd[syn]["director_id"]
        m = new_merchant(f"FX{k:03d}", f"{cat.replace('_', ' ').title()} F{k + 1}", cat, rng, scenario="extra", truth="front",
                         takeover_day=T, onboard_day=onboard, syndicate=syn, round_stakes=rnd, payouts=pay,
                         ramp=ramp if ramp else np.nan, **extra)
        if cat == "it_services":
            df, _, nd = normal_for(m, cat, rng, daily=float(rng.uniform(1, 4)))
        else:
            df, _, nd = normal_for(m, cat, rng)
        add(df, m)
        bettors = rng.choice(synd[syn], size=int(rng.integers(*ef["bettors_range"])), replace=False)
        bpm = float(np.exp(rng.normal(np.log(ef["bets_per_match_median"]), ef["bets_per_match_sigma"])))
        add(inject_betting(cal, bet_cfg, rng, bettors, T, cal.days, bpm, rnd, pay, ramp=ramp, normal_daily=nd), m)

    # ---------------- assemble -----------------------------------------------------------
    mdf = pd.DataFrame(merchants)
    # KYB: expected daily payments declared at onboarding. Honest merchants declare roughly their real size;
    # shells declare a plausible figure for their claimed category.
    rng_d = rng_for(seed, "declared-volume")
    noise = rng_d.uniform(0.7, 1.4, size=len(mdf))
    cat_med = mdf.category.map(lambda c: tpls[c]["daily_tx_median"]).to_numpy()
    base = mdf.base_daily_tx.fillna(0).to_numpy()
    shell = (mdf.category == "it_services").to_numpy() & mdf.truth.isin(["front", "banned_front"]).to_numpy()
    mdf["declared_daily"] = np.where(shell | (base <= 0), cat_med, base * noise)
    pay = pd.concat(payments, ignore_index=True)
    pay["match_id"] = pay["match_id"].fillna("") if "match_id" in pay else ""
    pay = pay[(pay.t_min >= 0) & (pay.t_min < cal.T_MIN)]
    # nothing before onboarding or after offboarding (ban)
    on = mdf.set_index("merchant_id").onboard_day.to_numpy()[pay.merchant_id.to_numpy()] * MIN_PER_DAY
    off = mdf.set_index("merchant_id").offboard_day.to_numpy()[pay.merchant_id.to_numpy()] * MIN_PER_DAY
    pay = pay[(pay.t_min >= on) & (pay.t_min < off)]
    pay = pay.sort_values(["merchant_id", "t_min", "kind", "payer_id", "amount"], kind="mergesort").reset_index(drop=True)
    pay["amount"] = pay["amount"].astype(np.int64)
    pay["payer_id"] = pay["payer_id"].astype(np.int32)
    pay["merchant_id"] = pay["merchant_id"].astype(np.int16)
    pay["t_min"] = pay["t_min"].astype(np.int32)
    pay["kind"] = pay["kind"].astype(np.int8)
    pay["is_bet"] = pay["is_bet"].astype(bool)

    # takeover time = first betting payment (truth)
    first_bet = pay[pay.is_bet & (pay.kind == KIND_PAYIN)].groupby("merchant_id").t_min.min()
    mdf["takeover_t_min"] = mdf.merchant_id.map(first_bet)
    # banned fronts: ban time and bettor lists (investigation output)
    banned = []
    for bf in sc["banned_seed_fronts"]:
        mm = mdf[mdf.code == bf["id"]].iloc[0]
        b = np.unique(pay.payer_id[(pay.merchant_id == mm.merchant_id) & pay.is_bet & (pay.kind == KIND_PAYIN)])
        banned.append({"code": bf["id"], "merchant_id": int(mm.merchant_id), "name": bf["name"], "ban_day": bf["ban_day"],
                       "ban_t_min": bf["ban_day"] * MIN_PER_DAY, "bettors": b, "syndicate": bf["syndicate"]})
    split_merchants(cfg, mdf)
    return {"merchants": mdf, "payments": pay, "payers": payers, "syndicates": synd, "banned": banned,
            "ingest_report": ingest_report, "bakery_how": bakery_how}


def split_merchants(cfg: dict, mdf: pd.DataFrame) -> None:
    """70/30 split by merchant, stratified by truth. Scenario merchants are always in test;
    banned seed fronts are always in train (they are known labels)."""
    rng = rng_for(cfg["settings"]["seed"], "split")
    test_share = cfg["settings"]["split"]["test_share"]
    split = np.array(["train"] * len(mdf), dtype=object)
    forced_test = mdf.scenario.isin(["S0", "S1", "S2", "S3", "S4", "S5", "E1", "E2", "E3"]).to_numpy()
    split[forced_test] = "test"
    free = ~forced_test & (mdf.scenario != "BF").to_numpy()
    for truth in ["honest", "front"]:
        idx = np.where(free & (mdf.truth == truth).to_numpy())[0]
        idx = idx[rng.permutation(len(idx))]
        n_test = int(round(len(idx) * test_share))
        split[idx[:n_test]] = "test"
    mdf["split"] = split
