"""Chart helpers (Plotly) shared by pages."""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.graph_objects as go

from . import data
from .theme import DARK, GREY, GREY_DARK, JADE, LEVEL_COLORS, MINT, NEON


def match_windows_hours() -> list[tuple[float, float, str]]:
    out = []
    for f in data.meta()["fixtures_in_window"]:
        out.append((f["w0"] / 60, f["t_end"] / 60, f"{f['teams']} ({f['competition']})"))
    return out


def ts(h) -> pd.DatetimeIndex:
    return pd.DatetimeIndex(data.date_of_hour(np.asarray(h)))


def add_match_bands(fig: go.Figure, h0: int, h1: int, label: bool = True, row=None, col=None) -> None:
    for a, b, name in match_windows_hours():
        if b < h0 or a > h1:
            continue
        x0, x1 = ts([max(a, h0)])[0], ts([min(b, h1)])[0]
        kw = dict(row=row, col=col) if row else {}
        fig.add_vrect(x0=x0, x1=x1, fillcolor=NEON, opacity=0.16, line_width=0, layer="below", **kw)
        if label:
            fig.add_annotation(x=x0, y=1.0, yref="paper", text="match window", showarrow=False, xanchor="left", yanchor="bottom",
                               font=dict(size=10, color=DARK), bgcolor="rgba(0,254,137,0.25)")


def level_strip(levels: np.ndarray, x) -> go.Bar:
    return go.Bar(x=x, y=np.ones(len(levels)), marker_color=[LEVEL_COLORS[int(v)] for v in levels], showlegend=False,
                  hovertext=[f"L{int(v)}" for v in levels], hoverinfo="text+x", marker_line_width=0)


def gauge(p: float, title: str = "Calibrated probability") -> go.Figure:
    top = p >= 0.995
    thr = data.meta()["level_thresholds"]
    t2, t3 = 100 * thr["L2"], 100 * thr["L3"]
    fig = go.Figure(go.Indicator(
        mode="gauge+number", value=99 if top else p * 100,
        number={"suffix": "%", "prefix": "> " if top else "", "valueformat": ".0f", "font": {"size": 42, "color": DARK}},
        title={"text": title, "font": {"size": 14}},
        gauge={"axis": {"range": [0, 100], "tickcolor": GREY_DARK}, "bar": {"color": DARK, "thickness": 0.28},
               "bgcolor": "#fff", "borderwidth": 0,
               "steps": [{"range": [0, t2], "color": GREY}, {"range": [t2, t3], "color": MINT},
                         {"range": [t3, 100], "color": "rgba(0,173,125,0.35)"}],
               "threshold": {"line": {"color": NEON, "width": 5}, "thickness": 0.9, "value": p * 100}}))
    fig.update_layout(height=250, margin=dict(l=20, r=20, t=50, b=10))
    return fig


def venn(a: int, b: int, ab: int, la="Paid in (A)", lb="Paid back (B)") -> go.Figure:
    fig = go.Figure()
    fig.add_shape(type="circle", x0=0, y0=0, x1=2, y1=2, fillcolor=JADE, opacity=0.35, line_color=JADE)
    fig.add_shape(type="circle", x0=1.2, y0=0.25, x1=2.7, y1=1.75, fillcolor=DARK, opacity=0.35, line_color=DARK)
    fig.add_annotation(x=0.6, y=1, text=f"<b>{a - ab}</b>", showarrow=False, font=dict(size=16))
    fig.add_annotation(x=1.6, y=1, text=f"<b>{ab}</b>", showarrow=False, font=dict(size=16, color="#fff"))
    fig.add_annotation(x=2.35, y=1, text=f"<b>{b - ab}</b>", showarrow=False, font=dict(size=16))
    fig.add_annotation(x=0.6, y=2.15, text=la, showarrow=False, font=dict(size=11))
    fig.add_annotation(x=2.2, y=2.15, text=lb, showarrow=False, font=dict(size=11))
    fig.update_xaxes(visible=False, range=[-0.1, 2.9])
    fig.update_yaxes(visible=False, range=[-0.1, 2.4], scaleanchor="x")
    fig.update_layout(height=190, margin=dict(l=4, r=4, t=4, b=4), plot_bgcolor="rgba(0,0,0,0)")
    return fig
