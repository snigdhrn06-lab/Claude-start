# Scoring policy (v2.0.0)

Source: `src/lib/engine/score.ts`. Every constant lives in `POLICY`; changing one requires bumping `POLICY_VERSION`.

## What the score is

A 0–100 **risk score**: a ranking of how strongly the submitted material matches social-engineering patterns. It is **not** a calibrated probability of fraud. No calibration on real outcome data has been done, so "99" means "very strong match to known patterns", not "99% likely to be a scam". Signal *confidence* is likewise the strength of textual evidence for that signal, not a fraud probability; the UI calls it "evidence strength".

## Calculation

1. **Within a dimension** (context, pressure, transaction, recipient), signals combine as a noisy-OR of `weight × strength`. Several urgency phrases therefore add diminishing amounts — the same kind of evidence is not counted linearly.
2. **Across dimensions**, contributions add in log-odds points: `points = dimPoints[d] × dimensionValue`. Maximums: context 2.6, transaction 2.2, pressure 1.6, recipient 1.6. (In v1 recipient had weight 0, so recipient risk was displayed but never scored.)
3. **Interactions** (named, capped at 2.0 points in total):
   - claimed identity / pretext (authority, guarantee, refund, new-number claim, windfall) + a concrete ask: up to 1.3
   - coercion (threat, isolation) + a concrete ask: up to 0.9
   - urgency toward an unverified recipient: up to 0.6
4. **No-ask gate.** If nobody asked for money or secrets (and no payment details were entered), context and pressure evidence counts at ×0.75. A guaranteed-return claim is exempt because the claim itself is the harm. This separates a suspicious conversation from a concrete request.
5. **Mitigations** (independent verification path, saved recipient) subtract points, are halved when the same conversation contains a concrete ask (or, for a saved recipient, a credential request), and together can remove at most 35% of the positive evidence.
6. `score = round(100 · sigmoid(baseline − 3.2 + Σ terms))`, clamped to 1–99.
7. **Floor rules**, applied last and shown explicitly: a pattern-supported credential request (OTP/PIN/card/remote access, strength ≥ 0.75) sets a minimum of 80; pay-to-receive (strength ≥ 0.8) sets 65. Model-only assertions and the user's own words never trigger a floor.

Every term is stored in `scoreTrace.terms`; the terms sum exactly to the logit and the UI table *is* the calculation (tested in `tests/scoring.test.ts`).

## Bands (provisional)

| Band | Score | Default action |
|---|---|---|
| low | < 25 | proceed (confirm recipient name) |
| caution | 25–49 | proceed with care: specific checks |
| elevated | 50–74 | verify before paying |
| high | ≥ 75 | stop: do not pay or share anything; verify independently |

Thresholds were chosen on the **dev split** of the synthetic benchmark (see the threshold sweep in `bench/results/latest.md`): at 50 the dev split has no false positives while keeping recall; at 75 the "stop" tier remains false-positive-free. They are provisional until validated on real data.

"Insufficient evidence" is reported when there is no text from the other party and no account context, or the input is very short with no signals. The action is then at least "proceed with care" and the user is asked for more context.

## Account context

Beneficiary and amount signals need history Sentinel does not have. `AccountContextProvider` (`context.ts`) supplies it from: nothing (default for user scans), the fictional demo profile (always labelled synthetic), or a list the user types. Without context, `new_beneficiary`/`amount_anomaly` are never raised; the gap is listed as an uncertainty. "Not in saved recipients" never means "fraudulent".
