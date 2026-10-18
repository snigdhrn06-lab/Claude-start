# Sentinel — financial decision protection

> Banks protect transactions. Sentinel protects financial decisions.

A scammer can talk someone into a perfectly valid-looking UPI transfer. Sentinel reads the **conversation behind the payment**, finds social-engineering signals, ties every one of them to quoted evidence and to who said it, scores the risk with a transparent, versioned policy, and recommends a proportionate verification step *before* the user authorises the payment.

**Prototype status.** All data is synthetic. Sentinel is not connected to any bank, UPI app or payment rail: it cannot send, hold or stop a real payment. The payment "hold" in the UI is a labelled simulation.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
```

Judge Mode: `/judge` (→/Space next, ← back, R replay, A auto, Esc exit). Three demos: a KYC scam, a legitimate urgent payment, and a live counterfactual. Works without an API key.

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (`next/core-web-vitals`, `next/typescript`) |
| `npm test` | 71 unit, integration and regression-gate tests (Node test runner via `tsx`) |
| `npm run bench` | Offline benchmark: 124 synthetic cases, Sentinel vs keyword baseline → `bench/results/latest.{md,json}` and `src/data/benchmark-summary.json` |
| `npm run bench:live` | Adds the generic-LLM and Sentinel-LLM assessors. Needs `ANTHROPIC_API_KEY`; otherwise they are reported as skipped |
| `npm run calibrate [-- -v]` | Scenario scores and counterfactual deltas, with the full score trace in verbose mode |
| `npm run check` | typecheck + lint + test + bench |

## Environment (all optional)

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Enables LLM perception (signal extraction) and screenshot OCR. Server-side only |
| `SENTINEL_MODEL` | Model override (default `claude-opus-5-5`) |
| `SENTINEL_AI_MODE=local` | Forces the local engine even with a key |

Without a key everything runs on the deterministic local engine. Any provider failure falls back to it and says so.

## How it works

```
input ─▶ parse (speakers, duplicates, reported quotes) ─▶ perception ─▶ grounding ─▶ score ─▶ decision ─▶ narrative
                                                          │                │            │          │
                                     local patterns (+ optional LLM)   every quote    versioned   proportionate action,
                                     account context provider          re-checked:    scorecard   5-step workflow,
                                     (none / synthetic demo / user)    offsets,       + trace     uncertainty, evidence-
                                                                       speaker,                   linked recommendations
                                                                       pattern support
```

```
src/lib/engine/
  parse.ts          message model: speaker roles, WhatsApp/timestamp formats, duplicates, quoted text, parse warnings
  context.ts        AccountContextProvider: none | synthetic demo | user-supplied (integration point for real history)
  catalog.ts        versioned catalogue: 20 signals, dimensions, weights, explanations
  detect.ts         local perception: patterns with negation / descriptive-text guards, entities, context signals
  grounding.ts      evidence validation (grounding, attribution, pattern corroboration), entity validation
  score.ts          scoring policy v2 + full score trace (docs/SCORING.md)
  decision.ts       action tier, decision workflow, uncertainties, recommendations
  narrative.ts      classification, attack chain (observed/inferred/hypothetical), conditional escalation paths
  counterfactual.ts controlled edits, signal / term / action diffs, limitations
  record.ts         compact versioned decision record (no raw conversation)
  analyze.ts        pipeline assembly + provenance (engine/policy/catalog versions, input fingerprint)
src/lib/ai/         core.ts (LLM perception, OCR, prompt-injection defences) · provider.ts (server-only entry)
src/lib/api/        request validation, body limits, rate limiting
src/app/api/        /analyze · /ocr · /status · /v1/decision
bench/              dataset.ts (124 cases) · metrics.ts · baselines.ts · run.ts · results/
tests/              node:test suites
```

The LLM, when enabled, only *perceives*: it reports signals with quotes. Each quote must be found verbatim in a non-user message or it is rejected; quotes no local pattern corroborates are marked "model-only" and capped. Local pattern hits are always kept, so the LLM can extend coverage but cannot silently suppress a deterministic finding. Scores are always computed by the deterministic engine.

## What is real and what is simulated

| Real (computed) | Simulated / illustrative |
|---|---|
| Parsing, detection, grounding, scoring, decision, recommendations | The payment app screen and its hold / cancel / proceed outcomes |
| Counterfactual comparisons | Sentinel Circle sending and replies (replies follow the analysis, nothing is sent) |
| Benchmark metrics on the Evaluation page | Threat Center figures (placeholder data in a design mock-up) |
| LLM perception and OCR (only with an API key) | Synthetic demo account profile (always labelled) |

## Further reading

- [docs/SCORING.md](docs/SCORING.md) — the scoring policy, what the score means and does not mean
- [docs/EVALUATION.md](docs/EVALUATION.md) — dataset, metrics, results, baseline comparison, limitations
- [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) — data flows, safeguards, known gaps
- [docs/INTEGRATION.md](docs/INTEGRATION.md) — what a real payment-provider integration would require

## Deploy to Render

`render.yaml` configures a Blueprint (New → Blueprint → this repo). Leave `ANTHROPIC_API_KEY` blank to run on the local engine. Manual setup: build `npm ci --include=dev && npm run build`, start `npm start`, `NODE_VERSION=22`.
