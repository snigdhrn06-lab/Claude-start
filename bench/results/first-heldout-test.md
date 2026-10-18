# Sentinel benchmark results

Generated 2026-10-18T20:40:37.528Z · dataset v1.0.0 · engine v2.0.0 · policy v2.0.0 · catalog v2.0.0

Cases: 62 (33 scam, 26 legitimate, 3 ambiguous). Synthetic, author-written; see docs/EVALUATION.md for limitations. Not an estimate of real-world performance.

## Sentinel (local engine)

| Metric | test |
|---|---|
| Cases | 62 |
| Recall @ elevated+ | 72.7% (24/33) |
| Precision @ elevated+ | 100.0% (24/24) |
| F1 @ elevated+ | 0.842 |
| False-positive rate @ elevated+ | 0.0% (0/26) |
| False-negative rate @ elevated+ | 27.3% (9/33) |
| Recall @ high | 63.6% (21/33) |
| False-positive rate @ high | 0.0% (0/26) |
| Band matches expectation | 83.9% (52/62) |
| Required signals detected | 92.4% (61/66) |
| Forbidden signals raised | 0.0% (0/43) |
| Quote integrity (text == input[start:end]) | 100.0% (135/135) |
| Annotated evidence found | 100.0% (1/1) |
| Speaker attribution accuracy (annotated) | 100.0% (1/1) |
| Risk evidence quoted from user's own text | 0 |
| Entity grounding precision | 99.3% (149/150) |
| Annotated entity recall | 100.0% (2/2) |
| Deterministic repeatability (3 runs) | 100.0% (62/62) |
| Score trace reproduces score | 100.0% (62/62) |
| Legit urgent payments flagged | 0.0% (0/4) |

### By category (test)

| Category | n | Band matches | Flagged (elevated+) |
|---|---|---|---|
| scam_kyc | 3 | 100.0% (3/3) | 100.0% (3/3) |
| scam_impersonation | 3 | 66.7% (2/3) | 66.7% (2/3) |
| scam_refund | 3 | 100.0% (3/3) | 100.0% (3/3) |
| scam_credentials | 3 | 100.0% (3/3) | 100.0% (3/3) |
| scam_investment | 3 | 33.3% (1/3) | 33.3% (1/3) |
| scam_advance_fee | 3 | 66.7% (2/3) | 66.7% (2/3) |
| scam_remote_access | 3 | 100.0% (3/3) | 100.0% (3/3) |
| scam_secrecy_threat | 3 | 66.7% (2/3) | 66.7% (2/3) |
| legit_urgent | 4 | 100.0% (4/4) | 0.0% (0/4) |
| legit_refund | 3 | 100.0% (3/3) | 0.0% (0/3) |
| legit_familiar | 3 | 100.0% (3/3) | 0.0% (0/3) |
| legit_unusual_amount | 3 | 100.0% (3/3) | 0.0% (0/3) |
| legit_support | 3 | 100.0% (3/3) | 0.0% (0/3) |
| legit_deadline | 3 | 100.0% (3/3) | 0.0% (0/3) |
| adv_missing_details | 2 | 100.0% (2/2) | 0.0% (0/2) |
| adv_unfamiliar_legit | 2 | 100.0% (2/2) | 0.0% (0/2) |
| adv_conflicting | 2 | 50.0% (1/2) | 50.0% (1/2) |
| adv_user_quote | 2 | 50.0% (1/2) | 0.0% (0/2) |
| adv_malformed | 3 | 100.0% (3/3) | 66.7% (2/3) |
| adv_prompt_injection | 2 | 100.0% (2/2) | 100.0% (2/2) |
| adv_benign_lookalike | 3 | 100.0% (3/3) | 0.0% (0/3) |
| adv_novel_scam | 3 | 0.0% (0/3) | 0.0% (0/3) |

## Assessor comparison (test split)

| Assessor | Status | Recall | FPR | Precision | Quotes verbatim | Speaker correct | Quotes from user's text | Same verdict on repeat | Concrete action | Case-specific advice | Reproducible score breakdown |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sentinel-local | ran | 72.7% (24/33) | 0.0% (0/26) | 100.0% (24/24) | 100.0% (128/128) | 100.0% (128/128) | 0.0% (0/128) | 100.0% (62/62) | 100.0% (24/24) | 33.3% (8/24) | yes |
| keyword | ran | 69.7% (23/33) | 26.9% (7/26) | 76.7% (23/30) | 94.9% (37/39) | n/a (0/0) | 8.1% (3/37) | 100.0% (62/62) | 0.0% (0/31) | 0.0% (0/31) | no |

"Concrete action" and "case-specific advice" are keyword heuristics over recommendation text, not human judgements.

## Failures (test)

| Case | Split | Label | Score | Band | Problems |
|---|---|---|---|---|---|
| imp-04 | test | scam | 30 | caution | band; missing payment_request |
| inv-04 | test | scam | 19 | low | band |
| inv-06 | test | scam | 48 | caution | band |
| adv-04 | test | scam | 36 | caution | band; missing payment_request |
| thr-06 | test | scam | 24 | low | band; missing isolation,payment_request |
| ac-04 | test | ambiguous | 14 | low | band |
| aq-04 | test | scam | 22 | low | band |
| al-02 | test | scam | 82 | high | missing urgency |
| an-02 | test | scam | 11 | low | band |
| an-04 | test | scam | 4 | low | band |
| an-06 | test | scam | 11 | low | band |