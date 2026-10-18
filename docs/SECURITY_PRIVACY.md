# Security and privacy

Sentinel processes potentially sensitive financial conversations. This describes what the prototype does, and what it does not. It holds no certification and makes no regulatory-compliance claim.

## Data flows

| Data | Where it goes | Retention |
|---|---|---|
| Conversation / payment details (local mode) | Browser → Sentinel server `/api/analyze` → response | Not stored server-side; not logged |
| Same, AI mode (`ANTHROPIC_API_KEY` set) | Additionally sent to the Anthropic API for signal extraction | Subject to the provider's terms; Sentinel stores nothing |
| Screenshots | `/api/ocr` → Anthropic API (AI mode only). SVG samples are parsed in the browser | Not stored |
| Scan history, Circle requests, feedback | Browser `localStorage` only | User scans dropped after 7 days; "Clear history" removes all |
| `/api/v1/decision` | Local engine only, never an external provider | Not stored |

The scan page states which of these applies before the user submits.

## Safeguards implemented

- **Secrets**: the API key is read only in server code (`src/lib/ai/provider.ts` imports `server-only`); `/api/status` exposes only whether AI is on, the model name and engine versions. A test checks analysis output never contains environment secrets.
- **Input validation** (`src/lib/api/validate.ts`, zod): body-size limits checked on declared and actual size (64 KB analyze, 7 MB OCR); conversation ≤ 20,000 chars; typed, bounded payment and context fields. Errors never echo submitted content.
- **Images**: only PNG/JPEG/GIF/WEBP data URLs, ≤ 5 MB decoded, magic bytes must match the declared type; SVG is never sent to the server.
- **Rate limiting**: in-memory token bucket per client address (analyze 30/min, OCR 6/min, decision 60/min). Single-instance only.
- **Logging**: only error class names are logged — never conversations, quotes or provider error bodies.
- **Prompt injection**: submitted text is framed as untrusted data; the system prompt forbids following embedded instructions or emitting secrets; tag-like sequences (`</conversation>`, `<system>`) are neutralised; LLM output is only accepted as quotes that must ground verbatim in non-user messages, and only the deterministic engine scores. OCR output re-enters the same pipeline as untrusted text. Regression tests cover these.
- **Headers**: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`; `Cache-Control: no-store` on all API responses.

## Known gaps

- No authentication: every endpoint is public. Acceptable for a demo; not for real use.
- No Content-Security-Policy (Next.js inline scripts would need nonces).
- Rate limits are per process and trust `X-Forwarded-For`, which a client can spoof without a trusted proxy.
- `localStorage` is unencrypted and readable by any script on the origin.
- No data-processing agreement, consent flow or deletion API for the AI-provider path.
- `npm audit` reports advisories in transitive dev/build dependencies; not triaged.
