import type {
  ContextSummary,
  Decision,
  DecisionAction,
  DecisionStep,
  Evidence,
  ParseSummary,
  RecommendedAction,
  RiskBand,
  SignalId,
} from "../types";
import { SIGNALS } from "./catalog";
import type { DetectedSignal } from "./detect";
import { formatINR } from "./parse";

/**
 * Decision layer: turns a score and its evidence into a proportionate action
 * and a structured verification workflow. Recommendations are tied to the
 * signals that triggered them; nothing here invents contact numbers, websites
 * or policies.
 */

const ACTION_FOR_BAND: Record<RiskBand, DecisionAction> = {
  low: "proceed",
  caution: "proceed_with_care",
  elevated: "verify_first",
  high: "stop",
};
const ACTION_RANK: Record<DecisionAction, number> = { proceed: 0, proceed_with_care: 1, verify_first: 2, stop: 3 };

export const ACTION_LABEL: Record<DecisionAction, string> = {
  proceed: "No significant concern",
  proceed_with_care: "Proceed with care",
  verify_first: "Verify before paying",
  stop: "Stop — do not pay or share anything",
};

export interface DecisionInput {
  band: RiskBand;
  score: number;
  signals: DetectedSignal[];
  context: ContextSummary;
  parse: ParseSummary;
  recipient?: string;
  amount: number;
  hasPaymentDetails: boolean;
}

function topEvidence(signals: DetectedSignal[], ids: SignalId[]): Evidence[] {
  return ids
    .map((id) => signals.find((s) => s.id === id))
    .filter((s): s is DetectedSignal => !!s)
    .map((s) => s.evidence.find((e) => e.kind !== "context") ?? s.evidence[0])
    .filter(Boolean)
    .slice(0, 3);
}

export function decide(d: DecisionInput): Decision {
  const ids = new Set(d.signals.map((s) => s.id));
  const risky = d.signals.filter((s) => !SIGNALS[s.id].mitigating);
  const uncertainties: string[] = [];

  if (d.context.mode === "none") uncertainties.push("No account history was supplied, so Sentinel cannot say whether this recipient or amount is unusual for you.");
  if (d.context.mode === "demo") uncertainties.push("Recipient and amount checks use a synthetic demo profile, not your real account history.");
  if (d.context.mode === "user") uncertainties.push("Recipient and amount checks use the saved-recipient list you typed in; Sentinel has not verified it.");
  uncertainties.push(...d.parse.warnings);
  if (!d.recipient && (ids.has("payment_request") || d.hasPaymentDetails)) uncertainties.push("The payee is not identified, so the destination of the money cannot be assessed.");
  if (!d.amount && (ids.has("payment_request") || ids.has("reversal"))) uncertainties.push("No amount was stated.");
  const uncertainOnly = risky.filter((s) => s.evidence.every((e) => e.attribution === "uncertain" || e.attribution === "reported"));
  if (uncertainOnly.length && d.parse.format !== "labelled")
    uncertainties.push(`${uncertainOnly.length} signal${uncertainOnly.length > 1 ? "s rely" : " relies"} on text whose author could not be confirmed.`);
  uncertainties.push("Sentinel cannot verify who the sender really is, or whether a recipient is fraudulent — only the patterns in what was submitted.");

  // Insufficient evidence: nothing from the other party to analyse, and no history to compare against.
  const noCounterpartyText = d.parse.counterpartyMessages === 0;
  const tooShort = d.parse.warnings.some((w) => /very short/.test(w));
  const insufficientEvidence = (noCounterpartyText && d.context.mode === "none") || (tooShort && risky.length === 0);

  let action = ACTION_FOR_BAND[d.band];
  if (insufficientEvidence && ACTION_RANK[action] < ACTION_RANK.proceed_with_care && (d.hasPaymentDetails || noCounterpartyText)) action = "proceed_with_care";

  // ── Workflow ────────────────────────────────────────────────────────────
  const workflow: DecisionStep[] = [];
  const what = ids.has("credentials")
    ? "Secret credentials (OTP, PIN, card details or remote access)."
    : ids.has("reversal")
      ? `A payment${d.amount ? ` of ${formatINR(d.amount)}` : ""} framed as a way to receive money.`
      : ids.has("payment_request") || d.hasPaymentDetails
        ? `A payment${d.amount ? ` of ${formatINR(d.amount)}` : ""}${d.recipient ? ` to ${d.recipient}` : ""}.`
        : "No concrete request for money or credentials was found.";
  workflow.push({ question: "What is being requested?", answer: what, evidence: topEvidence(d.signals, ["credentials", "reversal", "payment_request"]) });

  const concerns = risky
    .slice()
    .sort((a, b) => b.confidence * SIGNALS[b.id].weight - a.confidence * SIGNALS[a.id].weight)
    .slice(0, 4);
  workflow.push({
    question: "What evidence raises concern?",
    answer: concerns.length ? concerns.map((s) => SIGNALS[s.id].label).join(" · ") : "Nothing in the submitted text matched a known manipulation pattern.",
    evidence: concerns.map((s) => s.evidence.find((e) => e.kind !== "context") ?? s.evidence[0]).filter(Boolean),
  });

  const missing: string[] = [];
  if (ids.has("authority")) missing.push("whether the institution actually sent this");
  if (ids.has("identity_change")) missing.push("whether the sender is really who they say");
  if (d.context.recipientStatus === "unknown" && d.recipient) missing.push("whether you have paid this recipient before");
  if (!d.recipient && (ids.has("payment_request") || ids.has("reversal"))) missing.push("who the money would actually go to");
  if (ids.has("refund") || ids.has("reversal")) missing.push("the real status of the refund");
  if (ids.has("guarantee")) missing.push("whether the advisor/product is registered with the regulator");
  workflow.push({
    question: "What information is still missing?",
    answer: missing.length ? `Sentinel cannot confirm ${missing.join("; ")}.` : "Nothing material for this decision.",
  });

  const verify: string[] = [];
  if (ids.has("authority")) verify.push("Contact the institution through contact details you find yourself (the back of your card, its official app, or a statement) — not ones in the message.");
  if (ids.has("identity_change")) verify.push("Call the person on the number you already have saved for them, or ask a question only they would know.");
  if (ids.has("refund") || ids.has("reversal")) verify.push("Check the refund in the original merchant's app or order page.");
  if (ids.has("guarantee")) verify.push("Look the advisor up on the regulator's public register yourself.");
  if ((ids.has("new_beneficiary") || ids.has("unofficial_channel") || d.context.recipientStatus === "unknown") && d.recipient)
    verify.push(`Confirm that ${d.recipient} belongs to the person or business you intend to pay, through a channel you already trust.`);
  workflow.push({
    question: "What independent verification can resolve it?",
    answer: verify.length ? verify.join(" ") : action === "proceed" ? "None needed beyond checking the recipient name your payment app shows." : "Confirm the request with the person or organisation through a channel you already trust.",
  });

  const before =
    action === "stop"
      ? ids.has("credentials")
        ? "Do not share any code, PIN or screen. Do not pay. End the conversation and verify independently."
        : "Do not pay. End the conversation and verify independently before doing anything else."
      : action === "verify_first"
        ? "Hold the payment until the verification above succeeds."
        : action === "proceed_with_care"
          ? insufficientEvidence
            ? "Sentinel has too little to go on. If anything about this request is unexpected, verify the recipient first."
            : "Check the specific points above; if they hold up, the payment is likely fine."
          : "Confirm the recipient name shown in your payment app, then proceed as usual.";
  workflow.push({ question: "What should you do before authorising?", answer: before });

  const summary =
    action === "stop"
      ? "Strong signs of social engineering. Stop and verify independently."
      : action === "verify_first"
        ? "Several risk indicators. Verify independently before paying."
        : action === "proceed_with_care"
          ? insufficientEvidence
            ? "Insufficient evidence for a confident assessment."
            : "Some risk indicators, but not a clear manipulation pattern."
          : "No significant manipulation pattern found in what was submitted.";

  return { action, band: d.band, summary, workflow, uncertainties, insufficientEvidence };
}

/** Evidence-linked, proportionate recommendations. */
export function buildRecommendations(signals: DetectedSignal[], decision: Decision, recipient?: string): RecommendedAction[] {
  const ids = new Set(signals.map((s) => s.id));
  const recs: RecommendedAction[] = [];
  const add = (id: string, title: string, detail: string, priority: RecommendedAction["priority"], because: SignalId[] = []) =>
    recs.push({ id, title, detail, priority, because: because.filter((b) => ids.has(b)) });

  if (decision.action === "proceed") {
    add("proceed", "No manipulation pattern found", "Confirm the recipient name your payment app displays before approving.", "before-paying");
    if (ids.has("known_beneficiary")) add("known", "Saved recipient", "This recipient is in the saved list of the context in use. If the request itself was unusual, a quick call still helps.", "before-paying", ["known_beneficiary"]);
    return recs;
  }
  if (ids.has("credentials"))
    add("no-secrets", "Do not share the OTP, PIN, card details or your screen", "Anyone holding these can move money from your account. Legitimate banks and payment apps tell customers never to share them.", "now", ["credentials"]);
  if (ids.has("authority"))
    add("official", "Contact the institution independently", "Use contact details you find yourself — on your card, statement or the institution's own app — not anything from the message.", "now", ["authority", "unofficial_channel"]);
  if (ids.has("identity_change"))
    add("call-known", "Call the person on their saved number", "A message from a ‘new number’ can come from anyone. Hearing their voice on the number you already have settles it.", "now", ["identity_change"]);
  if (ids.has("reversal") || ids.has("refund"))
    add("refund-status", "Check the refund in the original merchant's app", "Genuine refunds go back to the original payment method. Sending money or approving a collect request moves money away from you.", "before-paying", ["reversal", "refund"]);
  if (ids.has("guarantee"))
    add("registry", "Check registration on the regulator's public register", "Look the advisor or scheme up yourself. A promise of guaranteed returns is a warning sign on its own.", "before-paying", ["guarantee", "social_proof"]);
  if ((ids.has("new_beneficiary") || ids.has("unofficial_channel")) && recipient)
    add("verify-recipient", `Verify who owns ${recipient}`, "Confirm through a channel you already trust that this handle or account belongs to the person or business you mean to pay. Unfamiliar does not mean fraudulent — but it should be checked.", "before-paying", ["new_beneficiary", "unofficial_channel"]);
  if (ids.has("urgency") || ids.has("threat") || ids.has("scarcity"))
    add("pause", "Take time before transferring", "A genuine deadline usually survives the few minutes it takes to verify. Pressure to skip verification is itself a warning sign.", "before-paying", ["urgency", "threat", "scarcity"]);
  if (ids.has("isolation"))
    add("tell-someone", "Talk to someone you trust", "You were told to keep this secret or stay on the line. Telling someone is exactly what protects you.", "now", ["isolation"]);
  if (ids.has("escalation"))
    add("no-more-fees", "Do not pay further fees to ‘release’ money", "Repeated fees, taxes or upgrades to unlock funds follow a common escalation pattern.", "before-paying", ["escalation"]);
  if (decision.action === "proceed_with_care" && !recs.length)
    add("confirm", "Confirm the request through a channel you trust", "Nothing here matches a strong manipulation pattern, but Sentinel cannot verify the other party for you.", "before-paying");
  if (decision.insufficientEvidence)
    add("more-context", "Add the conversation or your saved recipients", "With the messages that led to this payment — or your own list of known recipients — Sentinel can give a more specific assessment.", "before-paying");
  if (decision.action === "stop" || decision.action === "verify_first")
    add("report", "If you already paid or shared a code", "Contact your bank immediately using the number on your card or in its official app. In India, cyber fraud can also be reported on the national helpline 1930 or at cybercrime.gov.in.", "after");
  return recs;
}
