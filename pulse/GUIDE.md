# PULSE explained simply

This guide assumes you know nothing about the app. It covers:

- the problem, in plain words,
- what PULSE does,
- every page and chart: what you see, what it means, and what to say,
- a cheat sheet of numbers,
- answers to questions judges are likely to ask.

The numbers come from the current build. If you rebuild, they can shift slightly.

---

## 1. The problem in one minute

**PayU** lets shops accept online payments (UPI, cards). Before a shop can use PayU, it passes **KYC**, a document check: "Yes, this really is a bakery."

**The trick:** a real bakery passes KYC. Later, someone else quietly uses the same PayU account to **collect money for illegal cricket betting**.

- The documents are still genuine.
- Every single payment looks ordinary (₹500 here, ₹1,000 there).
- So checking payments one by one finds nothing.

**What is different is the *pattern*.** A bakery sells bread in the morning to the same locals. A betting front takes money at 9 PM during India v Pakistan from strangers all over the city, and then "refunds" the winners.

> **One-line pitch:** PULSE doesn't judge single payments. It learns each shop's normal rhythm of life and notices when the shop stops behaving like what it said it was.

---

## 2. What PULSE does: 5 steps

| Step | Plain words | Analogy |
|---|---|---|
| 1. Learn each shop's normal | Hours, bill sizes, regular customers, refunds | A doctor knows your normal heartbeat |
| 2. Compare with similar shops | On Diwali every sweet shop is busy, so that's fine. One bakery busy alone at midnight is odd | If the whole class scores 90, the test was easy; if one student does, look closer |
| 3. Look for what betting can't hide | Money going back to the same people (winnings), activity that follows live matches, the same gamblers appearing at several shops | Fingerprints at a crime scene |
| 4. Combine everything into one score | Four "detectors" (engines) give one probability plus 3 reasons in plain English. **Never act on one detector alone** | A jury, not one witness |
| 5. Respond fairly | Small steps first (L0 to L5). Hold back only the suspicious money. Honest shops can earn better terms | A traffic cop gives a warning before a fine |

---

## 3. Words you will see

| Word on screen | What it means |
|---|---|
| **Merchant** | A shop or business that accepts payments through PayU |
| **Payer** | A customer who pays the shop |
| **Front** | A shop that looks legitimate but is secretly collecting betting money |
| **Honest** | A normal shop |
| **Real data / Simulated** badges | **Real** = actual transactions from a real bakery (a public dataset). **Simulated** = made by us on a computer. Almost everything except the hero bakery's normal sales is simulated |
| **Pattern of life** | A shop's usual rhythm: when it's busy, how much people pay, who pays |
| **Baseline / normal / anchor** | The shop's first 30 days of activity, frozen and used as "this is normal". It is never updated by suspicious days, so a criminal can't slowly teach the system that crime is normal |
| **Peers / peer group** | Similar shops (same type, similar size) |
| **Engine** | One detector. There are four: Drift, Peers, Invariants, Graph |
| **Fired** | That detector thinks something is wrong right now |
| **Score / probability (p)** | PULSE's estimate of how likely the shop is a front right now (0% to 100%) |
| **Calibrated** | The score is honest: "30%" really means about 30 out of 100 such cases were fronts (in our simulation) |
| **Reasons** | The top 3 explanations, in plain English, with real numbers |
| **L0 to L5** | The response ladder, from "just watch" to "close the account" (see below) |
| **Delta reserve** | Holding back only the suspicious extra money, not the whole day's sales |
| **Fingerprint** | A sign a payment might be a bet: made during a match, a round amount (₹500, ₹1,000), from a new customer far away, or from someone who was paid "refunds" |
| **Settlement / T+1** | PayU pays the shop its money the next day. That gives PULSE time to hold suspicious money before it leaves |
| **STR** | Suspicious Transaction Report, the official report to India's financial intelligence unit. PULSE only *drafts* it; humans file it |
| **Match window** | The time a cricket match is being played (shaded green on charts) |

### The response ladder

| Level | Name | What happens | Who decides |
|---|---|---|---|
| L0 | Watch | Nothing; normal monitoring | Automatic |
| L1 | Silent check | Quietly checks payments come from the shop's own website/app. Shop notices nothing | Automatic |
| L2 | Micro-proof | Shop is asked for an OTP and one supplier invoice | Automatic, needs **2 detectors to agree** |
| L3 | Delta reserve | Video KYC; only the suspicious extra money is held | Automatic, needs **2 detectors** |
| L4 | Restrict | Pause refunds and payouts | **Human analyst must approve** |
| L5 | Exit + STR draft | Close the account, draft the report | **Human analyst must approve** |

**Inference:** the system can't hurt a shop badly on its own. The biggest automatic step is holding back suspicious money, and anything harsher needs a person.

---

## 4. The app page by page

The left sidebar has 8 pages. **Cinematic presentation** is the hands-free version of the whole story (see section 4a below). **Story mode** is the demo; the others are for deeper questions.
Use **Next →** and **← Back** to move through Story mode. The row of 7 boxes at the top shows where you are.

### Story mode, step 1: Meet the bakery (badge: REAL DATA)

**What you see**
- 4 dark cards: **58 payments a day**, **median bill ₹180**, **334 local regulars** (they make **91%** of payments), **159 open days**.
- Left chart: payments by hour, weekday (green) vs weekend (dark). Peaks are around 10 AM to 2 PM; almost nothing after 6 PM.
- Right chart: bill sizes. Most bills are ₹100 to ₹300.

**What it means:** this is a real bakery's normal life. It's busy in the morning and at lunch, quiet at night, bills are small, and the same locals come back again and again.

**Say:** "This is a real bakery's normal. Small bills, daytime hours, the same regulars. PULSE learns this for every shop."

**Honesty note:** the transactions are real (a public UK bakery dataset moved onto the 2025 calendar). Rupee prices and customer IDs are our assumptions.

### Step 2: Day T, the takeover (SIMULATED)

**What you see**
- A bar chart across about 6 days. Green bars = payments outside match times; **dark bars = payments during matches** (green shaded areas).
- A green line = PULSE's score. It jumps from 0 to the top on the first match night.
- A **▶ Replay** button plays it hour by hour.
- Cards: **185 payments on Day T** (normally about 58), **69% inside match windows**, **₹2.1 lakh paid out as "refunds"** (14–20 Sep), **first flag at 19:00 on 14 Sep, in the same hour as the first bets**.

**What it means:** on 14 Sep 2025 (India v Pakistan) the bakery suddenly gets three times its usual payments, mostly during the match, from strangers, and pays "refunds" afterwards. Each payment looks normal; the pattern doesn't.

**Say:** "Same shop, same papers. But about 70% of today's payments arrived during the match, and winners were paid back as refunds. PULSE flagged it within the hour."

### Step 3: Four engines light up (SIMULATED)

**What you see:** a clock slider and 4 tiles. Dark tile = **FIRED**; white tile = **QUIET**. Each tile has a small chart underneath.

| Tile | Plain meaning | Mini chart | How to read it |
|---|---|---|---|
| 1. Drift from its own past | "This shop is acting unlike itself" | Bars = last 24 h; green line = its normal | Big bars at night where the line is flat means unusual hours |
| 2. Peers | "Other bakeries aren't doing this" | Dark line = this bakery; mint line = other bakeries | Dark shoots up, mint stays flat: it's alone, so suspicious |
| 3. Betting invariants | "Money goes in and comes back to the same people, and it follows the match clock" | Two circles (Venn) | Left = people who paid; right = people paid back. **34 of 34** people who got money back had paid in, a closed loop |
| 4. Network graph | "Its customers are known gamblers" | Grey bar = expected by chance; dark bar = observed | About **8** shared customers expected by chance vs **32** observed, with a front banned on 29 Aug |

**Inference:** each tile alone could be innocent (a busy night, a lucky coincidence). **All four together is very hard to explain innocently.** That's why PULSE needs at least two to agree before acting.

**Say:** "Four independent detectors. Any one alone could be a coincidence; all four agreeing is not."

### Step 4: One fair score (SIMULATED)

**What you see**
- A gauge showing **> 99%**, with "Action now: **L3 Delta reserve**", "4 of 4 engines agree", and "L5 recommended; needs analyst approval".
- **Why:** 3 reason cards in plain English, for example:
  - "69% of payments in the last 24 h fell inside live-match windows vs 2% in its baseline"
  - "32 of its 537 payers in the last 30 days also paid Skyline Tours & Travels, banned on 29 Aug (about 8.3 expected by chance)"
  - "38 payers paid again within 10 minutes"
- **The decision rule** box: act only if *p × cost of missing fraud > (1 − p) × cost of bothering an honest shop*.

**What it means:** the four detectors are combined into one number, and every reason quotes real numbers from the payments, not made-up text. The rule makes the trade-off explicit: be stricter when the evidence is stronger, gentler when it's weak.

**Why "> 99%" and not 100%:** in our simulated data, every case scoring this high was a front. Real life is messier, and we say so on screen.

**Say:** "One score, three plain reasons a compliance officer can read, and a clear rule for when to act."

### Step 5: Proportionate action (SIMULATED)

**What you see**
- Bars for each hour of the takeover day. **Green = money that is paid to the shop on time. Dark = money held.**
- A bright green line = **Tolerated**: how much extra is acceptable.
- Cards: paid in on Day T **₹1.49 lakh**; **held ₹1.17 lakh** (only the suspicious extra); **settles on time ₹32,000** (the real bakery sales); held over the whole case **₹32 lakh** (simulated, to 2 Nov).

**What it means:** PULSE doesn't freeze the whole shop. Morning bread sales are paid normally; only the night-time betting money that carries fingerprints is held. "Tolerated" rises automatically on festivals, because all similar shops get busy then.

**Say:** "We don't punish the bakery's real sales. We hold only the suspicious surplus, and anything harsher needs a human."

### Step 6: Honest cases stay quiet (SIMULATED)

**What you see:** two panels.
- **S1 Lakshmi Sweets on Diwali:** big spikes in payments, a grey strip at the bottom (that strip shows the level over time; grey = L0), **highest level L0**, delta reserve **₹0 held even if we forced L3**.
- **S2 Third Umpire Sports Bar on match nights:** spikes during matches (green shading), highest level **L1 Silent check** only.

**What it means:**
- On Diwali, **every** sweet shop is busy, so PULSE compares with peers and sees nothing unusual.
- A sports bar is *supposed* to be busy during matches. Its customers are locals and nobody is paid back, so it stays at a silent check the shop never notices.

**Say:** "False alarms cost honest businesses money. PULSE stays quiet on festivals and sports bars, which are exactly the cases a simple rule would wrongly flag."

### Step 7: Evidence pack (SIMULATED)

**What you see:** a preview of the **Analyst case file** (timeline, engine readings, reasons, links to banned fronts, money movement, actions, a **draft STR**), two download buttons (Markdown and HTML with charts), and a two-column table:
- **Visible to the merchant:** OTP, invoice, video KYC, part of settlement delayed.
- **Hidden compliance track:** case opened, evidence frozen, STR drafted. **The merchant is not told** (by law you must not "tip off" a suspect).

**Say:** "One click gives the analyst everything, including a draft report. Clearly marked as a draft: humans review and file it."

### Page: Merchant explorer

Pick **any** of the 314 shops from the dropdown.
- **Cards:** highest level reached, peak score, first time it reached L2, and the **Truth** (shown only because the data is simulated; in real life you wouldn't know).
- **Top chart:** payments per day. Grey bars = the first 30 days, when PULSE is still learning the shop's normal, so nothing is scored.
- **Middle chart:** the 4 detector scores and the overall score over time.
- **Bottom strip:** ladder level over time (grey = L0; darker = higher).
- **Reasons** and **Merchant facts** (category, city, peer group, train/test).
- **Hourly zoom** (scenario shops only): pick a day and see it hour by hour.

**Good example:** select **[S0] Sunrise Bakery (S0 twin)**. The drift score crosses 0.5 once in late July (holiday closures in the original data), but **no second detector agreed, so it stayed at L0**. That's the "never act on one detector" rule working on real data.

### Page: Engines lab (for technical judges)

Four tabs, one per detector.
- **Drift:** lines for each part of "acting unlike itself" (hours, amounts, round numbers, volume) and a threshold slider. The two cards show how often honest shops vs fronts cross the line. **Inference:** move the threshold and you trade catching fronts against bothering honest shops.
- **Peers: the "alarm flood" lesson.** A simple statistical rule (z > 3) would ring about **1,350 times per million shop-hours**. On our simulated honest shops the measured count is about **9,900**, and it falls to about **6,800** with "must last 3 of 6 hours" and to about **150** with "a second detector must agree". **Inference:** naive rules drown analysts; requiring agreement cuts false alarms by around 98%.
- **Betting invariants: the match clock.** The histogram shows what happens if we pretend matches were on 1,000 random other dates. The dark line is the real value, far to the right of all of them. **Inference:** the activity really follows the cricket schedule, not chance.
- **Network graph:** a calculator. Enter pool size, gambler count, customers and shared customers, and get the "expected by chance" figure and the probability.

### Page: Network

- **Top graph:** the brand-new "IT services" shell (S5, big dark square), the **banned front** (dark X), and the shell's first 20 customers. **Bright green dots** = customers who were also gamblers at the banned front.
- **Cards:** **12 of 20** shared; **0.84 expected by chance**; the probability of this by luck is about **1 in 400 billion** (10^-11.6). In a 5-million-person region it would be **0.008** expected.
- **Bottom graph:** the **E2 ring**, betting split across 10 small shops. Thick lines = many shared gamblers; dotted lines = shared phone/device IDs. The slider hides weak links.

**Inference:** criminals can open new shops, but they can't easily replace their customers. Shared gamblers expose the new front on day one.

**Say:** "A shop opened two days after we banned a front, and 12 of its first 20 customers were that front's gamblers. By chance you'd expect fewer than one."

### Page: Response & trust

Three tabs.
1. **Friction ladder & costs:** sliders for "cost of missing fraud" and "cost of bothering a shop" at each level. The table shows the score needed for each level. Below, see what happens to the scenario shops. **Inference:** management can set how strict PULSE is, transparently, without touching the model.
2. **Delta reserve calculator:** pick the takeover bakery or the Diwali sweet shop and move the tolerance slider. The bars show held vs paid on time.
3. **Earned Trust:** tiers 0 to 3 of sharing extra data with consent (GST, bank statements).
   - **Honest twin:** sharing data **lowers** its score (0.006 → 0.002) and **widens its tolerance** (better terms, faster settlement). Its data shows money going to suppliers and rent (77%) and GST matching its sales (0.97).
   - **Front:** sharing exposes it. **82% of money is moved out within 2 hours**, and PayU sales are **6.8×** what it declares for GST.
   - **Refusing to share is never punished;** you just don't get the perks.

**Say:** "Honest shops can earn better terms by sharing data. For a front, that same data gives the game away."

### Page: Evaluation, "Performance on simulated scenarios"

**Read the title carefully:** these are results on **simulated** test shops, not real PayU results.

| Card | Number | Plain meaning |
|---|---|---|
| Recall | **97%** | Of 29 fake fronts in the test set, PULSE caught 28 |
| Precision@10 | **1.00** | Of the top 10 shops PULSE ranked most suspicious, all 10 were real fronts (@50 is 0.58 only because there are just 29 fronts to find) |
| PR-AUC | **0.983** | Overall ranking quality, where 1.0 is perfect. Shows PULSE puts suspicious days above normal days |
| False alarms L3+ | **0.0** | No honest test shop ever got money held |
| Money held at L3 | **₹119 lakh** | Betting money held, vs ₹47 lakh that had already been paid out before PULSE flagged |

**Scenario scorecard:** 9 test cases, each with expected vs actual, all ✅ PASS.

| ID | Story | Result in plain words |
|---|---|---|
| S0 | Real bakery, normal months | Never flagged |
| S1 | Diwali rush | Never flagged; ₹0 held |
| S2 | Sports bar on match nights | Only a silent check (L1) |
| S3 | Bakery taken over | Caught in the first hour; money held |
| S4 | Slow creep (+3% betting a week) | Caught in week 6, before reaching 20% |
| S5 | New fake "IT company" | Caught 2 hours after its first payment |
| E1 | Criminals avoid round amounts | Still caught in the first hour |
| E2 | Betting spread over 10 small shops | All 10 caught, but slowly (median ~17 days) |
| E3 | Winnings paid outside PayU | Still caught within 1 hour |

**The charts on this page**
- **Ablation** (switching each detector off): without the graph detector recall falls to **62%**; without invariants, to **76%**. Without peers nothing changes in this simulation. **Inference:** the network and betting-pattern detectors do most of the work; we report the peer result honestly.
- **Reliability plot:** if the line follows the dashed diagonal, scores are honest. Ours is close but not perfect, especially in the middle range.
- **Time to detect:** two groups. Big fronts are caught within hours; small or quiet ones take days to weeks (often until their gamblers' old shop is banned).
- **Fairness table:** how often honest shops in each city tier, size and category got flagged. **No honest shop ever reached L2 or L3.** Many reached **L1** (the invisible silent check), for example every sports bar, because they're busy during matches. L1 costs the shop nothing.
- **Stage A vs Stage C:** a simple hand-made scorecard (no training) already catches the same 97%, but has a few false alarms (3.2 per 1,000 shop-months). The trained model removes them.

### Page: Data & assumptions

- **Four boxes:** Real → Transformed → Simulated → Outputs. This is the honesty map.
- **Tabs:** the real data details; every assumption; each betting rule **with the news finding it's based on** (ED 1xBet case, Parimatch refunds, DGGI shell firms, iPaisa, CUTS survey); the cricket fixtures (several marked *to be verified*); all the settings.

**Say if asked "is this real?":** "The bakery's normal is real public data. The rest is simulated, and every rule is based on a published enforcement finding. All of it is listed here."

---

## 4a. Cinematic presentation (the hands-free demo)

**What it is:** a full-screen, self-playing version of the whole story, about **3 minutes 17 seconds** long and 10 chapters. Press **Play** once and it runs to the end on its own, like a product video. The visuals are drawn live from the same data as the rest of the app.

**How to open it:** sidebar → **Cinematic presentation**, or the **▶ Cinematic presentation** button at the top of Story mode. The **⬇ Offline copy (HTML)** button next to it downloads the same presentation as one file that plays in any browser, even without the app running.

**Controls** (they fade away while it plays; move the mouse to bring them back):

| Key or button | What it does |
|---|---|
| **Space** | Pause / resume |
| **← / →** | Previous / next chapter |
| **R** | Replay from the start |
| **F** | Fullscreen (or press F11 if the browser blocks it) |
| **X** or **✕ Exit** | Back to the normal app |
| Clicking the progress bar | Jump to that moment |

**The 10 chapters:**

| # | Chapter | What the audience learns |
|---|---|---|
| 1 | The blind spot | Every payment can look legitimate; the business behind it may not be |
| 2 | Meet the merchant | The real bakery's normal: 58 a day, ₹180 bills, 91% regulars (**REAL DATA**) |
| 3 | The takeover | 14 Sep: 185 payments, 69% during the match, refunds loop back, flagged at 19:00 |
| 4 | Four engines | Drift, Peers, Invariants (34 of 34) and Graph (32 vs 8.3) fire one by one, then converge: 4 of 4 agree |
| 5 | A decision | > 99% score, three real reasons, action L3 now; L5 only with analyst approval |
| 6 | The money | ₹1.49 lakh in → ₹1.17 lakh held, ₹32,033 paid on time; Diwali Tolerated rises, so ₹0 held |
| 7 | Honest cases | Lakshmi Sweets stays L0 on Diwali; the sports bar stays at the L1 silent check |
| 8 | The network | The new shell: 12 of its first 20 payers vs 0.84 expected (about 1 in 400 billion) |
| 9 | Evidence pack | The real case file assembles itself; the STR is a draft for humans |
| 10 | Validation and close | 28 of 29, 97%, 1.00, 0.983, 0 honest at L3+, 9/9, plus the limitations, then the closing line |

**Tip for the big screen:** open it, press **F** for fullscreen, press **Play**, and step away. If the browser tab is hidden it pauses and resumes when you come back, so nothing is skipped. At the end it holds the closing frame and does not restart.

## 5. Cheat sheet: numbers to remember

- **58** payments a day, **₹180** median bill, **91%** from regulars (real bakery)
- Takeover: **14 Sep 2025, India v Pakistan**; **185** payments that day; **69%** of payments during the match; caught **in the first hour**
- **4 of 4** detectors agree; score **> 99%**; action **L3**, with L5 only after a human approves
- Day T: **₹1.49 lakh** in; **₹1.17 lakh** held; **₹32,000** of real sales paid normally
- Network: **12 of 20** shared vs **0.84** expected (**0.008** in a 5-million region)
- Alarm flood: about **1,350** naive alarms per million shop-hours; measured **~9,900 → ~150** once two detectors must agree
- Test results (simulated): **28 of 29** fronts caught, **0** honest shops held, all **9/9** scenarios pass

---

## 6. Questions judges may ask

**"Isn't this just rules on timing?"**
No. Four independent detectors, and action needs at least two to agree. Removing round amounts (E1) or off-platform payouts (E3) still gets caught by the others.

**"What about honest shops on festivals or match nights?"**
Step 6. PULSE compares each shop with similar shops, so a cohort-wide rush raises the "tolerated" level. Sports bars stay at an invisible silent check.

**"Why should I trust the 97%?"**
Don't treat it as a real-world number; it's simulated. It shows the *method* works on designed cases with known answers. Thresholds were fixed on training shops *before* testing, and the test shops were kept separate.

**"Can criminals slowly train the system to accept betting?"**
No. The "normal" is frozen from the shop's first 30 days, and suspicious days never update it. The slow-creep case (S4) is caught at week 6.

**"What if they open a brand-new shop?"**
New shops are compared with what they *declared* at KYC ("IT services": office hours, big invoices) and checked for shared gamblers. S5 was caught 2 hours after its first payment.

**"Isn't holding money unfair?"**
Only the suspicious surplus is held, and only payments with betting fingerprints. Real sales are paid on time. Closing an account needs a human.

**"Is the merchant told?"**
They see routine checks (OTP, invoice, video KYC). The investigation and STR draft stay hidden, as the law requires.

**"Where is the weakness?"**
Small fronts can take days to weeks to catch, especially before any related front is banned. The peer detector added nothing in this simulation. And real data will be noisier, so the scores won't be this clean.

---

## 7. What NOT to say

- ❌ "PULSE catches 97% of fraud at PayU." ✅ "On simulated test cases it caught 28 of 29."
- ❌ "This is PayU data." ✅ "One real public bakery dataset; everything else is simulated and labelled."
- ❌ "The STR is filed automatically." ✅ "PULSE drafts it; compliance reviews and files it."
- ❌ "Fixture dates are official." ✅ "Some are verified; the rest are marked *to be verified*."
