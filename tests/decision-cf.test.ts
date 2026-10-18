import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeLocal } from "../src/lib/engine/analyze";
import { applyEdits, compareAnalyses } from "../src/lib/engine/counterfactual";
import { toDecisionRecord } from "../src/lib/engine/record";
import { SCENARIOS, getScenario, scenarioInput } from "../src/lib/scenarios";
import { run } from "./helpers";

describe("decision and recommendations", () => {
  it("recommendations are tied to the signals that triggered them", () => {
    const r = run(["Agent: This is the KYC desk. Share the OTP you received."]);
    const otp = r.recommendedActions.find((a) => a.id === "no-secrets");
    assert.ok(otp?.because?.includes("credentials"));
    for (const a of r.recommendedActions) for (const b of a.because ?? []) assert.ok(r.signals.some((s) => s.id === b), `${a.id} cites absent ${b}`);
  });

  it("recommendations differ with the evidence", () => {
    const a = run(["Agent: Share the OTP you received."]).recommendedActions.map((x) => x.id);
    const b = run(["Seller: Scan this QR and enter your UPI PIN to receive ₹12,000."]).recommendedActions.map((x) => x.id);
    assert.notDeepEqual(a, b);
  });

  it("never invents phone numbers or websites beyond the documented public helpline", () => {
    const all = SCENARIOS.map((s) => analyzeLocal(scenarioInput(s)));
    for (const r of all) {
      const text = JSON.stringify([r.recommendedActions, r.decision, r.explanation]);
      const phones = text.match(/\b\d{4,}\b/g) ?? [];
      for (const p of phones) assert.ok(p === "1930" || r.input.conversation.includes(p) || JSON.stringify(r.input.payment ?? {}).includes(p), `unexpected number ${p}`);
      const sites = text.match(/\b[a-z0-9-]+\.(?:com|in|gov\.in|org|net)\b/gi) ?? [];
      for (const s of sites) assert.ok(s === "cybercrime.gov.in" || r.input.conversation.includes(s), `unexpected site ${s}`);
    }
  });

  it("legitimate urgent payment to a saved recipient is not escalated", () => {
    const r = analyzeLocal(scenarioInput(getScenario("medical")!));
    assert.ok(r.band === "low" || r.band === "caution", `medical band ${r.band}`);
    assert.notEqual(r.decision.action, "stop");
  });

  it("reports insufficient evidence instead of inventing context", () => {
    const r = analyzeLocal({ conversation: "", payment: { recipient: "someone@okaxis", amount: 15000, method: "UPI", reason: "" }, source: "payment" });
    assert.equal(r.decision.insufficientEvidence, true);
    assert.equal(r.classification, "Insufficient Evidence");
    assert.notEqual(r.decision.action, "proceed");
  });

  it("the decision workflow answers the five questions", () => {
    const r = analyzeLocal(scenarioInput(getScenario("kyc")!));
    assert.equal(r.decision.workflow.length, 5);
    assert.equal(r.decision.action, "stop");
  });

  it("attack chain separates observed, inferred and hypothetical stages", () => {
    const r = analyzeLocal(scenarioInput(getScenario("kyc")!));
    const impact = r.attackChain.find((n) => n.stage === "impact");
    assert.equal(impact?.status, "hypothetical");
    for (const n of r.attackChain.filter((n) => n.status === "observed")) assert.ok(n.evidence.some((e) => e.kind !== "context"));
    assert.ok(!r.attackChain.some((n) => /scammer/i.test(n.label)));
  });

  it("the decision record is versioned and excludes the raw conversation", () => {
    const r = analyzeLocal(scenarioInput(getScenario("kyc")!));
    const rec = toDecisionRecord(r);
    assert.equal(rec.schema, "sentinel.decision/v1");
    assert.ok(rec.provenance.policyVersion && rec.provenance.inputHash);
    assert.ok(!JSON.stringify(rec).includes(r.input.conversation));
  });
});

describe("counterfactuals", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: every preset applies cleanly`, () => {
      for (const p of s.counterfactuals) assert.deepEqual(applyEdits(scenarioInput(s, false), p.edits).missing, [], `${s.id}/${p.id}`);
    });
  }

  it("adding a credential request never lowers risk", () => {
    const s = getScenario("kyc")!;
    const base = scenarioInput(s, false);
    const before = analyzeLocal(base);
    const after = analyzeLocal(applyEdits(base, s.counterfactuals.find((p) => p.id === "otp")!.edits).input);
    const c = compareAnalyses(before, after);
    assert.ok(c.delta >= 0);
    assert.ok(c.changes.some((x) => x.kind === "added" && x.signalId === "credentials"));
  });

  it("a saved recipient offsets only part of an impersonation pattern", () => {
    const s = getScenario("kyc")!;
    const base = scenarioInput(s, false);
    const after = analyzeLocal(applyEdits(base, s.counterfactuals.find((p) => p.id === "saved")!.edits).input);
    assert.equal(after.band, "high");
    assert.ok(after.recipientRisk < analyzeLocal(base).recipientRisk);
  });

  it("the same request from a 'new number' raises risk on the legitimate scenario", () => {
    const s = getScenario("medical")!;
    const base = scenarioInput(s, false);
    const before = analyzeLocal(base);
    const after = analyzeLocal(applyEdits(base, s.counterfactuals.find((p) => p.id === "new-number")!.edits).input);
    const c = compareAnalyses(before, after);
    assert.ok(c.delta > 20);
    assert.ok(c.actionChanged);
  });

  it("reports term-level reasons and always states its limits", () => {
    const s = getScenario("refund")!;
    const base = scenarioInput(s, false);
    const c = compareAnalyses(analyzeLocal(base), analyzeLocal(applyEdits(base, s.counterfactuals[2].edits).input));
    assert.ok(c.reasons.length > 0);
    assert.ok(c.limitations.some((l) => /does not establish whether/.test(l)));
  });

  it("an edit no detector responds to is reported as such, not as proof of irrelevance", () => {
    const base = { conversation: "Bank: Your account will be frozen. Transfer ₹5,000 now.", source: "text" as const };
    const after = { ...base, conversation: base.conversation.replace("Bank:", "Bank: Good morning.") };
    const c = compareAnalyses(analyzeLocal(base), analyzeLocal(after));
    assert.ok(c.limitations.some((l) => /No detector responded/.test(l)));
  });
});
