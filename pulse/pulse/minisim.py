"""Fast path for the sandbox and the live feed.

It builds a small seeded world (a target merchant plus peers, or a mini city) and runs the SAME code as the full
pipeline on it: simulate.simulate_normal / inject_betting for payments, scoring.run_engines for the four engines,
fusion.scorecard (the day-one expert scorecard), response.ladder for the level and response.delta_reserve for the
money held. Nothing here is a second, simplified engine.

The learned LightGBM model is not used here: it was trained on the full city's hourly features, and the sandbox
changes the world, so the label-free expert scorecard (Stage A, the same one that runs in shadow mode) decides.
"""
from __future__ import annotations

import contextlib
import dataclasses
import io
import json
import time

import numpy as np
import pandas as pd

from . import fusion as FU
from . import response as RS
from .calendar import MIN_PER_DAY, Calendar, _hour_mask
from .config import ROOT, load_config, rng_for
from .reasons import ReasonContext, reason_numbers
from .scoring import run_engines
from .simulate import KIND_PAYIN, PayerPicker, add_payment_fields, _how_template, _zipf_weights, inject_betting, make_payers, simulate_normal

DAYS = 60
ANCHOR_DAYS = 30
START = pd.Timestamp("2025-08-31")          # a Sunday; the sandbox uses its own synthetic 60-day calendar
MATCH_DAYS = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 31, 33, 35, 36, 38, 40, 42, 43, 45, 47, 49, 51, 52, 54, 56, 58]
DIWALI_DAYS = (50, 54)                      # Dhanteras .. Bhai Dooj in the sandbox calendar
MEAN_ROUND_STAKE = 1095.0                   # mean of the round-stake distribution in config/scenarios.yaml


@dataclasses.dataclass(frozen=True)
class Fraud:
    """What the judge controls when playing the fraudster."""
    bet_inr_per_day: float = 0.0           # betting money the front collects on an active day
    mode: str = "none"                     # none | overnight | ramp
    start_day: int = 35                    # first day of betting (overnight) or of the ramp
    ramp_per_week: float = 0.10            # ramp: share of full volume added each week
    round_amounts: bool = True
    match_only: bool = True                # True: bets cluster in live-match windows; False: spread over every evening
    payouts: str = "refunds"               # refunds | offplatform | none
    known_front_share: float = 0.3         # share of bettors reused from a known (banned) front


@dataclasses.dataclass(frozen=True)
class Scenario:
    category: str = "bakery"               # bakery | sports_bar | it_services
    diwali: bool = False
    new_shell: bool = False                # an "IT services" shell onboarded mid-window, judged on its declared profile
    fraud: Fraud = Fraud()
    seed: int = 42
    n_peers: int = 20


PRESETS: dict[str, Scenario] = {
    "Honest bakery": Scenario(),
    "Diwali rush": Scenario(diwali=True),
    "Sports bar": Scenario(category="sports_bar"),
    "Overnight takeover": Scenario(fraud=Fraud(bet_inr_per_day=150_000, mode="overnight")),
    "Slow ramp": Scenario(fraud=Fraud(bet_inr_per_day=150_000, mode="ramp", start_day=31, ramp_per_week=0.10)),
    "New shell": Scenario(category="it_services", new_shell=True, fraud=Fraud(bet_inr_per_day=60_000, mode="overnight", start_day=40, known_front_share=0.6)),
    "Careful front": Scenario(fraud=Fraud(bet_inr_per_day=25_000, mode="overnight", round_amounts=False, match_only=False, payouts="offplatform", known_front_share=0.0)),
}
EXPECTED_HONEST = {"Honest bakery", "Diwali rush", "Sports bar"}


# --------------------------------------------------------------------------------------
# World construction
# --------------------------------------------------------------------------------------
def _calendar(cfg: dict, diwali: bool, diwali_start: int = DIWALI_DAYS[0]) -> Calendar:
    fmt = cfg["engines"]["calendar"]["formats"]["T20"]
    rows_f, rows_m, wins = [], [], []
    for k, d in enumerate(MATCH_DAYS):
        st = d * MIN_PER_DAY + 19 * 60 + 30
        w0, w1 = st - 30, st + fmt["duration_min"]
        wins.append((w0, w1))
        rows_f.append({"match_id": f"SBX-{k:02d}", "date": str((START + pd.Timedelta(days=d)).date()), "start_time_ist": "19:30",
                       "teams": "India v Opponent (synthetic)", "competition": "Sandbox calendar", "format": "T20",
                       "day_k": 0, "t_start": st, "t_end": w1, "w0": w0, "verification": "synthetic"})
        for name, (a, b) in fmt["moments"].items():
            rows_m.append({"match_id": f"SBX-{k:02d}", "moment": name, "t0": st + a, "t1": st + b, "format": "T20"})
    fest = pd.read_csv(ROOT / cfg["settings"]["paths"]["events"] / "festivals.csv")
    diw = fest[fest.name.str.contains("Dhanteras|Diwali|Naraka|Bali|Bhai")].reset_index(drop=True)
    if diwali:
        diw = diw.iloc[: min(DIWALI_DAYS[1] - DIWALI_DAYS[0] + 1, DAYS - diwali_start)].copy()
        diw["date"] = [str((START + pd.Timedelta(days=diwali_start + i)).date()) for i in range(len(diw))]
    else:
        diw = diw.iloc[0:0]
    windows = np.array(wins, dtype=np.int64)
    moments = pd.DataFrame(rows_m)
    H = DAYS * 24
    return Calendar(start=START, days=DAYS, baseline_days=ANCHOR_DAYS, fixtures=pd.DataFrame(rows_f), windows=windows,
                    moments=moments, live_hour=_hour_mask(moments[["t0", "t1"]].to_numpy(), H), match_hour=_hour_mask(windows, H),
                    festivals=diw)


def _bakery_how() -> np.ndarray:
    meta = json.loads((ROOT / "artifacts" / "meta.json").read_text())
    return np.array(meta["bakery_how"], float)


def _bakery_amounts(cfg: dict) -> np.ndarray:
    p = ROOT / "artifacts" / "hero_profile.json"
    return np.array(json.loads(p.read_text())["amounts"], float)


def _spread_bets(cal, bet_cfg, rng, bettors, start_day, end_day, inr_per_day, round_amounts, ramp, payouts):
    """Bets spread over every evening (18:00-23:59), ignoring the match calendar: the evasive variant."""
    out = []
    pop = rng.lognormal(0, 0.6, size=len(bettors))
    pop /= pop.sum()
    for d in range(start_day, end_day):
        scale = 1.0 if ramp is None else min(1.0, ramp * ((d - start_day) // 7 + 1))
        n = rng.poisson(max(0.0, inr_per_day * scale / (MEAN_ROUND_STAKE if round_amounts else 900.0)))
        if n == 0:
            continue
        t = d * MIN_PER_DAY + rng.integers(18 * 60, 24 * 60, size=n)
        who = rng.choice(bettors, size=n, p=pop)
        if round_amounts:
            a = rng.choice(bet_cfg["stakes_round"], size=n, p=bet_cfg["stakes_round_p"])
        else:
            a = np.round(np.exp(rng.normal(np.log(bet_cfg["stake_nonround_median"]), 0.6, size=n)))
            a = np.where(a % 100 == 0, a + rng.integers(7, 93, size=n), a)
        out.append(pd.DataFrame({"t_min": t, "amount": a.astype(np.int64), "payer_id": who, "kind": KIND_PAYIN, "is_bet": True, "match_id": ""}))
        if payouts == "refunds":
            win = rng.random(n) < bet_cfg["win_prob"]
            if win.any():
                pay = np.round(a[win] * rng.uniform(*bet_cfg["odds"], size=int(win.sum())) / 10) * 10
                tp = np.minimum(t[win] + rng.integers(60, 240, size=int(win.sum())), cal.T_MIN - 1)
                out.append(pd.DataFrame({"t_min": tp, "amount": pay.astype(np.int64), "payer_id": who[win], "kind": 1, "is_bet": True, "match_id": ""}))
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=["t_min", "amount", "payer_id", "kind", "is_bet", "match_id"])


def build_world(merchant_specs: list[dict], cfg: dict, cal: Calendar, seed: int) -> dict:
    """merchant_specs: dicts with code, name, category, ward, daily_tx, onboard_day, fraud (Fraud or None), truth."""
    tpls = cfg["merchant_templates"]["categories"]
    var = cfg["merchant_templates"]["variation"]
    bet_cfg = cfg["scenarios"]["betting"]
    payers, synd = make_payers(cfg)
    rngb = rng_for(seed, "sandbox-banned")
    banned_bettors = np.sort(rngb.choice(synd["B"], size=2000, replace=False))
    other_bettors = np.setdiff1d(np.concatenate(list(synd.values())), banned_bettors)
    ward_payers = {w: payers.payer_id[payers.ward == w].to_numpy() for w in payers.ward.unique()}
    city_of_ward = payers.groupby("ward").city.first().to_dict()
    city_payers = {c: payers.payer_id[payers.city == c].to_numpy() for c in payers.city.unique()}
    bakery_how = _bakery_how()
    bakery_amounts = _bakery_amounts(cfg)
    rows, pays = [], []
    for i, ms in enumerate(merchant_specs):
        rng = rng_for(seed, f"sbx-{ms['code']}")
        cat = ms["category"]
        tpl = tpls[cat]
        how = _how_template(tpl, bakery_how)
        how = how * np.exp(rng.normal(0, var["hour_jitter_sigma"], size=how.shape)) * (how > 0)
        how = how / how.sum(axis=1).mean()
        local = rng.choice(ward_payers[ms["ward"]], size=min(int(np.clip(tpl["local_payers_per_daily_tx"] * ms["daily_tx"], 60, 2000)), 2500), replace=False)
        pool = city_payers[city_of_ward[ms["ward"]]]
        picker = PayerPicker(local, _zipf_weights(len(local), 0.8, rng), pool, tpl["walk_in_share"])
        normal = simulate_normal(cal, tpl, how, ms["daily_tx"], picker, rng, cat, var, None, onboard_day=ms.get("onboard_day", 0),
                                 offboard_day=None, bakery_amounts=bakery_amounts if cat == "bakery" else None)
        parts = [normal]
        fr: Fraud | None = ms.get("fraud")
        if fr is not None and fr.mode != "none" and fr.bet_inr_per_day > 0:
            n_b = 1200
            n_known = int(round(n_b * fr.known_front_share))
            bettors = np.concatenate([rng.choice(banned_bettors, size=n_known, replace=False),
                                      rng.choice(other_bettors, size=n_b - n_known, replace=False)])
            ramp = fr.ramp_per_week if fr.mode == "ramp" else None
            if fr.match_only:
                bpm = fr.bet_inr_per_day / MEAN_ROUND_STAKE
                bets = inject_betting(cal, bet_cfg, rng, bettors, fr.start_day, cal.days, bpm, fr.round_amounts,
                                      "refund" if fr.payouts == "refunds" else "none")
                if ramp is not None and len(bets):
                    d = bets.t_min.to_numpy() // MIN_PER_DAY
                    keep = rng.random(len(bets)) < np.minimum(1.0, ramp * ((d - fr.start_day) // 7 + 1))
                    bets = bets[keep]
            else:
                bets = _spread_bets(cal, bet_cfg, rng, bettors, fr.start_day, cal.days, fr.bet_inr_per_day, fr.round_amounts, ramp, fr.payouts)
            parts.append(bets)
        df = pd.concat(parts, ignore_index=True)
        df["merchant_id"] = i
        pays.append(df)
        first_bet = df.t_min[df.is_bet.astype(bool) & (df.kind == KIND_PAYIN)].min() if df.is_bet.astype(bool).any() else np.nan
        rows.append({"merchant_id": i, "code": ms["code"], "name": ms.get("name", ms["code"]), "category": cat, "ward": ms["ward"],
                     "city": city_of_ward[ms["ward"]], "tier": 1, "onboard_day": ms.get("onboard_day", 0), "offboard_day": cal.days,
                     "truth": ms.get("truth", "honest"), "scenario": "", "takeover_t_min": first_bet,
                     "device_id": f"DEV{i}", "director_id": f"DIR{i}", "settlement_account": f"ACC{i}", "base_daily_tx": ms["daily_tx"],
                     "declared_daily": ms.get("declared_daily", ms["daily_tx"]), "data_source": "simulated (sandbox)"})
    mdf = pd.DataFrame(rows)
    # a known front, already banned before the window starts: only its bettor list matters to the graph engine
    ban_id = len(mdf)
    mdf = pd.concat([mdf, pd.DataFrame([{"merchant_id": ban_id, "code": "BANNED", "name": "Known banned front", "category": "it_services",
                                         "ward": 0, "city": city_of_ward[0], "tier": 1, "onboard_day": 0, "offboard_day": 0,
                                         "truth": "banned_front", "scenario": "BF", "takeover_t_min": np.nan, "device_id": "DEVB",
                                         "director_id": "DIRB", "settlement_account": "ACCB", "base_daily_tx": 0, "declared_daily": 4,
                                         "data_source": "simulated (sandbox)"}])], ignore_index=True)
    pay = pd.concat(pays, ignore_index=True)
    pay = pay[(pay.t_min >= 0) & (pay.t_min < cal.T_MIN)]
    on = mdf.onboard_day.to_numpy()[pay.merchant_id.to_numpy()] * MIN_PER_DAY
    pay = pay[pay.t_min.to_numpy() >= on]
    pay["match_id"] = (pay["match_id"] if "match_id" in pay else pd.Series("", index=pay.index)).fillna("").astype(str)
    pay = pay.sort_values(["merchant_id", "t_min", "kind", "payer_id", "amount"], kind="mergesort").reset_index(drop=True)
    for c, t in [("amount", np.int64), ("payer_id", np.int32), ("merchant_id", np.int16), ("t_min", np.int32), ("kind", np.int8)]:
        pay[c] = pay[c].astype(t)
    pay["is_bet"] = pay["is_bet"].astype(bool)
    add_payment_fields(pay, payers, seed)
    banned = [{"code": "BANNED", "merchant_id": ban_id, "name": "Skyline Exports (a front banned earlier)", "ban_day": -14, "ban_t_min": 0,
               "bettors": banned_bettors, "syndicate": "B"}]
    return {"merchants": mdf, "payments": pay, "payers": payers, "banned": banned, "bakery_how": bakery_how,
            "ingest_report": {}, "syndicates": synd}


# --------------------------------------------------------------------------------------
# Scoring (the real engines) and the response layer
# --------------------------------------------------------------------------------------
def score_world(world: dict, cal: Calendar, cfg: dict) -> dict:
    t0 = time.perf_counter()
    with contextlib.redirect_stdout(io.StringIO()):
        R = run_engines(world, cal, cfg)
    F, ctx = R["F"], R["ctx"]
    p = FU.scorecard(F, cfg)
    lad = RS.ladder(p, F["n_engines"], F["active"], cfg["costs"])
    mdf, pay = world["merchants"], world["payments"]
    M, H, D = len(mdf), cal.H, cal.days
    pf = RS.fingerprint_flags(pay, cal, world["payers"], mdf, cfg)
    pin = pf[(pf.kind == 0) & pf.fingerprinted]
    fp_amt = np.bincount(pin.merchant_id.to_numpy().astype(np.int64) * H + pin.t_min.to_numpy() // 60,
                         weights=pin.amount.to_numpy(), minlength=M * H).reshape(M, H)
    from .pipeline import anchor_ticket, cohort_lift_daily

    ticket = anchor_ticket(F, ctx["anchor"], mdf, ctx["declared"])
    lift_d = cohort_lift_daily(F, ctx["E"], ctx["groups"], ticket, D)
    sigma = np.clip(ctx["anchor"]["daily_std"] / np.maximum(ctx["anchor"]["daily_mean"], 1), 0.1, 1.0)
    ready_d = ctx["anchor"]["ready_h"] // 24
    return {"F": F, "ctx": ctx, "p": p, "lad": lad, "pf": pf, "fp_amt": fp_amt, "ticket": ticket, "lift_d": lift_d,
            "sigma": sigma, "ready_d": ready_d, "seconds": time.perf_counter() - t0}


def reserve_for(i: int, world: dict, S: dict, cfg: dict) -> pd.DataFrame:
    mdf = world["merchants"]
    D = S["F"]["cnt"].shape[1] // 24
    declared_days = (np.arange(D) < S["ready_d"][i]) & (mdf.onboard_day.iloc[i] > 0)
    return RS.delta_reserve(S["F"]["cnt"][i], S["F"]["amt"][i], S["fp_amt"][i], S["ctx"]["E"][i], S["ticket"][i], S["lift_d"][i],
                            S["sigma"][i], S["lad"]["level_auto"][i], cfg["costs"], declared_days=declared_days)


ENGINE_TEMPLATES = {"drift": ["hours", "round", "amount", "volume", "declared"], "peers": ["peer"],
                    "invariants": ["match", "loop", "newpayers", "burst"], "graph": ["graph"]}


def reasons_at(i: int, h: int, world: dict, cal: Calendar, S: dict, cfg: dict, k: int = 3) -> list[dict]:
    """Top reasons: engines ordered by their scorecard contribution, each turned into a sentence whose
    numbers come from the payments (the same templates as the main app)."""
    F = S["F"]
    w = cfg["engines"]["fusion"]["scorecard"]
    contrib = {"drift": w["drift"] * F["drift_adj"][i, h], "peers": w["peers"] * F["peers_score"][i, h],
               "invariants": w["invariants"] * F["invariants_score"][i, h], "graph": w["graph"] * F["graph_score"][i, h]}
    rctx = ReasonContext(world, cal, {**S["ctx"]["anchor"], "declared_how": {c: v["how"] for c, v in S["ctx"]["declared"].items()}}, F, cfg)
    out = []
    for eng, c in sorted(contrib.items(), key=lambda kv: -kv[1]):
        if c <= 0.05:
            continue
        for tpl in ENGINE_TEMPLATES[eng]:
            r = reason_numbers(rctx, i, h, tpl)
            if r is not None:
                out.append({"engine": eng, "template": tpl, **r})
                break
        if len(out) >= k:
            break
    return out


def band_of(level: int) -> str:
    return "Act" if level >= 3 else ("Review" if level == 2 else "Watch")


# --------------------------------------------------------------------------------------
# Sandbox: one target merchant + peers
# --------------------------------------------------------------------------------------
SANDBOX_PLACEBOS = 300   # the sandbox uses 300 shifted calendars (the pipeline uses 1,000) to answer in about a second


def sandbox_config() -> dict:
    cfg = load_config()
    cfg["engines"]["invariants"]["match_clock"]["n_placebo"] = SANDBOX_PLACEBOS
    return cfg


def run_scenario(sc: Scenario) -> dict:
    cfg = sandbox_config()
    cal = _calendar(cfg, sc.diwali)
    tpls = cfg["merchant_templates"]["categories"]
    t0 = time.perf_counter()
    target_cat = "it_services" if sc.new_shell else sc.category
    peer_cat = target_cat
    specs = []
    if sc.new_shell:
        specs.append({"code": "TARGET", "name": "New 'IT services' shell", "category": "it_services", "ward": 3, "daily_tx": 0.5,
                      "declared_daily": tpls["it_services"]["daily_tx_median"], "onboard_day": sc.fraud.start_day,
                      "fraud": sc.fraud, "truth": "front"})
    else:
        base = {"bakery": 58.0, "sports_bar": 80.0}.get(target_cat, tpls[target_cat]["daily_tx_median"])
        specs.append({"code": "TARGET", "name": {"bakery": "Your bakery", "sports_bar": "Your sports bar"}.get(target_cat, "Your shop"),
                      "category": target_cat, "ward": 3, "daily_tx": base, "fraud": sc.fraud,
                      "truth": "front" if (sc.fraud.mode != "none" and sc.fraud.bet_inr_per_day > 0) else "honest"})
    rp = rng_for(sc.seed, "sbx-peers")
    for k in range(sc.n_peers):
        d = tpls[peer_cat]["daily_tx_median"] * float(np.exp(rp.normal(0, 0.35)))
        specs.append({"code": f"PEER{k:02d}", "name": f"Peer {k + 1}", "category": peer_cat, "ward": int(rp.integers(0, 20)), "daily_tx": d})
    world = build_world(specs, cfg, cal, sc.seed)
    S = score_world(world, cal, cfg)
    res = reserve_for(0, world, S, cfg)
    F, lad = S["F"], S["lad"]
    hh = np.arange(cal.H)
    d23 = hh[23::24]
    days = pd.DataFrame({
        "day": np.arange(cal.days) + 1, "date": [str((START + pd.Timedelta(days=d)).date()) for d in range(cal.days)],
        "payments": F["cnt"][0].reshape(cal.days, 24).sum(axis=1).astype(int),
        "inr": F["amt"][0].reshape(cal.days, 24).sum(axis=1),
        "drift": F["drift_fire"][0].reshape(cal.days, 24).any(axis=1), "peers": F["peer_fire"][0].reshape(cal.days, 24).any(axis=1),
        "invariants": F["invariants_fire"][0].reshape(cal.days, 24).any(axis=1), "graph": F["graph_fire"][0].reshape(cal.days, 24).any(axis=1),
        "engines": F["n_engines"][0].reshape(cal.days, 24).max(axis=1).astype(int),
        "level": lad["level"][0].reshape(cal.days, 24).max(axis=1).astype(int),
        "level_auto": lad["level_auto"][0].reshape(cal.days, 24).max(axis=1).astype(int),
        "held": res.held.to_numpy().reshape(cal.days, 24).sum(axis=1),
        "active": F["active"][0].reshape(cal.days, 24).any(axis=1),
    })
    pay0 = world["payments"][world["payments"].merchant_id == 0]
    bets = pay0[pay0.is_bet & (pay0.kind == 0)]
    bet_day = bets.groupby(bets.t_min // MIN_PER_DAY).amount.sum().reindex(range(cal.days), fill_value=0).to_numpy()
    days["betting_inr"] = bet_day
    days["band"] = [band_of(v) for v in days.level]
    l2 = np.where((lad["level"][0] >= 2) & F["active"][0])[0]
    held_h = np.where(res.held.to_numpy() > 0)[0]
    first_flag_h = int(l2[0]) if len(l2) else None
    first_hold_day = int(held_h[0] // 24) if len(held_h) else None
    first_bet_day = int(bets.t_min.min() // MIN_PER_DAY) if len(bets) else None
    # money that escaped: betting rupees in settlement batches that left before the first L3 hour
    l3 = np.where(lad["level_auto"][0] >= 3)[0]
    first_l3 = l3[0] if len(l3) else np.inf
    settle_h = (np.arange(cal.days) + 1) * 24 + cfg["costs"]["delta_reserve"]["settlement_hour"]
    escaped = float(max(0.0, bet_day.sum() - days.held.sum()))     # betting money that settled out to the front
    escaped_before_flag = float(bet_day[settle_h < first_l3].sum())
    peak_h = int(hh[F["active"][0]][np.argmax(S["p"][0][F["active"][0]])]) if F["active"][0].any() else 0
    rh = first_flag_h if first_flag_h is not None else peak_h
    reasons = reasons_at(0, rh, world, cal, S, cfg) if (first_flag_h is not None or S["p"][0][peak_h] > 0.02) else []
    return {
        "scenario": sc, "days": days, "first_flag_day": (first_flag_h // 24) if first_flag_h is not None else None,
        "first_flag_hour": first_flag_h, "first_hold_day": first_hold_day, "first_bet_day": first_bet_day,
        "held_total": float(days.held.sum()), "betting_total": float(bet_day.sum()), "escaped": escaped, "escaped_before_flag": escaped_before_flag,
        "max_level": int(days.level.max()), "max_level_auto": int(days.level_auto.max()), "reasons": reasons,
        "reason_hour": rh, "seconds": time.perf_counter() - t0, "engine_seconds": S["seconds"],
        "truth": specs[0]["truth"], "hourly_cnt": F["cnt"][0], "hourly_bets": np.bincount(bets.t_min // 60, minlength=cal.H)[:cal.H],
        "match_hour": cal.match_hour, "diwali_days": DIWALI_DAYS if sc.diwali else None, "anchor_days": ANCHOR_DAYS,
    }


# --------------------------------------------------------------------------------------
# Live feed: a mini city
# --------------------------------------------------------------------------------------
CITY = ([("bakery", f"Bakery {k + 1}") for k in range(8)] + [("sweet_shop", f"Sweet shop {k + 1}") for k in range(6)]
        + [("sports_bar", f"Sports bar {k + 1}") for k in range(4)] + [("kirana", f"Kirana {k + 1}") for k in range(6)])


def run_city(takeover: tuple[int, int] | None = None, diwali_start: int | None = None, seed: int = 42) -> dict:
    """takeover = (merchant index, start day); diwali_start = first festival day. Returns payments and per-hour states."""
    cfg = sandbox_config()
    cal = _calendar(cfg, diwali_start is not None, diwali_start if diwali_start is not None else DIWALI_DAYS[0])
    tpls = cfg["merchant_templates"]["categories"]
    rp = rng_for(seed, "city-sizes")
    specs = []
    for k, (cat, name) in enumerate(CITY):
        fr = None
        truth = "honest"
        if takeover is not None and takeover[0] == k:
            fr = Fraud(bet_inr_per_day=150_000, mode="overnight", start_day=int(takeover[1]), known_front_share=0.3)
            truth = "front"
        specs.append({"code": f"C{k:02d}", "name": name, "category": cat, "ward": int(k % 20), "truth": truth, "fraud": fr,
                      "daily_tx": tpls[cat]["daily_tx_median"] * float(np.exp(rp.normal(0, 0.3)))})
    world = build_world(specs, cfg, cal, seed)
    S = score_world(world, cal, cfg)
    return {"world": world, "cal": cal, "S": S, "cfg": cfg}
