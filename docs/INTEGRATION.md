# Integration with a payment provider (not implemented)

Sentinel today is a standalone prototype. It has **no** connection to any bank, UPI app, NPCI service or payment rail, and cannot hold or block a transaction. This note describes what a real integration would need, so the gap is explicit.

## What exists

- `POST /api/v1/decision` — takes a `ScanInput` (conversation, optional payment fields, optional account context) and returns a `sentinel.decision/v1` record: score, band, action, reasons with evidence offsets, full score trace, uncertainties, recommendations, and provenance (engine/policy/catalog versions, input fingerprint). It uses only the deterministic local engine, so a given input always yields the same record. It stores nothing.
- `AccountContextProvider` (`src/lib/engine/context.ts`) — the seam where a partner's beneficiary history and typical payment amounts would plug in without changing detection or scoring.

## What a real integration needs

1. **A partner and a placement.** A bank or payment app that calls Sentinel before authorisation (e.g. on "new payee + amount above threshold", or when the user opts to check a conversation). Sentinel itself cannot see payments.
2. **Consent and data access.** Explicit user consent to share the conversation; account history via an authorised mechanism (e.g. the account-aggregator consent framework in India), never scraped.
3. **Authentication and transport.** Partner authentication (mTLS or signed requests), per-partner rate limits, audit logging of decision records (not raw conversations).
4. **The hold itself is the partner's.** Any delay, cooling-off period or step-up verification must be implemented by the payment provider under its own policies and regulatory obligations. Sentinel would only recommend.
5. **Calibration on real outcomes.** Labelled outcomes (confirmed fraud reports, disputes) to calibrate thresholds and measure precision at real base rates, plus monitoring for drift and adversarial adaptation.
6. **Legal and compliance review** of data processing, retention, liability for recommendations, and accessibility/language coverage. None has been done.
