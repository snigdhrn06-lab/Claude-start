# Sentinel benchmark results

Generated 2026-10-18T20:44:25.369Z · dataset v1.0.0 · engine v2.0.0 · policy v2.0.0 · catalog v2.0.0

Cases: 124 (66 scam, 53 legitimate, 5 ambiguous). Synthetic, author-written; see docs/EVALUATION.md for limitations. Not an estimate of real-world performance.

## Sentinel (local engine)

| Metric | dev | test | all |
|---|---|---|---|
| Cases | 62 | 62 | 124 |
| Recall @ elevated+ | 93.9% (31/33) | 90.9% (30/33) | 92.4% (61/66) |
| Precision @ elevated+ | 100.0% (31/31) | 100.0% (30/30) | 100.0% (61/61) |
| F1 @ elevated+ | 0.969 | 0.952 | 0.960 |
| False-positive rate @ elevated+ | 0.0% (0/27) | 0.0% (0/26) | 0.0% (0/53) |
| False-negative rate @ elevated+ | 6.1% (2/33) | 9.1% (3/33) | 7.6% (5/66) |
| Recall @ high | 78.8% (26/33) | 81.8% (27/33) | 80.3% (53/66) |
| False-positive rate @ high | 0.0% (0/27) | 0.0% (0/26) | 0.0% (0/53) |
| Band matches expectation | 98.4% (61/62) | 93.5% (58/62) | 96.0% (119/124) |
| Required signals detected | 100.0% (73/73) | 98.5% (65/66) | 99.3% (138/139) |
| Forbidden signals raised | 0.0% (0/43) | 0.0% (0/43) | 0.0% (0/86) |
| Quote integrity (text == input[start:end]) | 100.0% (165/165) | 100.0% (144/144) | 100.0% (309/309) |
| Annotated evidence found | 100.0% (6/6) | 100.0% (1/1) | 100.0% (7/7) |
| Speaker attribution accuracy (annotated) | 100.0% (6/6) | 100.0% (1/1) | 100.0% (7/7) |
| Risk evidence quoted from user's own text | 0 | 0 | 0 |
| Entity grounding precision | 99.4% (160/161) | 99.3% (149/150) | 99.4% (309/311) |
| Annotated entity recall | 100.0% (4/4) | 100.0% (2/2) | 100.0% (6/6) |
| Deterministic repeatability (3 runs) | 100.0% (62/62) | 100.0% (62/62) | 100.0% (124/124) |
| Score trace reproduces score | 100.0% (62/62) | 100.0% (62/62) | 100.0% (124/124) |
| Legit urgent payments flagged | 0.0% (0/4) | 0.0% (0/4) | 0.0% (0/8) |

### By category (all)

| Category | n | Band matches | Flagged (elevated+) |
|---|---|---|---|
| scam_kyc | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_impersonation | 6 | 100.0% (6/6) | 83.3% (5/6) |
| scam_refund | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_credentials | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_investment | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_advance_fee | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_remote_access | 6 | 100.0% (6/6) | 100.0% (6/6) |
| scam_secrecy_threat | 6 | 100.0% (6/6) | 100.0% (6/6) |
| legit_urgent | 8 | 100.0% (8/8) | 0.0% (0/8) |
| legit_refund | 6 | 100.0% (6/6) | 0.0% (0/6) |
| legit_familiar | 6 | 100.0% (6/6) | 0.0% (0/6) |
| legit_unusual_amount | 6 | 100.0% (6/6) | 0.0% (0/6) |
| legit_support | 6 | 100.0% (6/6) | 0.0% (0/6) |
| legit_deadline | 6 | 100.0% (6/6) | 0.0% (0/6) |
| adv_missing_details | 4 | 100.0% (4/4) | 25.0% (1/4) |
| adv_unfamiliar_legit | 4 | 100.0% (4/4) | 0.0% (0/4) |
| adv_conflicting | 4 | 75.0% (3/4) | 50.0% (2/4) |
| adv_user_quote | 4 | 100.0% (4/4) | 50.0% (2/4) |
| adv_malformed | 6 | 100.0% (6/6) | 66.7% (4/6) |
| adv_prompt_injection | 4 | 100.0% (4/4) | 75.0% (3/4) |
| adv_benign_lookalike | 6 | 100.0% (6/6) | 0.0% (0/6) |
| adv_novel_scam | 6 | 33.3% (2/6) | 33.3% (2/6) |

### Threshold sweep (dev split, scam vs legitimate)

| Score ≥ | Recall | FPR | Precision | F1 |
|---|---|---|---|---|
| 20 | 0.970 | 0.074 | 0.941 | 0.955 |
| 25 | 0.970 | 0.000 | 1.000 | 0.985 |
| 30 | 0.939 | 0.000 | 1.000 | 0.969 |
| 35 | 0.939 | 0.000 | 1.000 | 0.969 |
| 40 | 0.939 | 0.000 | 1.000 | 0.969 |
| 45 | 0.939 | 0.000 | 1.000 | 0.969 |
| 50 | 0.939 | 0.000 | 1.000 | 0.969 |
| 55 | 0.939 | 0.000 | 1.000 | 0.969 |
| 60 | 0.848 | 0.000 | 1.000 | 0.918 |
| 65 | 0.818 | 0.000 | 1.000 | 0.900 |
| 70 | 0.788 | 0.000 | 1.000 | 0.881 |
| 75 | 0.788 | 0.000 | 1.000 | 0.881 |
| 80 | 0.697 | 0.000 | 1.000 | 0.821 |
| 85 | 0.394 | 0.000 | 1.000 | 0.565 |
| 90 | 0.303 | 0.000 | 1.000 | 0.465 |

## Assessor comparison (all split)

| Assessor | Status | Recall | FPR | Precision | Quotes verbatim | Speaker correct | Quotes from user's text | Same verdict on repeat | Concrete action | Case-specific advice | Reproducible score breakdown |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sentinel-local | ran | 92.4% (61/66) | 0.0% (0/53) | 100.0% (61/61) | 100.0% (291/291) | 100.0% (291/291) | 0.0% (0/291) | 100.0% (124/124) | 100.0% (61/61) | 29.5% (18/61) | yes |
| keyword | ran | 69.7% (46/66) | 34.0% (18/53) | 71.9% (46/64) | 96.5% (83/86) | n/a (0/0) | 6.0% (5/83) | 100.0% (124/124) | 0.0% (0/65) | 0.0% (0/65) | no |

"Concrete action" and "case-specific advice" are keyword heuristics over recommendation text, not human judgements.

## Failures (all)

| Case | Split | Label | Score | Band | Problems |
|---|---|---|---|---|---|
| thr-06 | test | scam | 95 | high | missing isolation |
| ac-04 | test | ambiguous | 14 | low | band |
| an-02 | test | scam | 11 | low | band |
| an-03 | dev | scam | 12 | low | band |
| an-04 | test | scam | 4 | low | band |
| an-06 | test | scam | 11 | low | band |