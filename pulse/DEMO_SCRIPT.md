# PULSE demo: 2-minute narration

**Hands-free option:** sidebar → **Cinematic presentation** → press **F** for fullscreen → **Play**. It runs the whole
story by itself in exactly 2:00 (10 chapters) and holds the closing frame. Use the click-through script below if you want
to narrate live instead.

Setup: `make app`, browser at full screen (1440 px wide), Clean display on (default). Start on **Story mode, step 1**.
The timings add up to about 2:00. Words in *italics* are on screen; numbers come from the current artefacts, so re-read
them after any rebuild.

| Time | Click | Say |
|---|---|---|
| 0:00 | Story mode · Step 1 *Meet Sunrise Bakery* (Real data badge) | "This is a real bakery's pattern of life: about 58 payments a day, breakfast and lunch peaks, a median bill of ₹180, and 334 regulars who make 91% of payments. That comes from public transaction data. Everything we add on top is simulated and labelled." |
| 0:15 | **Next →** Step 2. Press **▶ Replay** | "On 14 September, India v Pakistan, the same merchant ID starts taking bets. The papers are still genuine, and every payment looks normal on its own. Watch the dark bars: 69% of the day's payments land inside match windows, and winners are paid back as 'refunds'. PULSE flags it in the same hour as the first bets." |
| 0:35 | **Next →** Step 3 (clock already at the hour all four agree) | "Four engines look at what betting can't hide. Drift from its own past. Its peers: other bakeries didn't surge. The betting invariants: a match clock with a placebo test, and a closed loop of payouts to earlier payers. And the graph: it now shares bettors with a front we banned in August. No engine acts alone." |
| 0:55 | **Next →** Step 4 | "They fuse into one calibrated score with three plain reasons. Every number in them is recomputed from the payments. The decision rule is explicit: act only if p × the cost of fraud beats (1 − p) × the cost of friction." |
| 1:10 | **Next →** Step 5 | "The response is proportionate. L3 is a delta reserve: we hold only the surplus above a festival-aware tolerated level, and only payments carrying a betting fingerprint. The bakery's real daytime sales settle on time. L4 and L5 always need an analyst." |
| 1:25 | **Next →** Step 6 | "And the honest cases stay quiet. On Diwali every sweet shop jumps, so the peer gap stays small and the reserve holds zero rupees. The sports bar is busy every match night, but its payers are locals and nobody is paid back, so it never goes past a silent check." |
| 1:40 | **Next →** Step 7. Hover the **Download** buttons | "One click gives the analyst a case file: timeline, engine readings, graph links, and a draft STR clearly marked not filed. The merchant sees routine checks; compliance sees the hidden track." |
| 1:50 | Sidebar → **Evaluation** (scroll to the scorecard) | "On simulated test merchants, every scenario behaves as expected, including three evasions. Thresholds were frozen on training merchants first. That's PULSE: learn each merchant's normal, compare with peers, and act fairly." |

Backup clicks if a judge asks:

- *"What about false alarms?"* → **Engines lab · Peers**: naive z > 3 gives about 1,350 alarms per million merchant-hours, and the measured funnel shows persistence and corroboration cutting it down.
- *"How do you link shells?"* → **Network**: 12 of the S5 shell's first 20 payers are bettors of a front banned two days earlier, against 0.84 expected by chance (0.008 in a 5-million pool).
- *"What if the honest shop wants better terms?"* → **Response & trust · Earned Trust**: switch the tier and compare the honest twin with the front.
- *"What is real?"* → **Data & assumptions**.
