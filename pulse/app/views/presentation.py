"""Cinematic Presentation Mode: a full-window, self-playing product story.

The presentation is one HTML/SVG/Canvas document driven by a single timeline (see app/presentation/).
Its data is built from the same artefacts as every other page, so the numbers always agree with the app.
"""
import streamlit as st
import streamlit.components.v1 as components

from ui import presentation_data


@st.cache_data(show_spinner=False)
def _html() -> str:
    return presentation_data.html()


# Hide all app chrome on this page and let the presentation fill the browser window.
st.markdown("""
<style>
[data-testid="stSidebar"], [data-testid="stSidebarCollapsedControl"], header[data-testid="stHeader"],
.pulse-header, #MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"], [data-testid="stStatusWidget"] { display: none !important; }
.block-container, [data-testid="stMainBlockContainer"] { padding: 0 !important; max-width: none !important; }
iframe[data-testid="stIFrame"], [data-testid="stIFrame"] iframe, iframe[title="st.iframe"] {
  position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999; border: 0; background: #000F11; }
html, body, [data-testid="stApp"] { background: #000F11 !important; overflow: hidden !important; }
</style>
""", unsafe_allow_html=True)
components.html(_html(), height=900, scrolling=False)
