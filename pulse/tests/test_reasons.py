"""Every number in a reason sentence is computed from the data, not hard-coded."""
import re

import numpy as np
import pandas as pd
import pytest

from conftest import load_json


def _nums(text):
    return [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*\.?\d*", text)]


@pytest.fixture(scope="module")
def data(art):
    return {"reasons": load_json(art / "reasons.json"), "net": load_json(art / "network.json"), "pay": pd.read_parquet(art / "payments_focus.parquet"),
            "meta": load_json(art / "meta.json"), "m": pd.read_parquet(art / "merchants.parquet")}


def test_reason_numbers_match_their_text(data):
    """Each figure printed in a sentence appears in the stored numbers (after the same rounding)."""
    checked = 0
    for r in data["reasons"]:
        for x in r["reasons"]:
            vals = []
            for v in x["numbers"].values():
                if isinstance(v, (int, float)):
                    vals += [v, round(v), round(100 * v), round(v, 1), round(v, 2)]
            for n in _nums(x["text"]):
                if n in (24, 7, 30, 10, 100, 1, 0) or (n <= 23 and "between" in x["text"]):
                    continue  # window lengths, hours of day and the Rs 100 modulus are definitions, not data
                if re.search(r"\b\d{1,2} (Sep|Oct|Nov|Aug|Jul|Jun|May)\b", x["text"]) and n <= 31:
                    continue  # ban dates
                assert any(abs(n - v) < 0.051 for v in vals), (x["text"], n, x["numbers"])
                checked += 1
    assert checked > 20


def _in_windows(t, moments_windows):
    return np.array([any(a <= x < b for a, b in moments_windows) for x in t])


def test_match_share_recomputed_independently(data):
    meta = data["meta"]
    windows = [(f["w0"], f["t_end"]) for f in meta["fixtures_in_window"]]
    pay = data["pay"]
    have = set(pay.merchant_id.unique())
    n = 0
    for r in data["reasons"]:
        if r["merchant_id"] not in have:
            continue
        for x in r["reasons"]:
            if x["template"] != "match":
                continue
            h = r["hour"]
            p = pay[(pay.merchant_id == r["merchant_id"]) & (pay.kind == 0) & (pay.t_min >= (h - 23) * 60) & (pay.t_min < (h + 1) * 60)]
            share = _in_windows(p.t_min.to_numpy(), windows).mean()
            assert share == pytest.approx(x["numbers"]["share_last24"], abs=1e-5)  # JSON keeps 6 decimals
            n += 1
    assert n > 0


def test_graph_first_payers_recomputed(data):
    """S5: 'k of its first n payers also paid <banned front>' recomputed from raw payments at the reason's hour."""
    pay, m = data["pay"], data["m"]
    s5 = int(m.merchant_id[m.code == "S5"].iloc[0])
    bettor_flag = {d["payer_id"]: d["bf2_bettor"] for d in data["net"]["s5_first_payers"]}
    found = 0
    for r in data["reasons"]:
        if r["merchant_id"] != s5:
            continue
        p = pay[(pay.merchant_id == s5) & (pay.kind == 0) & (pay.t_min < (r["hour"] + 1) * 60)]
        firsts = p.sort_values("t_min").drop_duplicates("payer_id").head(20).payer_id
        for x in r["reasons"]:
            if x["template"] == "graph" and "first" in x["text"]:
                assert x["numbers"]["n_payers"] == len(firsts)
                assert x["numbers"]["shared"] == sum(bettor_flag[u] for u in firsts)
                found += 1
    assert found


def test_loop_amount_recomputed(data):
    pay = data["pay"]
    have = set(pay.merchant_id.unique())
    n = 0
    for r in data["reasons"]:
        if r["merchant_id"] not in have:
            continue
        for x in r["reasons"]:
            if x["template"] != "loop":
                continue
            h = r["hour"]
            out = pay[(pay.merchant_id == r["merchant_id"]) & (pay.kind == 1) & (pay.t_min >= (h - 167) * 60) & (pay.t_min < (h + 1) * 60)]
            assert out.amount.sum() == pytest.approx(x["numbers"]["refund_inr_7d"])
            n += 1
    assert n > 0
