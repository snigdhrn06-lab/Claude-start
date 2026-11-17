"""Shared page setup: page config, theme, header, sidebar navigation, artefact check.

The app uses Streamlit's classic `pages/` layout so that every URL (including /present, printed as a QR code on the
posters) is known to the server before any script runs. With st.navigation, a direct visit to a page shows a
"Page not found" pop-up first; this layout doesn't.
"""
from __future__ import annotations

import html

import streamlit as st

from . import data, theme

NAV = [
    ("Start here", [("pages/01_present.py", "Judge Mode home", ":material/home:")]),
    ("See it work", [("pages/02_story.py", "Watch a takeover (guided)", ":material/play_circle:"),
                     ("pages/03_sandbox.py", "Try to fool PULSE", ":material/sports_esports:"),
                     ("pages/04_film.py", "2-minute film", ":material/movie:"),
                     ("pages/05_live.py", "Live feed", ":material/monitoring:")]),
    ("Look under the hood", [("pages/08_engines.py", "Engines lab", ":material/tune:"),
                             ("pages/09_network.py", "Network", ":material/hub:"),
                             ("pages/10_response.py", "Response & trust", ":material/shield:"),
                             ("pages/06_flow.py", "PayU flow, API & ops", ":material/account_tree:"),
                             ("pages/07_analyst.py", "Analyst console", ":material/assignment_ind:"),
                             ("pages/11_explorer.py", "Merchant explorer", ":material/storefront:")]),
    ("Proof & honesty", [("pages/12_evaluation.py", "Evaluation", ":material/analytics:"),
                         ("pages/13_rollout.py", "Rollout & rules vs PULSE", ":material/rocket_launch:"),
                         ("pages/14_qa.py", "Ask us anything", ":material/forum:"),
                         ("pages/15_data.py", "Data & assumptions", ":material/description:")]),
]


def reset_demo() -> None:
    """One click back to a clean start for the next judge."""
    for k in list(st.session_state.keys()):
        del st.session_state[k]
    st.switch_page("pages/01_present.py")


def setup(page_title: str = "PULSE", sidebar: bool = True) -> None:
    st.set_page_config(page_title=f"PULSE · {page_title}", page_icon=":material/monitor_heart:", layout="wide",
                       initial_sidebar_state="auto")
    clean = st.query_params.get("present", "1") != "0"
    theme.apply(clean)
    cfg = data.settings()
    team = cfg.get("team", {}).get("name", "")
    st.markdown(
        "<div class='pulse-header'><div class='logo'>P</div><div class='brand'>PULSE</div>"
        "<div class='tag'>pattern-of-life engine for PayU</div>"
        f"<div class='right'><span class='sim-pill'>Simulated data</span> {html.escape(team)}</div></div>",
        unsafe_allow_html=True)
    if sidebar:
        with st.sidebar:
            for group, items in NAV:
                st.markdown(f"<div class='nav-group'>{group}</div>", unsafe_allow_html=True)
                for path, label, icon in items:
                    st.page_link(path, label=label, icon=icon)
            st.markdown("<div style='height:10px'></div>", unsafe_allow_html=True)
            if st.button("↺ Reset demo", use_container_width=True, help="Clears every page back to its starting state for the next judge."):
                reset_demo()
            st.markdown("<div class='muted' style='margin-top:10px'>Real: the hero bakery's normal (public Bread Basket data). "
                        "Simulated: everything else, labelled on every screen.</div>", unsafe_allow_html=True)
    if not data.ready():
        st.error("Artefacts not found. Run `make data train` (or `make demo` after `make all`) first.")
        st.stop()
