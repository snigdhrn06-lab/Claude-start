"""Data & assumptions: lineage, assumptions, design parameters, scenario rules and sources."""
import pandas as pd
import streamlit as st
import yaml

from ui import components as C, data
from ui.theme import DARK, DARK_SOFT, GREY, GREY_DARK, JADE, MINT, NEON

meta = data.meta()
cfg = meta["config"]
ing = meta["ingest_report"]
C.title("Data & assumptions", simulated=False,
        sub="What is real, what is transformed, what is simulated, and every design parameter. Nothing here is PayU data.")

# ---------------------------------------------------------------- lineage
def col(title, color, items, fg="#fff"):
    li = "".join(f"<div style='background:#fff;color:{DARK};border-radius:8px;padding:6px 10px;margin-top:6px;font-size:13px'>{x}</div>" for x in items)
    return (f"<div style='flex:1;min-width:200px;background:{color};color:{fg};border-radius:14px;padding:12px 14px'>"
            f"<div style='font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase'>{title}</div>{li}</div>")


arrow = f"<div style='align-self:center;font-size:26px;color:{DARK};padding:0 2px'>→</div>"
st.markdown("<div style='display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 18px 0'>" + arrow.join([
    col("Real", JADE, ["Bread Basket: 9,531 real bakery baskets (public)", "Fixture and festival dates (public)"]),
    col("Transformed", GREY_DARK, ["Calendar shift: +447 weeks (day-of-week kept)", "INR price list (assumption)", "Live-match moments from start times"]),
    col("Simulated", DARK_SOFT, ["Payer IDs for the hero", "Region: 50,000 payers, ~300 merchants", "Betting injections (each rule cited)", "Consented bank and GST data"]),
    col("Outputs", DARK, ["Four engines → fused score", "Ladder, delta reserve, evidence", "Evaluation on simulated test merchants"]),
]) + "</div>", unsafe_allow_html=True)

tabs = st.tabs(["Real data", "Assumptions", "Scenario rules & sources", "Fixtures & festivals", "Design parameters"])
with tabs[0]:
    C.kpi_row([("Item rows", f"{ing['item_rows']:,}", "BreadBasket_DMS.csv"), ("Transactions", f"{ing['transactions']:,}", ""),
               ("Used as payments", f"{ing['transactions_used']:,}", f"{ing['transactions_dropped_zero_total']} had no priced item"),
               ("Date shift", f"{ing['shift_weeks']} weeks", f"{ing['original_first_date']} → {ing['mapped_first_date']}")], light=True)
    st.write("")
    C.html_table([
        {"k": "Source", "v": ing["source"]},
        {"k": "Original span", "v": f"{ing['original_first_date']} to {ing['original_last_date']} (UK bakery, winter to spring)"},
        {"k": "Mapped span", "v": f"{ing['mapped_first_date']} to {ing['mapped_last_date']} (day-of-week preserved)"},
        {"k": "Closed days in the original", "v": ", ".join(ing["closed_days_in_original"])},
        {"k": "Rows dropped", "v": f"{ing['rows_priced_zero_dropped']} item rows 'NONE'/'Adjustment' priced at 0"},
        {"k": "Median basket", "v": f"₹{ing['median_basket_inr']:.0f} (from the declared price list)"},
        {"k": "Payer IDs", "v": f"{cfg['settings']['hero']['local_payers']} local regulars (Zipf exponent {cfg['settings']['hero']['zipf_exponent']}) "
                                 f"+ {100 * cfg['settings']['hero']['walk_in_share']:.0f}% walk-ins from the city (simulated)"},
    ], [("k", "Item"), ("v", "Value")])
with tabs[1]:
    st.markdown(data.text("ASSUMPTIONS.md"))
with tabs[2]:
    sc = cfg["scenarios"]
    srcs = sc["sources"]
    rows = []
    for sid, s in sc["scenarios"].items():
        rows.append({"id": f"<b>{sid}</b>", "label": s["label"], "truth": s["truth"], "rule": s["rule"], "exp": s["expected_text"],
                     "src": "<br>".join(f"• {srcs[k]['text']}" for k in s["sources"]) or "<span class='muted'>none (honest case)</span>"})
    C.html_table(rows, [("id", "ID"), ("label", "Scenario"), ("truth", "Truth"), ("rule", "Injection rule (synthetic)"), ("exp", "Expected"),
                        ("src", "Public finding that motivates it")], raw_cols=("id", "src"))
    st.write("")
    st.markdown("**Banned seed fronts** (known labels the graph engine starts from; synthetic)")
    C.html_table([{"id": b["code"], "n": b["name"], "d": data.hour_label(b["ban_day"] * 24, "%d %b %Y"), "k": f"{b['n_bettors']:,}"}
                  for b in meta["banned"]], [("id", "ID"), ("n", "Name"), ("d", "Banned on"), ("k", "Bettors (investigation list)")])
    C.note("Source references are as supplied in the team brief; verify each citation before it goes into the deck.")
with tabs[3]:
    fx = pd.DataFrame(meta["fixtures_in_window"])
    fx = fx[fx.day_k == 0][["match_id", "date", "start_time_ist", "teams", "competition", "format", "verification"]]
    st.dataframe(fx, hide_index=True, use_container_width=True, height=360)
    C.note("Fixture dates and times: partly confirmed by web search, the rest marked 'to be verified by team'. Live-match moments are "
           "toss (−30 to 0 min), innings break and final overs, from the offsets in config/engines.yaml.")
    st.dataframe(pd.DataFrame(meta["festivals"]), hide_index=True, use_container_width=True)
with tabs[4]:
    for name in ["settings", "engines", "costs", "merchant_templates"]:
        with st.expander(f"config/{name}.yaml", expanded=name == "costs"):
            st.code(yaml.safe_dump(cfg[name], sort_keys=False, width=110), language="yaml")
_ = (DARK, GREY, MINT, NEON)
