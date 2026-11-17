"""Judge Mode home: the stall's front door (also what the poster QR at /present opens)."""
import html

import streamlit as st

from ui import components as C, data, layout
from ui.theme import DARK, JADE, NEON

cfg = data.settings()
met = data.js("eval/metrics.json")["stage_c_calibrated_lightgbm"]
card = data.js("eval/scenario_scorecard.json")

st.markdown(f"""
<div class='hero-band'>
  <div class='hero-kicker'>Follow the Money · The Bakery That Takes Bets</div>
  <div class='hero-title'>Same papers. <span style='color:{NEON}'>Different life.</span></div>
  <div class='hero-sub'>A merchant passes KYC as a real bakery. Months later the same merchant ID quietly collects cricket bets.
  Every payment looks normal. PULSE learns what each shop <i>is</i> and catches the day it stops being that shop.</div>
</div>
""", unsafe_allow_html=True)


def tile(col, num, title, body, path, cta, primary=False):
    with col:
        st.markdown(f"<div class='jtile{' primary' if primary else ''}'><div class='jnum'>{num}</div><div class='jtitle'>{html.escape(title)}</div>"
                    f"<div class='jbody'>{body}</div></div>", unsafe_allow_html=True)
        st.page_link(path, label=cta, icon=":material/arrow_forward:", use_container_width=True)


c1, c2, c3 = st.columns(3, gap="medium")
tile(c1, "1", "Watch a takeover", "A real bakery's normal, then the night India played Pakistan. Seven steps, about 90 seconds: "
     "payments → four engines → one risk band → money held → case file.", "pages/02_story.py", "Start the guided story", primary=True)
tile(c2, "2", "Try to fool PULSE", "You play the fraudster. Pick how much to launder, how to pay winners, whether to avoid round "
     "amounts. The real engines judge you in about a second.", "pages/03_sandbox.py", "Open the sandbox")
tile(c3, "3", "Under the hood", "The four engines and their maths, a live city feed, where PULSE plugs into PayU before settlement, "
     "the analyst console, and our honest evaluation.", "pages/08_engines.py", "Open the engines lab")

st.write("")
st.markdown("<div class='nav-group' style='margin-left:0'>More</div>", unsafe_allow_html=True)
cols = st.columns(4)
links = [("pages/04_film.py", "2-minute film", ":material/movie:"), ("pages/05_live.py", "Live feed", ":material/monitoring:"),
         ("pages/06_flow.py", "PayU flow, API & ops", ":material/account_tree:"), ("pages/07_analyst.py", "Analyst console", ":material/assignment_ind:"),
         ("pages/12_evaluation.py", "Evaluation", ":material/analytics:"), ("pages/13_rollout.py", "Rules vs PULSE", ":material/rocket_launch:"),
         ("pages/14_qa.py", "Ask us anything", ":material/forum:"), ("pages/15_data.py", "What's real", ":material/description:")]
for k, (p, label, icon) in enumerate(links):
    cols[k % 4].page_link(p, label=label, icon=icon, use_container_width=True)

st.write("")
passed = sum(r["pass"] for r in card)
C.kpi_row([("Designed scenarios passed", f"{passed} / {len(card)}", "simulated test merchants"),
           ("Simulated fronts caught", f"{round(met['recall_l2'] * met['n_test_fronts'])} of {met['n_test_fronts']}", "reached Review or Act"),
           ("Honest shops held", f"{round(met['honest_ever_l3_share'] * met['n_test_honest'])} of {met['n_test_honest']}", "never reached Act"),
           ("Diwali rush held", f"₹{data.pq('reserve_S1.parquet').held.sum():,.0f}", "Tolerated rises with the cohort")])
st.markdown(f"<div class='quote'>“We don't hunt for betting. We learn what every bakery is, and catch the day it stops being one.”</div>",
            unsafe_allow_html=True)
b1, b2 = st.columns([3, 1])
b1.markdown("<div class='muted'>All results are on simulated scenarios built around one real public bakery dataset. "
            "No PayU data was used, and no accuracy is claimed on real PayU traffic.</div>", unsafe_allow_html=True)
if b2.button("↺ Reset demo", use_container_width=True, key="reset_home"):
    layout.reset_demo()
_ = (DARK, JADE)
