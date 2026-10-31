"""The scenario scorecard matches the expected outcomes for S0-S5 (E1-E3 are reported, not asserted)."""
import pandas as pd
import pytest

from conftest import load_json


@pytest.mark.parametrize("sid", ["S0", "S1", "S2", "S3", "S4", "S5"])
def test_scenario_expected_outcome(art, sid):
    card = {r["id"]: r for r in load_json(art / "eval" / "scenario_scorecard.json")}
    assert card[sid]["pass"], f"{sid}: {card[sid]['actual']}"


def test_e_scenarios_are_reported(art):
    card = {r["id"]: r for r in load_json(art / "eval" / "scenario_scorecard.json")}
    for sid in ["E1", "E2", "E3"]:
        assert card[sid]["report_only"] and card[sid]["actual"]


def test_s1_reserve_holds_zero(art):
    for name in ["reserve_S1.parquet", "reserve_S1_forced.parquet"]:
        r = pd.read_parquet(art / name)
        assert r.held.sum() == 0


def test_s3_reserve_positive_and_only_fingerprinted(art):
    r = pd.read_parquet(art / "reserve_S3.parquet")
    assert r.held.sum() > 0
    assert (r.held <= r.fingerprinted + 1e-6).all()
    assert (r.held[r.fingerprinted == 0] == 0).all()
