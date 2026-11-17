"""Sandbox presets: honest shops stay quiet, fronts get caught, and the run is fast and deterministic."""
import pytest

from pulse import minisim as MS


@pytest.fixture(scope="module")
def results():
    return {name: MS.run_scenario(sc) for name, sc in MS.PRESETS.items()}


def test_honest_presets_never_reach_review(results):
    for name in MS.EXPECTED_HONEST:
        r = results[name]
        assert r["max_level"] <= 1, f"{name} reached L{r['max_level']}"
        assert r["held_total"] == 0, f"{name} held money"


@pytest.mark.parametrize("name", ["Overnight takeover", "Slow ramp", "New shell"])
def test_loud_fronts_are_caught_and_held(results, name):
    r = results[name]
    assert r["first_flag_day"] is not None and r["first_flag_day"] >= 0, f"{name} never flagged"
    assert r["held_total"] > 0, f"{name} held nothing"


def test_overnight_takeover_flagged_same_day(results):
    r = results["Overnight takeover"]
    assert r["first_flag_day"] == r["first_bet_day"]


def test_sandbox_is_deterministic():
    sc = MS.PRESETS["Overnight takeover"]
    a, b = MS.run_scenario(sc), MS.run_scenario(sc)
    assert a["first_flag_day"] == b["first_flag_day"] and a["held_total"] == b["held_total"]
