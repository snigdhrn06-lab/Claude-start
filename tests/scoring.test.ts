import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DetectedSignal } from "../src/lib/engine/detect";
import { POLICY, bandFor, scoreSignals } from "../src/lib/engine/score";
import type { Evidence, SignalId } from "../src/lib/types";
import { run } from "./helpers";

const ev = (text = "x"): Evidence => ({ text, start: 0, end: text.length, source: "conversation", kind: "quote", speakerRole: "counterparty", attribution: "attributed", support: "pattern" });
const S = (id: SignalId, confidence: number): DetectedSignal => ({ id, confidence, evidence: [ev(id)] });

describe("scoring policy", () => {
  it("recipient risk contributes to the overall score", () => {
    const base = [S("payment_request", 0.9), S("urgency", 0.85)];
    const withRecipient = [...base, S("new_beneficiary", 0.86), S("unofficial_channel", 0.8)];
    const a = scoreSignals(base);
    const b = scoreSignals(withRecipient);
    assert.ok(b.trace.logit > a.trace.logit, "recipient evidence must raise the logit");
    assert.ok(b.riskScore > a.riskScore);
    assert.ok(b.trace.terms.some((t) => t.label === "Recipient evidence" && t.points > 0));
    assert.ok(POLICY.dimPoints.recipient > 0);
  });

  it("score trace terms sum exactly to the logit, and the score follows from it", () => {
    const r = scoreSignals([S("authority", 0.87), S("threat", 0.9), S("payment_request", 0.9), S("verification", 0.8)]);
    const sum = Math.round(r.trace.terms.reduce((a, t) => a + t.points, 0) * 100) / 100;
    assert.equal(sum, r.trace.logit);
    assert.equal(r.trace.rawScore, Math.min(99, Math.max(1, Math.round(100 / (1 + Math.exp(-r.trace.logit))))));
    assert.equal(r.riskScore, Math.max(r.trace.rawScore, r.trace.floorApplied?.floor ?? 0));
  });

  it("identical structured signals give identical scores", () => {
    const sigs = [S("authority", 0.8), S("urgency", 0.7), S("payment_request", 0.9), S("new_beneficiary", 0.86)];
    const a = scoreSignals(sigs);
    const b = scoreSignals(sigs.map((s) => ({ ...s, evidence: [...s.evidence] })));
    assert.deepEqual(a, b);
  });

  it("a single weak signal does not dominate", () => {
    for (const id of ["urgency", "emotional", "authority", "social_proof", "scarcity"] as SignalId[]) {
      const r = scoreSignals([S(id, 0.7)]);
      assert.ok(r.riskScore < POLICY.bands.elevated, `${id} alone scored ${r.riskScore}`);
    }
  });

  it("a suspicious conversation without any ask scores lower than the same with an ask", () => {
    const noAsk = scoreSignals([S("authority", 0.85), S("threat", 0.9), S("urgency", 0.9)]);
    const ask = scoreSignals([S("authority", 0.85), S("threat", 0.9), S("urgency", 0.9), S("payment_request", 0.9)]);
    assert.ok(noAsk.trace.terms.some((t) => t.kind === "gate"));
    assert.ok(ask.riskScore > noAsk.riskScore + 20);
  });

  it("mitigations cannot remove more than the policy share of the risk evidence", () => {
    const sigs = [S("payment_request", 0.9), S("urgency", 0.9), S("new_beneficiary", 0.86), S("verification", 0.95), S("known_beneficiary", 0.95)];
    const r = scoreSignals(sigs);
    const positive = r.trace.terms.filter((t) => t.kind !== "baseline" && t.kind !== "mitigation" && t.kind !== "floor").reduce((a, t) => a + t.points, 0);
    const mitigation = -r.trace.terms.filter((t) => t.kind === "mitigation").reduce((a, t) => a + t.points, 0);
    assert.ok(mitigation <= positive * POLICY.mitigation.maxShare + 0.02, `mitigation ${mitigation} > ${positive * POLICY.mitigation.maxShare}`);
  });

  it("a saved recipient does not neutralise a credential request", () => {
    const r = scoreSignals([S("credentials", 0.92), S("known_beneficiary", 0.9)]);
    assert.ok(r.riskScore >= 80);
    assert.ok(r.trace.floorApplied);
  });

  it("floors require pattern-supported evidence, never model-only assertions", () => {
    const modelOnly: DetectedSignal = { id: "credentials", confidence: 0.9, evidence: [{ ...ev("give me the thing"), support: "model-only" }] };
    const r = scoreSignals([modelOnly]);
    assert.equal(r.trace.floorApplied, undefined);
  });

  it("bands are monotonic in the score", () => {
    const order = ["low", "caution", "elevated", "high"];
    let prev = 0;
    for (let s = 0; s <= 100; s++) {
      const i = order.indexOf(bandFor(s));
      assert.ok(i >= prev);
      prev = i;
    }
  });

  it("the score is bounded below 100 and never presented as a probability", () => {
    const r = run(["Bank KYC Desk: Your account will be frozen in 10 minutes. Share the OTP and transfer ₹50,000 to kyc.verify@ybl immediately. Don't tell anyone."]);
    assert.ok(r.riskScore <= 99);
    assert.ok(!/probab/i.test(r.headline + r.explanation + r.decision.summary));
  });
});
