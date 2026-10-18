import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResult } from "../src/lib/engine/analyze";
import { detectLocal } from "../src/lib/engine/detect";
import { MODEL_ONLY_CAP, groundQuotes, validateEntities, validateSignals } from "../src/lib/engine/grounding";
import { locateQuote, parseConversation } from "../src/lib/engine/parse";
import { ids, run, sig } from "./helpers";

const CONV = [
  "Bank Desk: Your account will be frozen today.",
  "You: I will transfer immediately, please don't block it.",
  "Bank Desk: Send ₹4,000 to desk.kyc@ybl now.",
].join("\n");

describe("evidence grounding and attribution", () => {
  it("every quote equals the input at its offsets and names its speaker", () => {
    const r = run(CONV);
    for (const s of r.signals)
      for (const e of s.evidence) {
        if (e.kind === "context") continue;
        assert.equal(CONV.slice(e.start, e.end), e.text);
        assert.equal(typeof e.messageIndex, "number");
        assert.ok(e.speaker);
      }
  });

  it("never uses the user's own words as evidence against the other party", () => {
    const r = run(CONV);
    for (const s of r.signals) for (const e of s.evidence) assert.notEqual(e.speakerRole, "user", `${s.id} used user text: ${e.text}`);
    // The user's "transfer immediately" must not create urgency evidence.
    assert.ok(!sig(r, "urgency")?.evidence.some((e) => /transfer immediately/.test(e.text)));
  });

  it("rejects fabricated LLM quotes and quotes found only in user messages", () => {
    const msgs = parseConversation(CONV);
    const fabricated = groundQuotes(CONV, msgs, "threat", ["your account will be closed by the RBI"]);
    assert.equal(fabricated.evidence.length, 0);
    assert.match(fabricated.rejected[0].reason, /not found verbatim/);
    const userOnly = groundQuotes(CONV, msgs, "urgency", ["I will transfer immediately"]);
    assert.equal(userOnly.evidence.length, 0);
    assert.match(userOnly.rejected[0].reason, /user's own/);
  });

  it("tolerates case/whitespace/curly-quote differences but not paraphrase", () => {
    const msgs = parseConversation(CONV);
    assert.equal(locateQuote(CONV, msgs, "send  ₹4,000 TO desk.kyc@ybl").length, 1);
    assert.equal(locateQuote(CONV, msgs, "send four thousand rupees").length, 0);
  });

  it("drops evidence whose offsets do not match the text, and caps model-only evidence", () => {
    const d = detectLocal(CONV);
    const tampered = d.signals.map((s) => ({ ...s, evidence: s.evidence.map((e) => (e.kind === "context" ? e : { ...e, text: e.text + " (edited)" })) }));
    const v = validateSignals(CONV, d.messages, tampered);
    assert.ok(v.rejected.length > 0);
    assert.ok(v.signals.every((s) => s.evidence.every((e) => e.kind === "context")));

    const msgs = d.messages;
    const g = groundQuotes(CONV, msgs, "isolation", ["Your account will be frozen today."]);
    const v2 = validateSignals(CONV, msgs, [{ id: "isolation", confidence: 0.95, evidence: g.evidence }]);
    assert.equal(v2.signals[0].evidence[0].support, "model-only");
    assert.ok(v2.signals[0].confidence <= MODEL_ONLY_CAP);
  });

  it("an LLM-style pipeline cannot inject a signal supported only by user text", () => {
    const d = detectLocal(CONV);
    const userEv = locateQuote(CONV, d.messages, "please don't block it")[0];
    const r = buildResult({ conversation: CONV, source: "text" }, { ...d, signals: [...d.signals, { id: "isolation", confidence: 0.9, evidence: [userEv] }] }, { engine: "llm" });
    assert.ok(!ids(r).has("isolation"));
    assert.ok(r.rejectedEvidence.some((x) => /user's own message/.test(x.reason)));
  });
});

describe("entity validation", () => {
  it("keeps grounded entities and rejects invented ones", () => {
    const msgs = parseConversation(CONV);
    const v = validateEntities(
      [
        { type: "recipient", value: "desk.kyc@ybl" },
        { type: "amount", value: "₹4,000" },
        { type: "phone", value: "9999988888" },
        { type: "organization", value: "Reserve Bank of India" },
      ],
      CONV,
      msgs,
    );
    assert.deepEqual(v.entities.map((e) => e.value), ["desk.kyc@ybl", "₹4,000"]);
    assert.equal(v.rejected.length, 2);
  });

  it("does not label an entity fraudulent; flags only mean 'supplied by the other party'", () => {
    const r = run(CONV);
    for (const e of r.extractedEntities) assert.ok(!/fraud|scam/i.test(e.note ?? ""), e.note);
    const handle = r.extractedEntities.find((e) => e.value === "desk.kyc@ybl");
    assert.ok(handle?.flagged);
    assert.match(handle!.note!, /unverified|Not in/i);
  });
});
