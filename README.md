# Sentinel — the AI financial decision firewall

> Banks protect transactions. Sentinel protects financial decisions.

A scammer can talk someone into a perfectly normal-looking UPI transfer. Sentinel reads the **conversation behind the payment**. It extracts manipulation signals, reconstructs the attack chain, scores the risk, and holds the payment until the user has verified it.

All data is synthetic. No real transactions are executed.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
# or
npm run build && npm start
```

Judge Mode: open `/judge` (or click **Enter Judge Mode**). Controls: `→`/Space next, `←` back, `R` replay, `A` auto, `Esc` exit.

## Environment (all optional)

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Enables LLM perception (signal extraction) and screenshot OCR via Claude |
| `SENTINEL_MODEL` | Model override (default `claude-opus-5-5`) |
| `SENTINEL_AI_MODE=local` | Forces the offline engine even with a key |

The app runs fully without a key. Any AI error falls back to the local engine automatically.

## Architecture

```
src/lib/engine/      deterministic core (runs on server and in browser)
  catalog.ts         17 signals: weights, dimensions, explanations
  detect.ts          local perception: detectors, entities, ledger rules
  score.ts           transparent noisy-OR scoring + named interaction terms
  narrative.ts       classification, attack chain, predicted path, recommendations
  analyze.ts         buildResult(): perception -> structured AnalysisResult
  counterfactual.ts  signal diff between two analyses
  autopsy.ts         post-loss replay: first-visible risk, earliest safe exit
src/lib/ai/provider.ts  LLM perception (structured output, evidence grounding) + OCR
src/app/api/         /analyze, /ocr, /status
src/components/      RiskGauge, ScoreCounter, RiskSignalCard, AttackChain, PredictedPath,
                     ScanProgress, PaymentFirewall, CounterfactualLab, ThreatCharts, ...
src/app/             Home, Scan, Analysis, Attack Chain, Firewall, Counterfactual,
                     Autopsy, Threat Center, History, Circle, Judge
```

Perception and scoring are separate stages. The LLM, when it's enabled, only reports which signals are present, and it must quote the exact text for each one. A quote that can't be found in the conversation is discarded. The deterministic engine then computes every score, so identical signals always produce identical scores. `npm run calibrate` prints scenario scores.

## Deploy to Render

1. Render dashboard → **New → Blueprint** → select this repo and branch. `render.yaml` configures everything.
2. When prompted for `ANTHROPIC_API_KEY`, leave it blank to run on the local engine, or paste a key.
3. Wait for the deploy to go live. Your URL is `https://<service-name>.onrender.com`.

Manual setup (New → Web Service) uses the same values: build `npm ci --include=dev && npm run build`, start `npm start`, environment variable `NODE_VERSION=22`.
