"""Ask us anything: the hardest questions, short honest answers, and the screen that proves each one."""
import html

import streamlit as st

from ui import components as C, data

C.title("Ask us anything", simulated=False, sub="The questions judges ask most, answered from what the code actually does. Each answer links to the screen that shows it.")
met = data.js("eval/metrics.json")["stage_c_calibrated_lightgbm"]
lat = data.js("eval/latency.json") if (data.ART / "eval" / "latency.json").exists() else {"p50_ms": 0, "p95_ms": 0}
card = {r["id"]: r for r in data.js("eval/scenario_scorecard.json")}

QA = [
    ("What if the front avoids round amounts, match nights or refunds?",
     "Each of those removes one signal, not the case. Without round amounts (E1) it was still flagged in the first hour; without refunds (E3) within an "
     "hour, through timing, new distant payers and shared bettors. Spreading bets over every evening weakens the match clock, and the late-hours drift "
     "still shows. The real blind spot is a front that pays winners off-platform, stays small and uses fresh bettors: the Careful front preset in the "
     "sandbox is caught but lets about half its money escape. Consented bank data would close that gap.",
     [("pages/03_sandbox.py", "Try it in the sandbox"), ("pages/12_evaluation.py", "E1–E3 on the scorecard")]),
    ("Won't Diwali or a big wedding order trigger it?",
     "Diwali lifts every sweet shop and bakery together, so the peer gap is ln 5 − ln 5 = 0 and Tolerated rises with the cohort: ₹0 held, even with L3 "
     "forced (S1). A one-off wedding order moves one engine (volume drift) for one day; two engines must agree before anything visible happens. "
     "Bulk catering days are in the simulation as honest hard cases.",
     [("pages/02_story.py", "Guided story, step 6"), ("pages/13_rollout.py", "Rules engine vs PULSE on Diwali")]),
    ("How do you get labels when there are no confirmed fronts?",
     "Day one needs none: an expert scorecard over the four engines, with weights in config, runs in shadow mode. Labels then come from past exits and "
     "law-enforcement referrals, analyst outcomes in shadow mode, and controlled test buys after a legal opinion. Only then is the learned model trained, "
     "and its score treated as a probability only after calibration on PayU data.",
     [("pages/13_rollout.py", "Shadow mode and stop rules")]),
    ("What does a false alarm cost, and who pays it?",
     "The decision rule prices it: act at a level only if score × cost of fraud > (1 − score) × cost of friction at that level. An honest shop at L2 "
     "pays three minutes (OTP and one invoice); at L3 part of one day's settlement waits for a video KYC while normal sales still settle. "
     f"On simulated test merchants, {round(met['honest_ever_l3_share'] * met['n_test_honest'])} of {met['n_test_honest']} honest shops ever reached Act.",
     [("pages/10_response.py", "Cost sliders"), ("pages/07_analyst.py", "What the merchant sees")]),
    ("Does this need data PayU doesn't have?",
     "No. Every engine runs on fields a payment aggregator already holds: timestamp, amount, payer VPA/ID, payer location, channel, refunds and payouts, "
     "settlement batches, KYB attributes (director, device, settlement account) and a public fixture calendar. Consented bank and GST data (Earned "
     "Trust) is optional and only ever helps the merchant who shares it.",
     [("pages/15_data.py", "Data & assumptions")]),
    ("What's the latency and compute cost at PayU scale?",
     f"One merchant-window scores in {lat['p50_ms']:.2f} ms (p50), {lat['p95_ms']:.2f} ms (p95) in single-threaded Python on a laptop. That's a laptop "
     "benchmark, not a production load test. Scoring is per merchant-hour, not per payment, and the cohort job (peers, match clock, graph) runs hourly "
     "in batch, so cost scales with merchants, not transactions.",
     [("pages/06_flow.py", "Scoring API and benchmark")]),
    ("What happens to the merchant at each level, and how do they appeal?",
     "L0–L1: nothing visible. L2: OTP plus one supplier invoice. L3: video KYC; only the fingerprinted surplus waits. L4 (pause payouts) and L5 (exit plus "
     "draft STR) happen only after a human review, with an appeal route. The merchant is never told about an STR (no tipping-off under PMLA).",
     [("pages/07_analyst.py", "Merchant's view"), ("pages/10_response.py", "Friction ladder")]),
    ("What's real and what's simulated in this demo?",
     "Real: one bakery's 9,464 transactions from the public Bread Basket dataset (a UK café, moved onto the 2025 calendar), plus public fixture and "
     "festival dates. Simulated: rupee prices, payer IDs, the other 313 merchants, all betting behaviour (each rule cites a public ED, DGGI, iPaisa or "
     "CUTS finding), and consented bank data. No PayU data is used.",
     [("pages/15_data.py", "Data & assumptions")]),
    ("What haven't you solved?",
     "Small, quiet fronts take days to weeks (median 163 h from first bet to Review/Act). The peer engine adds nothing measurable in our simulation, "
     "possibly because the simulated cohorts are cleaner than real ones. Calibration can only be claimed after shadow mode on PayU data. The fixture "
     "dates and the INR price list still need checking by hand. And the simulated region has far more fronts than real life.",
     [("pages/12_evaluation.py", "Evaluation and ablation")]),
    ("A brand-new shell has no history. How can you judge it?",
     f"Against what it declared at KYB. The S5 'IT services' shell was judged against an IT firm's hours and bill sizes from its first payment; with "
     f"12 of its first 20 payers shared with a banned front, it was flagged two hours after its first payment and its evening bets were held from day one. "
     f"({card['S5']['actual']}.)",
     [("pages/09_network.py", "Network"), ("pages/03_sandbox.py", "New shell preset")]),
    ("Why not just use a rules engine?",
     "On the same simulated city, 'volume above 3× normal' flags honest shops in Diwali week and misses fronts that keep their volume modest. "
     "PULSE asks four questions a volume rule can't: unlike its own past, unlike its peers, money looping back, customers who are known bettors.",
     [("pages/13_rollout.py", "Side-by-side comparison")]),
]
for q, a, links in QA:
    with st.expander(q, expanded=False):
        st.markdown(f"<div style='font-size:16px;line-height:1.6'>{html.escape(a)}</div>", unsafe_allow_html=True)
        cols = st.columns(len(links) + 2)
        for c, (p, lab) in zip(cols, links):
            c.page_link(p, label=lab, icon=":material/arrow_forward:", use_container_width=True)
C.note("Answers are drafts written from the code and the simulated results; edit them before the final.")
