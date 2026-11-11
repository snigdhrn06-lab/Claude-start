# Consult Brain

A consulting investigation laboratory with a competitive learning ecosystem.
Learners take a client brief, commit confidence to competing hypotheses, spend a limited budget of analyst hours on data and interviews, size the problem, recommend, and defend the recommendation in a boardroom. The **Evidence Trail Replay** then shows how their beliefs moved, which evidence mattered, what they missed, and how their route compares with two expert routes.

Built for PromptEd 2026. The teaching use is the point: a professor can assign a case and see how every student investigated, not only what they concluded.

## Run it

Requires Node 18 or later. No API key, account or database is needed.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The API runs on port 8787 and Vite proxies to it.

Single-port production build:

```bash
npm run build
```

```bash
npm start
```

Open http://localhost:8787.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run reset` | Wipes local data and re-seeds the demo learner, professor, class and leaderboards |
| `npm test` | Engine smoke test: validates every case and runs ten scripted learners end to end |

## Environment variables

All optional; see `.env.example`.

| Variable | Effect |
| --- | --- |
| `PORT` | API port (default 8787) |
| `ANTHROPIC_API_KEY` | Turns on AI-phrased stakeholder replies and AI-assisted grading of boardroom answers |
| `CB_MODEL` | Model to use with the key (default `claude-opus-5-5`) |
| `CB_DISABLE_AI=1` | Forces deterministic mode |
| `CB_DATA_DIR` | Location of the local database file |

The key is read only by the server and never reaches the browser.

## Demo journey (about six minutes)

1. Sign in with **Continue as demo learner**. The Command Centre shows rank (Gold), XP, six skill ratings, standing and a recommended case.
2. Case Vault → **Brewly** → Accept engagement. Read the CEO's brief.
3. Hypotheses: adopt or write four or five, split 100 points, commit.
4. The Vault: request *Consolidated P&L*, *Revenue and orders by channel*, *Contribution economics per order*. After each, move confidence in the belief ledger and commit.
5. Workbench: click numbers in a table to pin them, compute `230*(1-0.32-0.26-0.12-0.05)-18`, answer the required analyses, run the scenario model.
6. Stakeholders: interview Ananya Rao. Ask something specific ("What changed in the QuickDine renewal?") and something vague, and compare.
7. Synthesis: complete the eight-part recommendation. Try submitting it half-empty first.
8. Boardroom: answer three challenges and the twist.
9. The Evidence Trail Replay opens automatically. Press **Play investigation**, click events, open the Scorecard, Expert routes and Debrief tabs.
10. Sign out, then **Continue as demo professor**: Students, Hypothesis distributions, Investigation trails, Reasoning failures, Live session (press Play session), then open a student to override a score and export the report.

Demo data is labelled as such everywhere. The demo class's trails were produced by running scripted learner archetypes through the real engine (`server/engine/simulate.js`), so the classroom analytics are computed, not drawn.

## Interface

- Dark-first design system in `src/styles.css`: layered surfaces, an ambient light-and-grid field, brass and signal-teal accents, Newsreader display, IBM Plex Sans and Mono.
- Motion uses `motion` (Framer Motion): page and stage transitions, shared-layout tabs and navigation, staggered reveals, animated counters and charts. All of it respects `prefers-reduced-motion`.
- Interaction layers in `src/components/Layers.jsx`: ⌘K command palette, notifications derived from real records, profile menu, first-visit onboarding, a once-a-day Daily Diagnostic announcement (never shown inside an investigation), a rank-up ceremony and achievement toasts. Dismissals are remembered.
- Generative case and Arena artwork in `src/components/Art.jsx`.
- Missions (daily and weekly) and personal records are computed server-side from real activity (`missions()` and `records()` in `server/engine/progression.js`).

## Architecture

```
server/
  index.js              Express API: auth, catalogue, attempts, arena, leaderboards, classroom
  store.js              Local persistence (one JSON document, atomic writes)
  seed.js               Demo learner, professor, class and leaderboard population
  cases/                Structured case definitions (one module per case) + registry and validator
  engine/
    caseEngine.js       Investigation state machine; the only source of what the client may see
    scoring.js          Six-skill scoring, XP breakdown, Evidence Trail Replay construction
    progression.js      XP ledger, ranks and gates, skill ratings, streaks, achievements, certificates
    text.js             Deterministic rubric helpers for written answers
    ai.js               Optional Claude integration with validation and fallbacks
    simulate.js         Scripted learner archetypes (seeding and smoke tests)
  games/index.js        Six Arena modes: puzzles, sessions and grading
shared/expr.js          Safe arithmetic evaluator used by client preview and server
src/
  App.jsx, api.js       Router, auth context, API client
  components/           UI primitives, icon set, rank emblems, SVG charts
  pages/                Command Centre, Case Vault, Investigation, Replay, Arena, Leaderboards,
                        Progress, Certificates, Classroom, Profile
```

Principles the code holds to:

- **Scoring never runs in the browser.** The client posts actions; the server validates, mutates state, scores and awards XP. Hidden case fields (signals, insights, answers, knowledge cards) are stripped by `view()` before anything is sent.
- **Arithmetic is checked in code.** Workbench answers are compared with values computed from each case's numeric model. Expressions are parsed by `shared/expr.js`; nothing is `eval`'d.
- **Written reasoning is scored against anchored rubrics.** Each rubric is a set of concepts a strong answer covers. With an API key, boardroom answers are also graded by a model against four explicit criteria, and the two scores are averaged.
- **AI characters are grounded.** The engine decides which knowledge cards a question unlocks; a model may only rephrase them. Replies containing a number that is not on the cards are discarded in favour of the card text.
- **Nothing depends on a model call succeeding.** Every AI path returns to deterministic behaviour on error, refusal or malformed output.

## Data model

One JSON document at `data/db.json` with these collections:

| Collection | Holds |
| --- | --- |
| `users` | Profile, role, password hash, XP, ledger, six skill ratings and history, streak, achievements, certificate refs, following, classrooms |
| `sessions` | Bearer tokens |
| `attempts` | One per case run: hypotheses, allocations, requested datasets, interviews, calculations, recommendation, defence, full event log, and the scored result including the replay |
| `games` | Arena results |
| `classrooms` | Join code, professor, members and teams, assignments |
| `certificates` | Issued certificates keyed by verification ID |
| `challenges` | Learner-to-learner score challenges |

`server/store.js` is the only module that touches storage. Replacing it with a SQL repository that exposes the same `all / col / put / del` functions is the migration path.

## How scoring works

| Skill | Weight | What is measured |
| --- | --- | --- |
| Structuring | 12% | Hypotheses formed before data, breadth across areas and across the profit tree, a structured recommendation |
| Hypothesis quality | 16% | Specific and testable statements, a material driver on the opening board, evidence linked correctly, a defensible diagnosis |
| Evidence efficiency | 20% | Decisive evidence obtained, hours not spent on data that could not discriminate, sequencing, depth |
| Quantitative accuracy | 16% | Workbench answers (first-attempt credit), a plausible impact estimate for the chosen option |
| Calibration | 16% | Final confidence against the weight of evidence, updates in the right direction, no premature certainty |
| Synthesis & defence | 20% | Diagnosis, cited evidence that actually supports it, rubric coverage, strategic judgement, three challenges and the twist |

Each case lists several acceptable diagnoses and scores six strategic options on a scale; more than one route earns high marks.

XP = case reward × score, plus bonuses (disciplined updating, efficient investigation, held the boardroom, quant clean sheet, strong hypotheses), times multipliers (repeat attempts 50% / 25% / 10%, each hint −8%, three abandons in a week −15%, low-effort −80%). Arena modes pay in full once a day, then 40%, 15%, 0.

Ranks: Bronze, Silver, Gold, Master, Expert, Grandmaster. Each needs XP **and** a minimum rating in every skill; from Master up, also high scores on advanced cases. Grandmaster needs 14,000 XP, every skill at 80+, two advanced cases at 88+, an average best of 85+ and a 14-day streak.

## Feature status

| Area | Status |
| --- | --- |
| Three playable cases (Brewly, Northstar Bank, CloudAxis) | Working end to end |
| Investigation engine: brief, hypothesis board, data room, workbench, interviews, synthesis, boardroom, twist | Working |
| Evidence Trail Replay with belief stream, inspectable events, playback, expert routes, debrief | Working |
| XP, six ranks with gates, six skill ratings, streaks, ten achievements | Working |
| Certificates with verification page and PDF download | Working |
| Leaderboards: global, weekly, 30-day, following, university, per-skill, intelligence | Working (seeded demo learners labelled) |
| Arena: Daily Diagnostic, Issue Tree Arena, Margin Detective, Hypothesis Duel, Boardroom Blitz, Market Strategy Challenge | All six playable and server-graded |
| Weekly tournament and season quests | Standings and progress work; the end-of-week bonus payout is not automated |
| Challenges | Send, receive, resolve by score; seeded learners do not respond |
| Professor console: classrooms, join codes, assignments, roster, teams, hypothesis distributions, trail matrix, reasoning failures, recommendation review, score override, CSV export, live session | Working |
| Accounts | Demo sign-in, registration and password login (scrypt) |
| Light and dark themes, responsive layout | Working; desktop is the primary target |

## Known limitations

- Storage is a single JSON file suited to a demo or one classroom, not concurrent multi-server use.
- Without an API key, written answers are scored by concept coverage. It rewards answers that address the right ideas with evidence and numbers, but it cannot judge the quality of an argument the way a person can, and a keyword-dense answer can score higher than it deserves. This is why professors can override scores.
- Stakeholder dialogue in deterministic mode returns the knowledge card text; it is accurate but not conversational.
- A professor's override changes the recorded score and what the student sees; it does not retroactively change XP already awarded.
- The tournament bonus is displayed but not paid out by a scheduled job.
- Live session polls every four seconds; there are no websockets.
- Institutional sign-on, email verification and password reset are not implemented.
- Certificates are Consult Brain achievements. They are not academic credentials and are not issued or accredited by IIM Bangalore or any other institution.
- Market-size and business claims belong in the separate go/no-go document, not in this product.

## Adding a case

1. Copy `server/cases/brewly.js` to a new file and change the `id`.
2. Build the numbers from a small model at the top of the file so every table and every quant answer derives from the same source.
3. Fill in the schema:
   - `briefing`: memo, background, objective, constraints, context, headline metrics, trend
   - `drivers`: causal areas, each with a `truth` weight (weights must sum to 1) and a `side` (revenue, cost or margin)
   - `hypothesisSeeds`: optional starter hypotheses, including tempting wrong ones
   - `datasets`: `cost`, `relevance` (what the learner is told), `value` (`critical`, `useful`, `ruleout`, `noise`), `signals` (which drivers it supports or undercuts, −2 to +2), `insight` (revealed in the replay), `table`, optional `chart`
   - `stakeholders`: persona, bias, and knowledge `cards` with `keywords`, `answer` and `signals`
   - `quant`: prompt, required datasets, `answer` computed from the model, `tolAbs`, explanation
   - `scenario`: levers and a pure `compute(inputs)` function
   - `options`: strategic directions with `quality` (0 to 1), a plausible `impact` range and the drivers they address
   - `diagnoses`: acceptable diagnoses as sets of drivers, each with a quality
   - `concepts`: rubric concept groups for diagnosis, risks and next steps
   - `boardroom`: three challenges with concept groups and reactions, plus one scripted `twist` with scored stances
   - `expertPaths`: two or more defensible routes
   - `hints`, `debrief`
4. Register it in `server/cases/index.js`.
5. Run `npm test`. The validator checks weights, references and that the budget forces a choice; add an archetype in `simulate.js` to exercise it end to end.

No engine or UI code changes are needed.
