"""Simulation calendar: hourly grid, fixtures -> match windows and live-match moments, festivals."""
from __future__ import annotations

import dataclasses

import numpy as np
import pandas as pd

MIN_PER_DAY = 1440


@dataclasses.dataclass
class Calendar:
    start: pd.Timestamp
    days: int
    baseline_days: int
    fixtures: pd.DataFrame          # in-window fixtures with minute offsets
    windows: np.ndarray             # (n, 2) match windows [from, to) in minutes since start
    moments: pd.DataFrame           # live moments: match_id, moment, t0, t1 (minutes)
    live_hour: np.ndarray           # (H,) bool: hour overlaps a live-match moment
    match_hour: np.ndarray          # (H,) bool: hour overlaps a match window
    festivals: pd.DataFrame

    @property
    def H(self) -> int:
        return self.days * 24

    @property
    def T_MIN(self) -> int:
        return self.days * MIN_PER_DAY

    def date_of_day(self, d: int) -> pd.Timestamp:
        return self.start + pd.Timedelta(days=int(d))

    def day_of(self, date) -> int:
        return int((pd.Timestamp(date) - self.start).days)

    def hour_label(self, h: int) -> str:
        return (self.start + pd.Timedelta(hours=int(h))).strftime("%a %d %b %H:00")

    def dow(self) -> np.ndarray:
        """Day-of-week (Mon=0) for each day index."""
        return np.array([(self.start + pd.Timedelta(days=d)).dayofweek for d in range(self.days)])

    def how_of_hour(self) -> np.ndarray:
        """Hour-of-week index 0..167 (Mon 00:00 = 0) for each hour of the grid."""
        dow = self.dow()
        return (np.repeat(dow, 24) * 24 + np.tile(np.arange(24), self.days)).astype(np.int16)

    def in_windows(self, t_min: np.ndarray, which: str = "match") -> np.ndarray:
        """Vectorised membership of minute timestamps in match windows or live moments."""
        iv = self.windows if which == "match" else self.moments[["t0", "t1"]].to_numpy()
        if len(iv) == 0:
            return np.zeros(len(t_min), bool)
        iv = _merge(iv)
        idx = np.searchsorted(iv[:, 0], t_min, side="right") - 1
        ok = idx >= 0
        res = np.zeros(len(t_min), bool)
        res[ok] = t_min[ok] < iv[idx[ok], 1]
        return res

    def festival_multipliers(self, category: str) -> tuple[np.ndarray, np.ndarray]:
        """Per-day (day, evening) multipliers for a category."""
        day = np.ones(self.days)
        eve = np.ones(self.days)
        for _, r in self.festivals.iterrows():
            if category in r["categories"].split("|"):
                d = self.day_of(r["date"])
                if 0 <= d < self.days:
                    day[d] = r["day_multiplier"]
                    eve[d] = r["evening_multiplier"]
        return day, eve


def _merge(iv: np.ndarray) -> np.ndarray:
    iv = iv[np.argsort(iv[:, 0])]
    out = [list(iv[0])]
    for a, b in iv[1:]:
        if a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return np.array(out, dtype=np.int64)


def _hour_mask(intervals: np.ndarray, H: int) -> np.ndarray:
    m = np.zeros(H, bool)
    for a, b in intervals:
        h0, h1 = max(0, a // 60), min(H, (b - 1) // 60 + 1)
        if h1 > h0:
            m[h0:h1] = True
    return m


def build_calendar(cfg: dict, root) -> Calendar:
    s = cfg["settings"]
    start = pd.Timestamp(s["window"]["start"])
    days = s["window"]["days"]
    fx = pd.read_csv(root / s["paths"]["events"] / "fixtures.csv", dtype=str)
    fest = pd.read_csv(root / s["paths"]["events"] / "festivals.csv")
    fmt = cfg["engines"]["calendar"]["formats"]
    rows_w, rows_m, rows_f = [], [], []
    for _, r in fx.iterrows():
        f = fmt[r["format"]]
        t_start = pd.Timestamp(f"{r['date']} {r['start_time_ist']}")
        ndays = f.get("days", 1)
        for k in range(ndays):
            st = int((t_start + pd.Timedelta(days=k) - start).total_seconds() // 60)
            w0 = st - 30 if k == 0 else st
            w1 = st + f["duration_min"]
            if w1 <= 0 or w0 >= days * MIN_PER_DAY:
                continue
            rows_w.append((w0, w1))
            rows_f.append({**r.to_dict(), "day_k": k, "t_start": st, "t_end": w1, "w0": w0})
            for name, (a, b) in f["moments"].items():
                if name == "toss" and k > 0:
                    continue
                rows_m.append({"match_id": r["match_id"], "moment": name, "t0": st + a, "t1": st + b, "format": r["format"]})
    windows = np.array(rows_w, dtype=np.int64).reshape(-1, 2)
    moments = pd.DataFrame(rows_m)
    H = days * 24
    cal = Calendar(
        start=start,
        days=days,
        baseline_days=s["window"]["baseline_days"],
        fixtures=pd.DataFrame(rows_f),
        windows=windows,
        moments=moments,
        live_hour=_hour_mask(moments[["t0", "t1"]].to_numpy(), H),
        match_hour=_hour_mask(windows, H),
        festivals=fest,
    )
    return cal
