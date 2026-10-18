import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeLocal } from "../src/lib/engine/analyze";
import { findAmounts, parseConversation, summariseParse } from "../src/lib/engine/parse";
import { ids, run, sig } from "./helpers";

describe("conversation parser", () => {
  it("separates labelled speakers and the user", () => {
    const m = parseConversation("Bank: hello\nYou: hi\nMe: also me\nBank: bye");
    assert.deepEqual(m.map((x) => x.role), ["counterparty", "user", "user", "counterparty"]);
  });

  it("does not treat field labels, URLs or times as speakers", () => {
    const m = parseConversation("Note: rent paid.\nUPI ID: landlord@okhdfc\nAmount: ₹22,000\nVisit https://example.com now\n12:30 meeting");
    assert.equal(m.length, 1);
    assert.equal(m[0].role, "unknown");
    assert.equal(m[0].labelled, false);
  });

  it("parses WhatsApp exports and bracketed timestamps", () => {
    const wa = parseConversation("12/10/26, 9:14 PM - Priya Advisor: hello\n12/10/26, 9:15 PM - You: hi");
    assert.deepEqual(wa.map((x) => [x.sender, x.role]), [["Priya Advisor", "counterparty"], ["You", "user"]]);
    const br = parseConversation("[10:32] SecureBank KYC: pay now\n[10:35] You: ok");
    assert.equal(br[0].sender, "SecureBank KYC");
  });

  it("marks duplicates and reported quotes", () => {
    const m = parseConversation('Bot: pay now\nBot: pay now\nYou: they said "share the OTP you received today"');
    assert.equal(m[1].duplicateOf, 0);
    const rep = m.find((x) => x.role === "reported");
    assert.ok(rep);
    assert.equal(rep!.text, "share the OTP you received today");
  });

  it("summarises unlabelled input as uncertain attribution", () => {
    const raw = "Your account will be blocked. Pay now.";
    const s = summariseParse(raw, parseConversation(raw));
    assert.equal(s.format, "unlabelled");
    assert.ok(s.warnings.some((w) => /cannot tell who wrote/.test(w)));
  });

  it("handles malformed input without crashing", () => {
    for (const raw of ["", "\n\n", ":::", ": : :", "You:", "x".repeat(20000), "a:b:c:d", "\u0000\u0001", "💸".repeat(100)]) {
      const r = analyzeLocal({ conversation: raw, source: "text" });
      assert.ok(r.riskScore >= 0 && r.riskScore <= 100);
    }
  });

  it("extracts rupee amounts in common formats", () => {
    assert.deepEqual(findAmounts("Pay ₹18,500 or Rs. 2,499 or INR 5000 or ₹1.5 lakh or 40,000 rupees"), [18500, 2499, 5000, 150000, 40000]);
  });
});

describe("detectors", () => {
  it("does not treat protective warnings as credential requests", () => {
    for (const t of [
      "Bank: We will never ask for your OTP.",
      "Bank: Do not share your OTP or PIN with anyone.",
      "Bank: 482913 is your OTP. Do not share this OTP with anyone.",
      "Meera: The pin code for the office is 560034.",
    ]) assert.ok(!ids(run(t)).has("credentials"), t);
  });

  it("detects explicit and paraphrased credential requests", () => {
    for (const t of [
      "Agent: Please share the OTP you received.",
      "Agent: Reply with the OTP to cancel it.",
      "Agent: Read out the code sent to your mobile.",
      "Agent: Install AnyDesk and tell me the code.",
      "Agent: Tell me the card number and CVV.",
    ]) assert.ok(ids(run(t)).has("credentials"), t);
  });

  it("treats 'if you do not pay' as a conditional ultimatum, not a negation", () => {
    assert.ok(ids(run("Bank: If you do not pay ₹5,000 today your account will be blocked.")).has("payment_request"));
  });

  it("does not read sentences describing scams as requests", () => {
    const r = run("Bank Newsletter: Scammers may say your account will be frozen and ask you to transfer money.");
    assert.ok(!ids(r).has("payment_request"));
    assert.ok(r.rejectedEvidence.some((x) => /describes what scammers do/.test(x.reason)));
  });

  it("a refund promise alone is not pay-to-receive", () => {
    assert.ok(!ids(run("Support: The extra ₹340 will be credited back to your wallet within 24 hours.")).has("reversal"));
    assert.ok(ids(run("Support: Send ₹340 to refund.desk@ybl. It will be credited back within 24 hours.")).has("reversal"));
  });
});

describe("account context", () => {
  const conv = "Ravi: Total is ₹2,800. My UPI is ravi.electric@okaxis.";
  it("without account history, never claims a recipient is new or an amount unusual", () => {
    const r = run(conv);
    assert.ok(!ids(r).has("new_beneficiary"));
    assert.ok(!ids(r).has("amount_anomaly"));
    assert.equal(r.context.mode, "none");
    assert.equal(r.context.recipientStatus, "unknown");
    assert.ok(r.decision.uncertainties.some((u) => /No account history/.test(u)));
  });

  it("labels synthetic demo context as synthetic", () => {
    const r = run(conv, { context: { mode: "demo" } });
    const nb = sig(r, "new_beneficiary");
    assert.ok(nb);
    assert.match(nb!.evidence[0].text, /synthetic demo profile/);
    assert.match(nb!.evidence[0].text, /not “known to be fraudulent”/);
    assert.ok(r.decision.uncertainties.some((u) => /synthetic demo profile/.test(u)));
  });

  it("uses user-supplied context and says it is unverified", () => {
    const r = run(conv, { context: { mode: "user", knownBeneficiaries: ["ravi.electric@okaxis"] } });
    assert.ok(ids(r).has("known_beneficiary"));
    assert.ok(r.decision.uncertainties.some((u) => /not verified/.test(u)));
  });

  it("an unfamiliar recipient is never described as a known scammer", () => {
    const r = run(conv, { context: { mode: "demo" } });
    const text = JSON.stringify(r.signals) + r.explanation + JSON.stringify(r.attackChain);
    assert.ok(!/known scam|confirmed fraud|is a scammer/i.test(text));
  });
});
