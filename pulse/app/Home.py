"""PULSE prototype app. Run: streamlit run app/Home.py"""
import streamlit as st

st.set_page_config(page_title="PULSE · pattern-of-life engine", page_icon=":material/monitor_heart:", layout="wide",
                   initial_sidebar_state="expanded")

from ui import components, data, theme  # noqa: E402

present = st.query_params.get("present", "1") != "0"
present = st.sidebar.toggle("Presentation mode", value=present, help="Hides the Streamlit menu and footer.")
theme.apply(present)
components.header()

if not data.ready():
    st.error("Artefacts not found. Run `make data train` (or `make all`) first.")
    st.stop()

pages = [
    st.Page("views/story.py", title="Story mode", icon=":material/play_circle:", default=True, url_path="story"),
    st.Page("views/explorer.py", title="Merchant explorer", icon=":material/storefront:", url_path="explorer"),
    st.Page("views/engines_lab.py", title="Engines lab", icon=":material/tune:", url_path="engines"),
    st.Page("views/network.py", title="Network", icon=":material/hub:", url_path="network"),
    st.Page("views/response.py", title="Response & trust", icon=":material/shield:", url_path="response"),
    st.Page("views/evaluation.py", title="Evaluation", icon=":material/analytics:", url_path="evaluation"),
    st.Page("views/data_assumptions.py", title="Data & assumptions", icon=":material/description:", url_path="data"),
]
st.sidebar.markdown("<div class='muted'>Real: the hero bakery's normal (Bread Basket). Simulated: everything else, "
                    "labelled on every screen.</div>", unsafe_allow_html=True)
st.navigation(pages).run()
