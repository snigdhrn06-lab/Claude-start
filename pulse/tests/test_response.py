import numpy as np
import pytest

from pulse.config import load_config
from pulse.response import apply_consent, decide_level, delta_reserve, hold, level_thresholds


@pytest.fixture
def costs():
    return load_config()["costs"]


def test_thresholds_follow_cost_inequality(costs):
    thr = level_thresholds(costs)
    for L, t in thr.items():
        c = costs["c_friction"][L]
        # just above the threshold the inequality holds; just below it does not
        assert (t + 1e-6) * costs["c_fraud"] > (1 - t - 1e-6) * c
        assert (t - 1e-6) * costs["c_fraud"] < (1 - t + 1e-6) * c


def test_corroboration_caps_single_engine_at_l1(costs):
    """However high p is, one engine alone can only reach L1 (silent check); L2+ needs two."""
    p = np.array([0.99, 0.99, 0.99])
    n = np.array([0, 1, 2])
    lv = decide_level(p, n, costs)
    assert lv[0] <= 1 and lv[1] <= 1 and lv[2] >= 2


def test_hold_is_trailing_max():
    lv = np.array([[0, 3, 0, 0, 0, 0]], np.int8)
    assert hold(lv, 3).tolist() == [[0, 3, 3, 3, 0, 0]]


def test_delta_reserve_holds_only_fingerprinted_surplus(costs):
    H = 48
    E = np.ones(H)
    amt = np.full(H, 300.0)
    fp = np.zeros(H)
    amt[20] = 20_000.0
    fp[20] = 4_000.0       # only Rs 4,000 of the surge carries a betting fingerprint
    lvl = np.zeros(H, np.int8)
    lvl[21:] = 3
    df = delta_reserve(np.ones(H), amt, fp, E, 300.0, np.zeros(H // 24), 0.2, lvl, costs)
    assert df.held.sum() == pytest.approx(4_000.0)
    assert (df.held <= df.fingerprinted + 1e-9).all()


def test_delta_reserve_cohort_lift_raises_tolerated(costs):
    H = 24
    E = np.ones(H)
    amt = np.full(H, 300.0 * 4.5)
    fp = amt.copy()
    lvl = np.full(H, 3, np.int8)
    quiet = delta_reserve(np.ones(H), amt, fp, E, 300.0, np.zeros(1), 0.2, lvl, costs)
    festival = delta_reserve(np.ones(H), amt, fp, E, 300.0, np.full(1, np.log(4.5)), 0.2, lvl, costs)
    assert quiet.held.sum() > 0 and festival.held.sum() == 0


def test_consent_never_penalises_refusal():
    cfg = load_config()
    r = apply_consent(0.4, None, 0, cfg)
    assert r["p"] == 0.4 and r["delta_logit"] == 0
