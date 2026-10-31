"""Fusion: Stage A expert scorecard, Stage B monotone LightGBM, Stage C isotonic calibration, SHAP."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import rng_for
from .scoring import ALL_FEATURES, ENGINE_OF, FEATURES


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def scorecard(F: dict, cfg: dict) -> np.ndarray:
    """Stage A: expert-weighted logistic scorecard over engine scores. Needs no labels (shadow mode)."""
    w = cfg["engines"]["fusion"]["scorecard"]
    z = (w["intercept"] + w["drift"] * F["drift_adj"] + w["peers"] * F["peers_score"] + w["invariants"] * F["invariants_score"]
         + w["graph"] * F["graph_score"] + w["two_engines_bonus"] * (F["n_engines"] >= 2))
    return sigmoid(z).astype(np.float32)


def labels_hourly(mdf: pd.DataFrame, H: int) -> np.ndarray:
    """1 for front merchant-hours from the first betting payment onwards."""
    t_h = (mdf.takeover_t_min.fillna(np.inf).to_numpy() // 60)
    is_front = mdf.truth.isin(["front", "banned_front"]).to_numpy()
    hh = np.arange(H)[None, :]
    return (is_front[:, None] & (hh >= t_h[:, None])).astype(np.int8)


def daily_table(F: dict, mdf: pd.DataFrame, Y: np.ndarray, cols=None) -> pd.DataFrame:
    """Merchant-day snapshots at hour 23 (the window that covers the calendar day)."""
    M, H = Y.shape
    D = H // 24
    mm, dd = np.meshgrid(np.arange(M), np.arange(D), indexing="ij")
    hh = dd * 24 + 23
    act = F["active"][mm, hh]
    mm, dd, hh = mm[act], dd[act], hh[act]
    cols = cols or ALL_FEATURES
    df = pd.DataFrame({c: F[c][mm, hh].astype(np.float32) for c in cols})
    df["merchant_id"] = mm
    df["day"] = dd
    df["hour"] = hh
    df["y"] = Y[mm, hh]
    df["split"] = mdf.split.to_numpy()[mm]
    return df


def calibration_merchants(mdf: pd.DataFrame, cfg: dict) -> np.ndarray:
    """Hold out a share of TRAINING merchants (stratified by truth) for isotonic calibration."""
    rng = rng_for(cfg["settings"]["seed"], "calibration-fold")
    share = cfg["engines"]["fusion"]["calibration_share"]
    out = np.zeros(len(mdf), bool)
    for truth in ["honest", "front", "banned_front"]:
        idx = np.where((mdf.split == "train").to_numpy() & (mdf.truth == truth).to_numpy())[0]
        if truth == "banned_front":
            continue  # seed fronts always stay in the fitting fold
        idx = idx[rng.permutation(len(idx))]
        out[idx[: int(round(len(idx) * share))]] = True
    return out


class FusionModel:
    def __init__(self, cfg: dict, features: list[str]):
        self.cfg = cfg
        self.features = features
        self.model = None
        self.iso = None
        self.best_iter = None
        self.valid_curve = None

    def fit(self, daily: pd.DataFrame, calib_mask_m: np.ndarray):
        import lightgbm as lgb
        from sklearn.isotonic import IsotonicRegression

        fc = self.cfg["engines"]["fusion"]
        p = dict(fc["lightgbm"])
        n_est = p.pop("n_estimators")
        params = dict(objective="binary", random_state=self.cfg["settings"]["seed"], deterministic=True, force_row_wise=True,
                      num_threads=1, verbose=-1, monotone_constraints=[1] * len(self.features), **p)
        train = daily[daily.split == "train"]
        is_cal = calib_mask_m[train.merchant_id.to_numpy()]
        fit_df, cal_df = train[~is_cal], train[is_cal]
        # time-aware validation inside the fitting fold: earlier days train, later days validate
        cut = fc["time_split_day"]
        tr, va = fit_df[fit_df.day < cut], fit_df[fit_df.day >= cut]
        m0 = lgb.LGBMClassifier(n_estimators=n_est, **params)
        m0.fit(tr[self.features], tr.y, eval_set=[(va[self.features], va.y)], eval_metric="average_precision",
               callbacks=[lgb.early_stopping(40, verbose=False)])
        self.best_iter = int(max(20, m0.best_iteration_ or n_est))
        self.valid_curve = {k: list(map(float, v)) for k, v in m0.evals_result_["valid_0"].items()}
        self.model = lgb.LGBMClassifier(n_estimators=self.best_iter, **params)
        self.model.fit(fit_df[self.features], fit_df.y)
        raw = self.model.predict_proba(cal_df[self.features])[:, 1]
        self.iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0, increasing=True)
        self.iso.fit(raw, cal_df.y.to_numpy())
        self.cal_raw, self.cal_y = raw, cal_df.y.to_numpy()
        return self

    def raw(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict_proba(X[self.features])[:, 1]

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.iso.predict(self.raw(X)).astype(np.float32)

    def predict_grid(self, F: dict, chunk_rows: int = 400_000) -> np.ndarray:
        M, H = F["active"].shape
        out = np.zeros((M, H), np.float32)
        flat = np.column_stack([F[c].reshape(-1).astype(np.float32) for c in self.features])
        act = F["active"].reshape(-1)
        idx = np.where(act)[0]
        res = np.zeros(len(idx), np.float32)
        for s in range(0, len(idx), chunk_rows):
            sl = idx[s:s + chunk_rows]
            X = pd.DataFrame(flat[sl], columns=self.features)
            res[s:s + chunk_rows] = self.predict(X)
        out.reshape(-1)[idx] = res
        return out

    def shap(self, X: pd.DataFrame) -> np.ndarray:
        import warnings

        import shap

        expl = shap.TreeExplainer(self.model.booster_)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sv = expl.shap_values(X[self.features].astype(np.float64))
        if isinstance(sv, list):
            sv = sv[1]
        return np.asarray(sv)


def reliability(p: np.ndarray, y: np.ndarray, bins: int = 10) -> pd.DataFrame:
    edges = np.array([0, 0.01, 0.03, 0.06, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1.0001])
    b = np.digitize(p, edges) - 1
    rows = []
    for i in range(len(edges) - 1):
        s = b == i
        if s.sum() == 0:
            continue
        rows.append({"bin_lo": float(edges[i]), "bin_hi": float(min(edges[i + 1], 1.0)), "mean_p": float(p[s].mean()),
                     "observed": float(y[s].mean()), "n": int(s.sum())})
    return pd.DataFrame(rows)


def engine_contributions(sv: np.ndarray, features: list[str]) -> pd.DataFrame:
    """Sum SHAP values per engine."""
    df = pd.DataFrame(sv, columns=features)
    return pd.DataFrame({e: df[[f for f in FEATURES[e] if f in features]].sum(axis=1) for e in FEATURES})


__all__ = ["FusionModel", "scorecard", "labels_hourly", "daily_table", "calibration_merchants", "reliability",
           "engine_contributions", "ENGINE_OF"]
