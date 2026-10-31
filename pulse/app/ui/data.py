"""Cached artefact loaders. The app never recomputes the pipeline."""
from __future__ import annotations

import json
import pathlib

import numpy as np
import pandas as pd
import streamlit as st

ROOT = pathlib.Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts"


def ready() -> bool:
    return (ART / "eval" / "scenario_scorecard.json").exists()


@st.cache_data(show_spinner=False)
def js(name: str):
    return json.loads((ART / name).read_text())


@st.cache_data(show_spinner=False)
def pq(name: str) -> pd.DataFrame:
    return pd.read_parquet(ART / name)


@st.cache_data(show_spinner=False)
def merchants() -> pd.DataFrame:
    return pd.read_parquet(ART / "merchants.parquet")


@st.cache_data(show_spinner=False)
def hourly(code: str) -> pd.DataFrame:
    m = merchants()
    i = int(m.merchant_id[m.code == code].iloc[0])
    h = pq("hourly_focus.parquet")
    return h[h.merchant_id == i].reset_index(drop=True)


@st.cache_data(show_spinner=False)
def payments(code: str) -> pd.DataFrame:
    m = merchants()
    i = int(m.merchant_id[m.code == code].iloc[0])
    p = pq("payments_focus.parquet")
    return p[p.merchant_id == i].reset_index(drop=True)


@st.cache_data(show_spinner=False)
def daily(merchant_id: int) -> pd.DataFrame:
    d = pq("daily.parquet")
    return d[d.merchant_id == merchant_id].reset_index(drop=True)


@st.cache_data(show_spinner=False)
def lab_arrays():
    z = np.load(ART / "engines_lab_arrays.npz")
    return {k: z[k] for k in z.files}


@st.cache_data(show_spinner=False)
def reasons_for(code: str, kind: str | None = None) -> list[dict]:
    m = merchants()
    i = int(m.merchant_id[m.code == code].iloc[0])
    return [r for r in js("reasons.json") if r["merchant_id"] == i and (kind is None or r["kind"] == kind)]


@st.cache_data(show_spinner=False)
def text(path: str) -> str:
    return (ROOT / path).read_text()


def meta() -> dict:
    return js("meta.json")


def hour_label(h: int, fmt: str = "%a %d %b %H:00") -> str:
    start = pd.Timestamp(meta()["window_start"])
    return (start + pd.Timedelta(hours=int(h))).strftime(fmt)


def date_of_hour(h) -> pd.Timestamp:
    start = pd.Timestamp(meta()["window_start"])
    return start + pd.to_timedelta(np.asarray(h), unit="h")
