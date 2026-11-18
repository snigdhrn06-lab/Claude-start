"""The Act rule (needs a betting-specific engine) and the real-shop test plumbing."""
import json
import pathlib

import numpy as np
import pytest

from pulse import response as RS
from pulse.real_shops import map_customers

ROOT = pathlib.Path(__file__).resolve().parents[1]
COSTS = {"c_fraud": 100, "c_friction": {"L1": 1, "L2": 6, "L3": 12, "L4": 40, "L5": 120},
         "min_engines": {"L1": 0, "L2": 2, "L3": 2, "L4": 3, "L5": 3}, "act_needs_betting_engine": True}


def test_drift_and_peers_alone_stop_at_review():
    p = np.array([[0.99]])
    two = np.array([[2]])
    assert RS.decide_level(p, two, COSTS, betting=np.array([[False]]))[0, 0] == 2
    assert RS.decide_level(p, two, COSTS, betting=np.array([[True]]))[0, 0] == 3


def test_rule_can_be_switched_off():
    off = {**COSTS, "act_needs_betting_engine": False}
    assert RS.decide_level(np.array([[0.99]]), np.array([[2]]), off, betting=np.array([[False]]))[0, 0] == 3


def test_customer_mapping_is_one_to_one_and_deterministic():
    shops = [{"code": "A", "customer": np.array(["x", "y", "x", "z"]), "local": np.array([True, False, True, True])},
             {"code": "B", "customer": np.array(["y", "w"]), "local": np.array([False, True])}]
    pools = {"C1": np.arange(0, 100), "C2": np.arange(100, 200)}
    map_customers(shops, {"A": "C1", "B": "C2"}, pools, seed=42)
    a, b = shops[0]["payer_id"], shops[1]["payer_id"]
    assert a[0] == a[2]                        # same customer, same payer
    assert a[1] == b[0]                        # same customer across shops
    assert len({a[0], a[1], a[3], b[1]}) == 4  # different customers never share a payer
    assert a[0] < 100 and a[1] >= 100          # local customers from the home city, others from elsewhere


def test_real_shops_report_is_separate_from_test_metrics():
    p = ROOT / "artifacts" / "eval" / "real_shops.json"
    if not p.exists():
        pytest.skip("real-shop data not fetched")
    r = json.loads(p.read_text())
    assert r["dev"]["summary"]["shops"] > 0
    assert all(s["code"].startswith("R_") for s in r["dev"]["shops"])
    m = json.loads((ROOT / "artifacts" / "eval" / "metrics.json").read_text())["stage_c_calibrated_lightgbm"]
    assert m["n_test_honest"] == 77            # real shops never enter the simulated test set
