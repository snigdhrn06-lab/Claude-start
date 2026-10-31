import pandas as pd

from conftest import ROOT


def test_no_train_test_merchant_overlap(art):
    m = pd.read_parquet(art / "merchants.parquet")
    train = set(m.merchant_id[m.split == "train"])
    test = set(m.merchant_id[m.split == "test"])
    assert train and test and not (train & test)
    assert len(train | test) == len(m)


def test_scenarios_in_test_and_stratified(art):
    m = pd.read_parquet(art / "merchants.parquet")
    assert (m[m.scenario.isin(["S0", "S1", "S2", "S3", "S4", "S5", "E1", "E2", "E3"])].split == "test").all()
    free = m[m.scenario.isin(["", "extra"])]
    for truth in ["honest", "front"]:
        share = (free[free.truth == truth].split == "test").mean()
        assert 0.25 <= share <= 0.35


def test_calibration_fold_is_inside_training(art):
    m = pd.read_parquet(art / "merchants.parquet")
    assert not (m.calibration_fold & (m.split == "test")).any()
    _ = ROOT
