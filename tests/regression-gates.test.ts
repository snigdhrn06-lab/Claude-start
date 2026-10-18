/**
 * Regression gates over the synthetic benchmark. Thresholds sit below the
 * current measured values (see bench/results/latest.md) so that a material
 * regression fails CI; they are not targets to tune toward.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toInput } from "../bench/baselines";
import { CASES } from "../bench/dataset";
import { evaluateSentinel } from "../bench/metrics";
import { analyzeLocal } from "../src/lib/engine/analyze";
import { getScenario, scenarioInput } from "../src/lib/scenarios";

const runs = CASES.map((c) => [analyzeLocal(toInput(c)), analyzeLocal(toInput(c))]);
const report = evaluateSentinel(CASES, runs);

describe("benchmark regression gates", () => {
  it("recall on scam cases (elevated or high) stays ≥ 85%", () => {
    assert.ok((report.binaryAtElevated.recall.value ?? 0) >= 0.85, JSON.stringify(report.binaryAtElevated.recall));
  });
  it("false-positive rate on legitimate cases stays ≤ 5%", () => {
    assert.ok((report.binaryAtElevated.fpr.value ?? 1) <= 0.05, JSON.stringify(report.binaryAtElevated.fpr));
  });
  it("no legitimate urgent payment is flagged", () => {
    assert.equal(report.legitUrgentFlagRate.num, 0);
  });
  it("every credential-theft case is high risk", () => {
    for (const o of report.outcomes.filter((o) => o.category === "scam_credentials" || o.category === "scam_remote_access")) assert.equal(o.band, "high", o.id);
  });
  it("quotes are always verbatim and never taken from the user's own messages", () => {
    assert.equal(report.quoteIntegrity.value, 1);
    assert.equal(report.userAuthoredEvidenceLeaks, 0);
  });
  it("results are deterministic and the trace reproduces the score", () => {
    assert.equal(report.deterministicRepeatability.value, 1);
    assert.equal(report.traceConsistency.value, 1);
  });
  it("forbidden signals stay rare (≤ 3%)", () => {
    assert.ok((report.forbiddenSignalViolations.value ?? 0) <= 0.03);
  });
});

describe("demo scenario regressions", () => {
  it("KYC impersonation is a stop with recipient risk in the score", () => {
    const r = analyzeLocal(scenarioInput(getScenario("kyc")!));
    assert.equal(r.decision.action, "stop");
    assert.ok(r.recipientRisk > 0);
    assert.ok(r.scoreTrace.terms.some((t) => t.label === "Recipient evidence" && t.points > 0));
  });
  it("investment and refund scams are high", () => {
    for (const id of ["investment", "refund"]) assert.equal(analyzeLocal(scenarioInput(getScenario(id)!)).band, "high", id);
  });
  it("the legitimate hospital deposit is not flagged", () => {
    const r = analyzeLocal(scenarioInput(getScenario("medical")!));
    assert.ok(!["elevated", "high"].includes(r.band));
  });
});
