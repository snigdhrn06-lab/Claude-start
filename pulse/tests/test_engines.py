"""Each engine gives the known answer on tiny hand-built cases."""
import numpy as np
import pytest
from scipy.optimize import minimize_scalar
from scipy.stats import hypergeom

from pulse.engines.drift import cusum_upper, js_divergence, noisy_or, wasserstein_hist
from pulse.engines.graph import _distinct_window, adamic_adar, expected_shared, shared_pvalue
from pulse.engines.invariants import loop_ratio, match_beta
from pulse.engines.peers import naive_false_alarms, persistence, robust_z


def test_js_identical_is_zero():
    p = np.array([1, 2, 3, 4.0])
    assert js_divergence(p, p.copy()) == pytest.approx(0.0, abs=1e-12)


def test_js_disjoint_is_one():
    assert js_divergence(np.array([1, 0.0]), np.array([0, 1.0])) == pytest.approx(1.0)


def test_js_symmetric_and_bounded():
    rng = np.random.default_rng(0)
    p, q = rng.random(168), rng.random(168)
    assert js_divergence(p, q) == pytest.approx(js_divergence(q, p))
    assert 0 <= js_divergence(p, q) <= 1


def test_wasserstein_identical_zero_and_shift():
    edges = np.arange(6.0)
    p = np.array([0, 1, 0, 0, 0.0])
    q = np.array([0, 0, 0, 1, 0.0])
    assert wasserstein_hist(p, p, edges) == pytest.approx(0.0)
    assert wasserstein_hist(p, q, edges) == pytest.approx(2.0)  # mass moved two bins of width 1


def test_cusum_known_sequence():
    z = np.array([0, 2, 2, -3, 1.0])
    # S: 0, 1.5, 3.0, 0 (3 - 3 - 0.5 < 0), 0.5
    assert cusum_upper(z, 0.5).tolist() == pytest.approx([0, 1.5, 3.0, 0, 0.5])


def test_noisy_or_floors():
    out = noisy_or({"a": np.array([0.1, 0.3, 0.5])}, {"a": 0.5}, {"a": 1.0}, {"a": 0.1})
    assert out.tolist() == pytest.approx([0.0, 0.5, 1.0])


def test_loop_ratio_all_payees_are_payers():
    assert loop_ratio({1, 2, 3, 4}, {2, 3}) == 1.0


def test_loop_ratio_none_and_empty():
    assert loop_ratio({1, 2}, {7, 8}) == 0.0
    assert loop_ratio({1, 2}, set()) == 0.0


def test_match_beta_equals_poisson_glm_mle():
    """Closed form equals the numerical MLE of log(mu) = log(offset) + a + b * live."""
    rng = np.random.default_rng(1)
    e = rng.uniform(0.5, 3, 200)
    live = rng.random(200) < 0.2
    y = rng.poisson(e * np.exp(0.3 + 1.2 * live))
    y1, e1, y0, e0 = y[live].sum(), e[live].sum(), y[~live].sum(), e[~live].sum()
    b_closed = match_beta(y1, e1, y0, e0, s=0.0)
    a_hat = np.log(y0 / e0)  # profile out the intercept

    def nll(b):
        mu = e * np.exp(a_hat + b * live)
        return -(y * np.log(mu) - mu).sum()

    b_num = minimize_scalar(nll, bounds=(-5, 5), method="bounded").x
    assert b_closed == pytest.approx(b_num, abs=1e-4)


def test_hypergeometric_expectation_matches_formula():
    assert expected_shared(50_000, 2000, 20) == pytest.approx(20 * 2000 / 50_000)
    assert expected_shared(5_000_000, 2000, 20) == pytest.approx(0.008)
    assert hypergeom.mean(50_000, 2000, 20) == pytest.approx(expected_shared(50_000, 2000, 20))


def test_shared_pvalue_tail():
    p = shared_pvalue(np.array([12]), 50_000, 2000, 20)[0]
    assert p == pytest.approx(hypergeom.sf(11, 50_000, 2000, 20))
    assert p < 1e-10
    assert shared_pvalue(np.array([0]), 50_000, 2000, 20)[0] == 1.0


def test_adamic_adar():
    deg = {1: 2, 2: np.e ** 2}
    assert adamic_adar([1, 2], deg) == pytest.approx(1 / np.log(2) + 0.5)


def test_distinct_window_counts_each_payer_once():
    # merchant 0: payer 5 pays at hours 0, 1, 2; payer 6 at hour 1. Window 2 hours.
    m = np.array([0, 0, 0, 0])
    p = np.array([5, 5, 5, 6])
    h = np.array([0, 1, 2, 1])
    out = _distinct_window(m, p, h, np.ones(4), 1, 5, 2)[0]
    assert out.tolist() == [1, 2, 2, 1, 0]


def test_robust_z_and_persistence():
    gaps = np.array([[0.0], [0.1], [-0.1], [0.05], [2.0]])
    z = robust_z(gaps, 0.01)
    assert z[-1, 0] > 3 and abs(z[0, 0]) < 1
    fire = np.array([[1, 0, 1, 1, 0, 0, 0, 0]], bool)
    assert persistence(fire, 3).tolist() == [[1, 1, 2, 2, 2, 1, 0, 0]]


def test_naive_false_alarm_arithmetic():
    r = naive_false_alarms()
    assert r["p_tail"] == pytest.approx(0.00135, rel=0.01)
    assert r["expected_alarms"] == pytest.approx(1350, rel=0.01)
