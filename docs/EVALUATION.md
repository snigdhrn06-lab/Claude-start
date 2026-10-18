# Evaluation

Reproduce: `npm run bench` (offline) · `npm run bench:live` (needs `ANTHROPIC_API_KEY`). Results: `bench/results/latest.md` / `.json`; first held-out run: `bench/results/first-heldout-test.md`.

## Dataset (`bench/dataset.ts`, v1.0.0)

124 synthetic cases: 66 scam, 53 legitimate, 5 ambiguous, in 22 categories.

- **Scams (48):** fake KYC, bank/government impersonation, refund/reversal, OTP/credential requests, guaranteed-return investment, advance fee, remote access, secrecy/threats.
- **Legitimate look-alikes (38):** urgent rent/medical/fees, genuine refunds, saved recipients, unusually large amounts, support messages that recommend verification, real deadlines.
- **Ambiguous/adversarial (38):** missing payment details, unfamiliar-but-legitimate recipients, conflicting signals, user-quoted scams, malformed/unlabelled/WhatsApp-export input, prompt injection, benign keyword look-alikes, and novel scam wording deliberately outside existing patterns.

Each case has a ground-truth label, the acceptable risk bands, required and forbidden signals, and for a subset annotated evidence (quote + speaker) and entities. Names, handles and numbers are fictional. The demo scenarios are not in the dataset.

**Split.** Within each category, cases alternate dev/test in authoring order. Detectors and policy were tuned looking only at dev failures until the first test evaluation.

## Metrics

Binary metrics compare scam vs legitimate cases (ambiguous excluded), with "flagged" = band elevated or high (also reported at high only). Ratios carry explicit numerators and denominators; a zero denominator is reported as n/a.

| Metric | Meaning | Limitation |
|---|---|---|
| Recall / precision / F1 / FPR / FNR | Detection quality | Synthetic prevalence (53% scams) is not real-world prevalence; precision would be far lower at realistic base rates |
| Band matches expectation | Band within the annotated acceptable bands | Bands are author judgements |
| Required / forbidden signals | Specific detector behaviour | Author-chosen |
| Quote integrity | Evidence text equals `input[start:end]` | Textual grounding only, not semantic correctness |
| Speaker attribution (annotated) | Evidence attributed to the annotated speaker | Only 7 annotated items |
| User-text leaks | Risk evidence taken from the user's own messages | — |
| Entity grounding precision | Entities that occur in the input | Does not measure usefulness |
| Determinism / trace consistency | Identical output over repeats; trace reproduces score | Local engine only |
| Legit urgent flag rate | Genuine urgent payments flagged | 8 cases |

## Results (local engine, engine/policy/catalog 2.0.0)

| | Dev (tuned on) | **Test, first held-out run** | Test, current | All, current |
|---|---|---|---|---|
| Recall @ elevated+ | 93.9% (31/33) | **72.7% (24/33)** | 90.9% (30/33) | 92.4% (61/66) |
| Precision @ elevated+ | 100% (31/31) | **100% (24/24)** | 100% (30/30) | 100% (61/61) |
| FPR @ elevated+ | 0% (0/27) | **0% (0/26)** | 0% (0/26) | 0% (0/53) |
| Recall @ high | 78.8% | **63.6%** | 81.8% | 80.3% |

Also, on all 124 cases: quote integrity 100% (309/309), 0 risk quotes from user text, annotated speaker attribution 100% (7/7), entity grounding 99.4%, determinism 100%, 0/8 legitimate urgent payments flagged.

**The first held-out number (72.7% recall) is the honest generalisation estimate.** That run exposed general detector gaps (amounts not adjacent to the verb, "to the … account" destinations, `in next N minutes`, escalation not counted as an ask, a floor-threshold interaction with quoted text). Those were fixed generically, which is why the current test row is labelled "seen" and is no longer an unbiased estimate. No case-specific rules were added, and no expected labels were changed to make cases pass.

Remaining misses (current): 4 of 6 novel-wording scams (amount in words, fake-job laptop purchase, crypto referral top-up, stranded-traveller "12k") and one ambiguous rental-deposit case. These are the core weakness of pattern detection.

## Baseline comparison

`bench/baselines.ts` runs every assessor on the same cases with the same information (conversation, payment fields, account context rendered as text).

| Assessor | Recall | FPR | Quotes from user's text | Reproducible score breakdown |
|---|---|---|---|---|
| sentinel-local | 92.4% | 0.0% | 0% | yes |
| keyword (flags any alarming word, anywhere) | 69.7% | 34.0% | 6.0% | no |
| generic-llm | **not run** | | | |
| sentinel-llm | **not run** | | | |

The keyword baseline shows what structure (speaker attribution, negation, the ask gate, context) adds over keyword matching; it is not a stand-in for an LLM. The **generic-LLM comparison has not been run**: no API key was available when these results were produced. The harness is implemented — a neutral prompt asking a general assistant to assess the conversation, quote evidence with speakers and recommend actions — and measures recall/FPR, verbatim grounding, speaker attribution, quotes from user text, verdict consistency across `--repeats`, two keyword heuristics for actionability, and whether a reproducible score breakdown exists. Run `npm run bench:live -- --repeats=3`; the output records the model id, dataset and engine versions. Until then, no claim is made that Sentinel outperforms a general LLM.

## What this does not show

- Real-world accuracy, prevalence or user outcomes.
- Robustness to adversaries who adapt to the patterns.
- Performance on languages other than English/Indian English, or on code-mixed Hindi/English.
- Whether recommendations change user behaviour.
