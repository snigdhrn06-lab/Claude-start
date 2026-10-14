import assert from "node:assert/strict";
import { detectLocal } from "../src/lib/engine/detect";
import { scoreSignals } from "../src/lib/engine/score";

// User-authored text must not be treated as an inbound scam request.
const userOnly = detectLocal("You: Please share your OTP immediately.");
assert.equal(userOnly.signals.some((signal) => signal.id === "credentials"), false);

// The same request from the other party should be detected.
const inbound = detectLocal("Unknown sender: Please share your OTP immediately.");
assert.equal(inbound.signals.some((signal) => signal.id === "credentials"), true);

// Recipient risk must participate in the composite score, not only appear in the UI.
const recipientOnly = scoreSignals([
  { id: "new_beneficiary", confidence: 0.9, evidence: [] },
]);
assert.ok(recipientOnly.dims.recipient > 0, "recipient dimension should be non-zero");
assert.ok(recipientOnly.riskScore > 0, "recipient-only risk should affect the composite score");

console.log("Sentinel validation checks passed.");
