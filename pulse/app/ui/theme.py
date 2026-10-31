"""PayU palette, Plotly template and CSS shared by every page."""
from __future__ import annotations

import plotly.graph_objects as go
import plotly.io as pio
import streamlit as st

DARK = "#002124"
NEON = "#00FE89"
JADE = "#00AD7D"
EMERALD = "#4EB564"
MINT = "#62CAC3"
OFF = "#F7F7F7"
GREY = "#E3E3E3"
MUTED = "#5B6F70"
# A few neutral helpers that keep within the palette family
DARK_SOFT = "#1E4447"
GREY_DARK = "#9AA5A6"

LEVEL_COLORS = {0: GREY, 1: MINT, 2: EMERALD, 3: JADE, 4: DARK_SOFT, 5: DARK}
ENGINE_COLORS = {"drift": MINT, "peers": EMERALD, "invariants": JADE, "graph": DARK_SOFT}


def register_plotly_template() -> None:
    t = go.layout.Template()
    t.layout = go.Layout(
        font=dict(family="Poppins, Arial, sans-serif", size=13, color=DARK),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#FFFFFF",
        colorway=[JADE, DARK, MINT, EMERALD, NEON, GREY_DARK],
        xaxis=dict(gridcolor=GREY, linecolor=GREY, zerolinecolor=GREY, ticks="outside", tickcolor=GREY, title_standoff=8),
        yaxis=dict(gridcolor=GREY, linecolor=GREY, zerolinecolor=GREY, ticks="outside", tickcolor=GREY, title_standoff=8),
        hoverlabel=dict(bgcolor=DARK, font=dict(color="#FFFFFF", family="Poppins, Arial, sans-serif"), bordercolor=DARK),
        legend=dict(orientation="h", yanchor="bottom", y=1.01, xanchor="left", x=0, bgcolor="rgba(0,0,0,0)", font=dict(size=12)),
        margin=dict(l=48, r=24, t=84, b=40),
        title=dict(font=dict(size=15, color=DARK), x=0, xanchor="left", xref="paper", y=0.985, yanchor="top", yref="container"),
        bargap=0.15,
    )
    pio.templates["pulse"] = t
    pio.templates.default = "pulse"


CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
html, body, [class*="css"], .stMarkdown, .stText, p, li, label, button, input, textarea, select, h1, h2, h3, h4 {{
  font-family: 'Poppins', Arial, sans-serif !important;
}}
.block-container {{ padding-top: 1.6rem; padding-bottom: 2rem; max-width: 1400px; }}
h1, h2, h3, h4 {{ color: {DARK}; letter-spacing: -0.01em; }}
h1 {{ font-weight: 700; font-size: 1.9rem; }}
h2 {{ font-weight: 600; font-size: 1.4rem; }}
h3 {{ font-weight: 600; font-size: 1.12rem; }}
.pulse-header {{
  height: 56px; border-radius: 14px; margin: 0 0 16px 0;
  background: {DARK}; color: #fff; display: flex; align-items: center; padding: 0 22px; gap: 14px;
  box-shadow: 0 2px 10px rgba(0,33,36,0.25);
}}
.pulse-header .logo {{ width: 30px; height: 30px; border-radius: 8px; background: {NEON}; color: {DARK};
  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }}
.pulse-header .brand {{ font-weight: 700; font-size: 18px; letter-spacing: 0.04em; }}
.pulse-header .tag {{ font-weight: 300; font-size: 14px; opacity: 0.85; }}
.pulse-header .right {{ margin-left: auto; font-size: 12px; opacity: 0.75; }}
header[data-testid="stHeader"] {{ background: transparent; height: 0; }}
.sim-badge {{ display: inline-block; background: {GREY}; color: {DARK}; border: 1px solid {GREY_DARK}; border-radius: 999px;
  padding: 1px 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; vertical-align: middle; margin-left: 8px; }}
.real-badge {{ display: inline-block; background: {JADE}; color: #fff; border-radius: 999px; padding: 1px 10px; font-size: 11px;
  font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; vertical-align: middle; margin-left: 8px; }}
.kpi {{ background: {DARK}; border-radius: 14px; padding: 14px 18px; color: #fff; height: 100%; min-height: 104px;
  box-shadow: 0 2px 8px rgba(0,33,36,0.15); }}
.kpi .label {{ font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }}
.kpi .value {{ font-size: 28px; font-weight: 700; color: {NEON}; line-height: 1.25; margin-top: 4px; }}
.kpi .sub {{ font-size: 12px; opacity: 0.75; margin-top: 2px; }}
.kpi.light {{ background: #fff; color: {DARK}; border: 1px solid {GREY}; }}
.kpi.light .value {{ color: {JADE}; }}
.card {{ background: #fff; border: 1px solid {GREY}; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }}
.card h4 {{ margin: 0 0 6px 0; font-size: 15px; }}
.muted {{ color: {MUTED}; font-size: 13px; }}
.reason {{ background: #fff; border-left: 4px solid {JADE}; border-radius: 10px; padding: 10px 14px; margin: 8px 0;
  box-shadow: 0 1px 4px rgba(0,33,36,0.06); }}
.reason .eng {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: {JADE}; font-weight: 700; }}
.tile {{ border-radius: 14px; padding: 12px 14px; border: 1px solid {GREY}; background: #fff; min-height: 86px; }}
.tile.on {{ background: {DARK}; color: #fff; border-color: {DARK}; }}
.tile .name {{ font-weight: 600; font-size: 15px; }}
.tile .state {{ font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }}
.tile.on .state {{ color: {NEON}; }}
.tile.off .state {{ color: {GREY_DARK}; }}
.tile .val {{ font-size: 13px; margin-top: 4px; opacity: 0.85; }}
.chip {{ display: inline-block; border-radius: 8px; padding: 2px 10px; font-weight: 600; font-size: 13px; }}
.stepper {{ display: flex; gap: 6px; margin: 4px 0 14px 0; flex-wrap: wrap; }}
.stepper .s {{ flex: 1 1 0; min-width: 110px; padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid {GREY};
  font-size: 12px; color: {MUTED}; }}
.stepper .s b {{ display: block; font-size: 11px; letter-spacing: 0.06em; color: {GREY_DARK}; }}
.stepper .s.done {{ border-color: {JADE}; color: {DARK}; }}
.stepper .s.done b {{ color: {JADE}; }}
.stepper .s.cur {{ background: {DARK}; color: #fff; border-color: {DARK}; }}
.stepper .s.cur b {{ color: {NEON}; }}
.ineq {{ font-size: 18px; background: #fff; border: 1px solid {GREY}; border-radius: 12px; padding: 12px 16px; }}
.ineq .hl {{ background: {NEON}; padding: 0 6px; border-radius: 6px; font-weight: 700; }}
div.stButton > button, div.stDownloadButton > button {{ border-radius: 10px; border: 1px solid {DARK}; background: #fff; color: {DARK};
  font-weight: 600; padding: 0.45rem 1.1rem; }}
div.stButton > button:hover, div.stDownloadButton > button:hover {{ background: {DARK}; color: {NEON}; border-color: {DARK}; }}
div.stButton > button[kind="primary"] {{ background: {DARK}; color: {NEON}; }}
div.stButton > button[kind="primary"]:hover {{ background: {JADE}; color: #fff; border-color: {JADE}; }}
.stTabs [data-baseweb="tab-list"] {{ gap: 6px; }}
.stTabs [data-baseweb="tab"] {{ background: #fff; border: 1px solid {GREY}; border-radius: 10px 10px 0 0; padding: 6px 16px; }}
.stTabs [aria-selected="true"] {{ background: {DARK} !important; color: {NEON} !important; }}
.stTabs [data-baseweb="tab-highlight"] {{ background: {NEON}; }}
[data-testid="stSidebar"] {{ background: #fff; border-right: 1px solid {GREY}; }}
[data-testid="stSidebarNav"] a span {{ font-weight: 500; }}
table.pulse {{ border-collapse: collapse; width: 100%; font-size: 13px; background: #fff; border-radius: 12px; overflow: hidden; }}
table.pulse th {{ background: {DARK}; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }}
table.pulse td {{ border-bottom: 1px solid {GREY}; padding: 7px 10px; vertical-align: top; }}
.pass {{ color: {JADE}; font-weight: 700; }}
.fail {{ color: {DARK}; font-weight: 700; background: {GREY}; padding: 0 6px; border-radius: 6px; }}
</style>
"""

PRESENT_CSS = """
<style>
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"], [data-testid="stStatusWidget"] { display: none !important; visibility: hidden; }
</style>
"""


def apply(present: bool = True) -> None:
    register_plotly_template()
    st.markdown(CSS, unsafe_allow_html=True)
    if present:
        st.markdown(PRESENT_CSS, unsafe_allow_html=True)
