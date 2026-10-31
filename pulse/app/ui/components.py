"""Reusable UI pieces."""
from __future__ import annotations

import html

import streamlit as st

from .theme import DARK, GREY, JADE, LEVEL_COLORS

LEVEL_NAMES = {0: "Watch", 1: "Silent check", 2: "Micro-proof", 3: "Delta reserve", 4: "Restrict", 5: "Exit + STR draft"}


def header() -> None:
    st.markdown(
        "<div class='pulse-header'><div class='logo'>P</div><div class='brand'>PULSE</div>"
        "<div class='tag'>pattern-of-life engine for PayU</div>"
        "<div class='right'>Prototype · Follow the Money: Innovation Challenge</div></div>",
        unsafe_allow_html=True,
    )


def title(text: str, simulated: bool = True, real: bool = False, sub: str | None = None) -> None:
    badge = ""
    if real:
        badge += "<span class='real-badge'>Real data</span>"
    if simulated:
        badge += "<span class='sim-badge'>Simulated</span>"
    st.markdown(f"<h1 style='margin-bottom:0'>{html.escape(text)}{badge}</h1>", unsafe_allow_html=True)
    if sub:
        st.markdown(f"<div class='muted' style='margin:2px 0 14px 0;font-size:15px'>{sub}</div>", unsafe_allow_html=True)


def badge(simulated: bool = True) -> str:
    return "<span class='sim-badge'>Simulated</span>" if simulated else "<span class='real-badge'>Real data</span>"


def kpi(label: str, value: str, sub: str = "", light: bool = False) -> str:
    return (f"<div class='kpi{' light' if light else ''}'><div class='label'>{html.escape(label)}</div>"
            f"<div class='value'>{html.escape(value)}</div><div class='sub'>{sub}</div></div>")


def kpi_row(items: list[tuple], light: bool = False) -> None:
    cols = st.columns(len(items))
    for c, it in zip(cols, items):
        label, value = it[0], it[1]
        sub = it[2] if len(it) > 2 else ""
        c.markdown(kpi(label, value, sub, light), unsafe_allow_html=True)


def level_chip(level: int) -> str:
    col = LEVEL_COLORS[int(level)]
    fg = "#fff" if int(level) >= 3 else DARK
    return f"<span class='chip' style='background:{col};color:{fg}'>L{int(level)} · {LEVEL_NAMES[int(level)]}</span>"


def reason_cards(reasons: list[dict]) -> None:
    if not reasons:
        st.markdown("<div class='muted'>No reason crosses the reporting bar at this moment.</div>", unsafe_allow_html=True)
    for k, r in enumerate(reasons):
        st.markdown(f"<div class='reason'><div class='eng'>{k + 1} · {html.escape(r['engine'])} engine</div>{html.escape(r['text'])}</div>",
                    unsafe_allow_html=True)


def engine_tile(name: str, on: bool, value: str) -> str:
    state = "Fired" if on else "Quiet"
    return (f"<div class='tile {'on' if on else 'off'}'><div class='name'>{html.escape(name)}</div>"
            f"<div class='state'>{state}</div><div class='val'>{html.escape(value)}</div></div>")


def html_table(rows: list[dict], cols: list[tuple[str, str]], raw_cols: tuple = ()) -> None:
    head = "".join(f"<th>{html.escape(t)}</th>" for _, t in cols)
    body = ""
    for r in rows:
        body += "<tr>" + "".join(
            f"<td>{r.get(k, '') if k in raw_cols else html.escape(str(r.get(k, '')))}</td>" for k, _ in cols) + "</tr>"
    st.markdown(f"<table class='pulse'><tr>{head}</tr>{body}</table>", unsafe_allow_html=True)


def note(text: str) -> None:
    st.markdown(f"<div class='muted' style='margin-top:6px'>{text}</div>", unsafe_allow_html=True)


def card(title: str, body_html: str) -> None:
    st.markdown(f"<div class='card'><h4>{html.escape(title)}</h4>{body_html}</div>", unsafe_allow_html=True)


_ = GREY, JADE
