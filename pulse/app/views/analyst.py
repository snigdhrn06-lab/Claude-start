"""Analyst console: queue, actions with an append-only audit log, on-demand case files, and the merchant's view."""
import datetime as dt
import html

import pandas as pd
import streamlit as st

from ui import components as C, data

C.title("Analyst console", simulated=True,
        sub="What an analyst at PayU would see: a queue sorted by risk band, three plain reasons per case, one-click actions that are logged and can't be "
            "edited, a case file for any flagged merchant, and exactly what the merchant sees at each level.")
M = data.merchants()
R = data.js("reasons.json")
ss = st.session_state
ss.setdefault("audit_log", [])
ss.setdefault("case_status", {})

flagged = M[(M.first_l2_h >= 0)].copy()
flagged["band"] = ["Act" if a >= 3 else "Review" for a in flagged.max_level_auto]
flagged = flagged.sort_values(["max_level_auto", "max_p"], ascending=False)
reason_at = {}
for r in R:
    if r["kind"] in ("first_l3", "first_l2") and r["merchant_id"] not in reason_at and r["reasons"]:
        reason_at[r["merchant_id"]] = r

tabs = st.tabs(["1 · Queue", "2 · Audit log", "3 · Case file", "4 · Merchant's view"])
with tabs[0]:
    c1, c2 = st.columns([2, 1])
    split = c2.radio("Show", ["Test merchants", "All merchants"], horizontal=True)
    q = flagged if split == "All merchants" else flagged[flagged.split == "test"]
    c1.markdown(f"<div class='muted' style='padding-top:8px'>{len(q)} cases. Truth is hidden from the analyst; it appears only in the audit log "
                "after a decision, because this is a simulation.</div>", unsafe_allow_html=True)
    for _, r in q.head(14).iterrows():
        mid = int(r.merchant_id)
        status = ss.case_status.get(mid, "Open")
        rr = reason_at.get(mid)
        with st.container(border=True):
            a, b = st.columns([3.4, 1])
            when = data.hour_label(int(r.first_l2_h), "%d %b %H:00")
            a.markdown(f"<b style='font-size:17px'>{html.escape(r['name'])}</b> &nbsp; {C.level_chip(int(r.max_level_auto))} &nbsp; "
                       f"<span class='muted'>{r.category.replace('_', ' ')} · {r.city} · first alert {when} · status: <b>{status}</b></span>",
                       unsafe_allow_html=True)
            if rr:
                a.markdown("".join(f"<div class='muted'>• {html.escape(x['text'])}</div>" for x in rr["reasons"][:3]), unsafe_allow_html=True)
            for k, (lab, act) in enumerate([("Approve", "Approved: keep the hold, request video KYC"), ("Escalate", "Escalated to L4/L5 human review"),
                                            ("Dismiss", "Dismissed: release the held surplus")]):
                if b.button(lab, key=f"{lab}_{mid}", disabled=status != "Open", use_container_width=True):
                    ss.case_status[mid] = lab + "d" if lab != "Escalate" else "Escalated"
                    ss.audit_log.append({"time": dt.datetime.now().strftime("%H:%M:%S"), "analyst": "stall demo", "merchant": r["name"],
                                         "band": r.band, "action": act, "simulation truth": r.truth})
                    st.rerun()
with tabs[1]:
    if not ss.audit_log:
        st.markdown("<div class='muted'>No actions yet. Every decision in the queue is appended here, with a timestamp, and can't be edited or deleted.</div>",
                    unsafe_allow_html=True)
    else:
        C.html_table(list(reversed(ss.audit_log)), [("time", "Time"), ("analyst", "Analyst"), ("merchant", "Merchant"), ("band", "Band"),
                                                     ("action", "Action"), ("simulation truth", "Simulation truth")])
        st.download_button("⬇ Download the audit log (CSV)", pd.DataFrame(ss.audit_log).to_csv(index=False), file_name="pulse_audit_log.csv")
    C.note("Append-only by design: the console offers no edit or delete. In production this would be a write-once table with the analyst's identity.")
with tabs[2]:
    opts = {int(r.merchant_id): r["name"] for _, r in flagged.iterrows()}
    pre = int(M.merchant_id[M.code == "HERO"].iloc[0])
    mid = st.selectbox("Merchant", list(opts), format_func=lambda i: opts[i], index=list(opts).index(pre))
    r = M[M.merchant_id == mid].iloc[0]
    code = r.code
    path = data.ART / "evidence" / f"{code}_case_file.md"
    if path.exists():
        md = path.read_text()
    else:
        rr = reason_at.get(mid)
        band = "Act" if r.max_level_auto >= 3 else "Review"
        lines = [f"# Analyst case file: {r['name']}", "", "> **SIMULATED DATA.** Prototype output on a synthetic scenario.", "",
                 f"- **Merchant:** {r['name']} (`{code}`), declared category {r.category.replace('_', ' ')}, {r.city} (tier {r.tier})",
                 f"- **First alert:** {data.hour_label(int(r.first_l2_h), '%a %d %b %Y, %H:00')}; risk band **{band}**",
                 f"- **Engines agreeing at peak:** {int(r.max_engines)} of 4", "", "## Why PULSE flagged it", ""]
        lines += [f"{k + 1}. **{x['engine'].title()}**: {x['text']}" for k, x in enumerate(rr["reasons"])] if rr else ["(no reasons recorded)"]
        lines += ["", "## Action", "", f"- Highest automatic level: L{int(r.max_level_auto)}; L4/L5 only after human review.", "",
                  "## Draft STR narrative (template)", "",
                  "> **Draft for compliance review, not filed. Filed within 7 working days per PMLA rules. Merchant is not informed.**", "",
                  f"> {r['name']}, onboarded as a {r.category.replace('_', ' ')}, showed a sustained change in its pattern of payments. "
                  + " ".join(x["text"] + "." for x in (rr["reasons"] if rr else [])) + " [Analyst to complete.]"]
        md = "\n".join(lines)
    with st.container(height=520, border=True):
        st.markdown(md)
    st.download_button("⬇ Download case file (Markdown)", md, file_name=f"PULSE_case_{code}.md")
    C.note("Full case files with charts (HTML) are generated by the pipeline for the hero bakery and the S5 shell; for every other flagged merchant the "
           "console builds one on demand from the same artefacts.")
with tabs[3]:
    lv = st.select_slider("Ladder level", options=[0, 1, 2, 3, 4, 5], value=2, format_func=lambda v: f"L{v}")
    msgs = {0: ("No change", "Payments and settlements continue as normal. Nothing is shown to the shop."),
            1: ("No change", "A silent check compares where payments come from with the shop's registered site and app. Nothing is shown to the shop."),
            2: ("Quick verification needed", "To keep your settlements on schedule, please confirm your phone with the OTP we just sent and upload one recent "
                "supplier invoice (flour, dairy, packaging…). Most shops finish this in 3 minutes."),
            3: ("Part of today's settlement is under review", "We've delayed part of today's payout while we complete a short video KYC. Your regular "
                "sales still settle on time. Book a 5-minute video call to release it."),
            4: ("Refunds and payouts paused", "After review by our team, refunds, payouts and new payment links are paused on your account. Contact your "
                "account manager to appeal; you'll get a reply within 2 working days."),
            5: ("Account closed", "After review by our team, your merchant account has been closed under our terms of service. Any amount not under "
                "legal hold will be settled to your registered bank account.")}
    t, b = msgs[lv]
    c1, c2 = st.columns([1, 1.4])
    with c1:
        st.markdown(f"<div class='phone'><div class='pbar'>9:41 · PayU for business</div><div class='pt'>{t}</div><div class='pb'>{b}</div>"
                    f"{'<div class=pbtn>Upload invoice</div>' if lv == 2 else ('<div class=pbtn>Book video KYC</div>' if lv == 3 else ('<div class=pbtn>Appeal</div>' if lv >= 4 else ''))}"
                    "</div>", unsafe_allow_html=True)
    with c2:
        C.card("What the shop never sees", "<div class='muted'>The risk band, the engine readings, the reasons, the graph links and any STR draft. "
               "Telling a suspect about an STR would be tipping-off, which PMLA prohibits.</div>")
        C.card("How an honest shop gets out", "<div class='muted'>L2 clears when the invoice and OTP check out. L3 releases the held surplus after "
               "video KYC; legitimate sales were never held. Consented bank data (Earned Trust) can lower the score and widen tolerance. "
               "L4/L5 happen only after a human reviews the case, and the shop can appeal.</div>")
        C.note("Merchant-facing texts are drafts for the team to adjust with PayU's compliance and product teams.")
