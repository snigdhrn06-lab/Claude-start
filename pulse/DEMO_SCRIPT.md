# PULSE stall script

Two versions: a **3-minute walkthrough** for a judge who stays, and a **60-second version** for a judge in a hurry.
Every number below is what the app shows today. The app computes them from `artifacts/`, so if anyone rebuilds the
model, check them again on screen before you use them.

## Before the judges arrive (5 minutes)

1. Laptop: `cd pulse` and run `make demo` (Windows: `run.bat demo`). The browser opens **Judge Mode** at
   `http://localhost:8501/present`. This needs no internet.
2. Browser fullscreen (F11), zoom 100%, laptop on charger, sleep off.
3. Click through once: guided story steps 1 to 7, then the sandbox with the **Overnight takeover** preset. This warms
   the caches, so the first judge never waits.
4. Phone: scan the poster QR. It should open the **hosted** `/present`. If Render was asleep it takes about a minute
   to wake, so open it 10 minutes before the stall starts (see README, "Keep it warm").
5. Between judges: press **Reset demo** (top of the sidebar, or bottom of Judge Mode). It clears the sandbox, analyst
   decisions and the live feed, then goes back to `/present`.

---

## The 3-minute walkthrough

| Time | Click | Say |
|---|---|---|
| 0:00 | **Judge Mode** home (`/present`) | "Same papers. Different life. A merchant passes KYC as a real bakery, and months later the same merchant ID quietly takes cricket bets. Every payment looks normal on its own. PULSE learns what each shop *is* and catches the day it stops being that shop." |
| 0:15 | Tile 1: **Start the guided story** → Step 1 *Meet the bakery* | "This bakery's normal is **real**: public transaction data from a bakery, about 58 payments a day, breakfast and lunch peaks. Everything else on screen, including the badge on every page, is **simulated**." |
| 0:30 | **Next →** Step 2 *Day T*. Press **▶ Replay** | "14 September, India v Pakistan. Same bakery ID, and now **69%** of the day's payments land inside match windows. Look at the round bills and the new payers from other cities." |
| 0:50 | **Next →** Step 3 *Four engines light up* | "Four engines look at what betting can't hide: drift from its own past, its peers, the betting invariants (a match clock tested against placebo dates, plus winners paid back as 'refunds'), and the network of bettors it shares with a front we banned. Look at the gate strip: **no engine can act alone**. Two must agree before anything happens. Here they agree at 19:00." |
| 1:15 | **Next →** Step 4 *One risk band* | "We don't claim a probability. We give a **risk band**, Watch, Review or Act, and three reasons in plain words. Every number in a reason is recomputed from the payments." |
| 1:30 | **Next →** Step 5 *Proportionate action* | "We don't freeze the shop. We hold only the **suspicious surplus**: on the takeover day ₹1,17,327 of ₹1,49,360 waited for review, and the bakery's real sales settled on time. This table shows exactly which payments were held and why." |
| 1:50 | **Next →** Step 6 *Honest cases stay quiet* | "Diwali: every sweet shop jumps four or five times, so the gap to its peers stays near zero and we hold **₹0**. The sports bar is busy every match night, but its payers are locals and nobody gets paid back, so it stays at Watch." |
| 2:10 | Sidebar → **Try to fool PULSE**. Preset **Careful front** | "Now you try to fool it. This is the same engine code on a fresh simulated city, and it runs in about a second. A careful front avoids round amounts and pays winners off-platform. PULSE still catches it on day 37, but more than half the money escapes first. That's a real blind spot, and we show it." |
| 2:35 | Sidebar → **Evaluation** (scorecard, then scroll to *Real shops we didn't design*) | "On simulated test merchants, all **9 of 9** scenarios behave as expected and 28 of 29 fronts are caught. But we wrote the fraud and the detector, so we also ran **112 real shops** we didn't design. The first run had 7 false Acts: small sellers having real surges. We fixed one rule and checked it on data we hadn't seen: **zero**." |
| 2:50 | Sidebar → **Rules vs PULSE** (or back to Judge Mode) | "Rollout starts in shadow mode with written stop rules. We don't hunt for betting. We learn what every bakery is, and catch the day it stops being one." |

## The 60-second version

| Time | Click | Say |
|---|---|---|
| 0:00 | Judge Mode home | "A real bakery's ID starts taking cricket bets. Same papers, different life. PULSE learns each shop's normal and catches the day it changes." |
| 0:10 | **Start the guided story** → **Next** twice to Step 3 | "On India v Pakistan night four engines fire: drift, peers, a match clock, and shared bettors with a banned front. Two must agree before anything happens." |
| 0:30 | **Next** twice to Step 5 | "We hold only the suspicious surplus, ₹1,17,327 of that day's ₹1,49,360. Real sales settle on time." |
| 0:45 | **Next** to Step 6 | "Diwali spikes every sweet shop, so we hold ₹0. All on simulated data, and every screen says so. Want to try to fool it? Tile 2." |

## If a judge asks

| Question | Go to | Say |
|---|---|---|
| "Isn't this circular? You made the data." | **Evaluation → Real shops we didn't design** | Yes, partly, so we tested ourselves on 112 real honest shops (Olist sellers and a UK wholesaler with real refunds). First run: 7 of 57 at Act. Cause: drift and peers both just say "unlike normal". Fix: Act needs a betting-specific engine. Checked on a second period we hadn't looked at: 0 of 55 at Act (3 without the rule). Still 12 of 112 reach Review, an analyst cost we admit. |
| "How many false alarms?" | **Engines lab → Peers** | A plain z > 3 rule gives about 1,350 alarms per million merchant-hours. Persistence (3 of 6 hours) plus the two-engine gate cut that down, and the funnel there is measured. |
| "How fast is it?" | **PayU flow, API & ops → Scoring API** | One scoring call takes 0.32 ms at p50 and 0.63 ms at p95 on this laptop (single-threaded Python, 10,000 calls). That's a laptop benchmark, not a production claim. |
| "Where does it sit in PayU?" | **PayU flow → Where PULSE plugs in** | Between payment capture and the T+1 settlement batch. That's the only point where money can still be held. |
| "How many analysts?" | **PayU flow → Analyst workload** | Move the threshold slider. Minutes per alert is a design parameter we chose, and the page says so. |
| "What does the analyst see?" | **Analyst console** | The queue, three reasons per case, Approve / Escalate / Dismiss, and an audit log you can download but can't edit. |
| "What does the merchant see?" | **Analyst console → Merchant's view** | Routine checks at each level. The compliance track stays hidden. |
| "Why not just a rules engine?" | **Rules vs PULSE** | The simple "volume over 3× the first month" rule fires on Diwali and misses quiet fronts. PULSE does neither on the same merchants. |
| "A brand-new shell company?" | Sandbox preset **New shell** | It's flagged and has money held on its first betting day, because its bettors were already linked to a banned front. In the full pipeline S5 is flagged 2 hours after its first payment, with money held on day 1. |
| "What is real?" | **What's real** (Data & assumptions) | Only the bakery's normal pattern. Every rule for the simulated betting cites a public ED / DGGI / CUTS finding. |
| "Is it live?" | **Live feed** → **Inject takeover** | A simulated city at accelerated time. The counters (payments scored, µs per payment) are measured, not typed in. |
| "Can I see it move?" | **2-minute film** | A hands-free cinematic version. Press Play, then F for fullscreen. |

## Don't say

- "calibrated probability" or "X% accurate". Say "risk band" and "on simulated scenarios".
- "This works on PayU data." We have never seen PayU data.
- "Flagged day one, held day two" for the new shell. The true numbers are flagged 2 h after its first payment, with money held on day 1.
- The ₹4,12,000 night or the 847 bettors. Those are poster dramatisations. If a judge raises them, say "dramatised, not from the app".
