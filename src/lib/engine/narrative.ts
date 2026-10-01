import type {
  AttackNode,
  Classification,
  Evidence,
  ExtractedEntity,
  PathNode,
  PaymentDetails,
  RecommendedAction,
  SignalId,
} from "../types";
import { SIGNALS } from "./catalog";
import type { DetectedSignal } from "./detect";
import { findAmounts, formatINR, parseConversation } from "./parse";

const byStart = (a: Evidence, b: Evidence) => (a.start < 0 ? 1e9 : a.start) - (b.start < 0 ? 1e9 : b.start);

export function classify(signals: DetectedSignal[], score: number): Classification {
  const ids = new Set(signals.map((s) => s.id));
  if (score < 25) return "Low Risk";
  if (ids.has("guarantee")) return "Investment Fraud";
  const c = (id: SignalId) => signals.find((s) => s.id === id)?.confidence ?? 0;
  if (ids.has("refund") && c("refund") >= c("authority")) return "Refund Scam";
  if (ids.has("credentials") && !ids.has("payment_request")) return "Credential Phishing";
  if (ids.has("authority")) return "Authority Impersonation";
  if (ids.has("payment_request") && (ids.has("urgency") || ids.has("threat"))) return "Pressure-Driven Payment";
  if (ids.has("new_beneficiary")) return "Unverified Beneficiary";
  return "Pressure-Driven Payment";
}

export function headlineFor(score: number) {
  if (score >= 80) return "High-risk financial manipulation detected";
  if (score >= 55) return "Elevated risk — verify before you pay";
  if (score >= 25) return "Caution — some risk factors present";
  return "No significant manipulation detected";
}

/** Resolves the money at stake: payment field, else the largest amount demanded in text. */
export function amountAtStake(conversation: string, payment?: PaymentDetails) {
  if (payment?.amount) return payment.amount;
  const inbound = parseConversation(conversation).filter((m) => !m.self);
  const amounts = inbound.flatMap((m) => findAmounts(m.text));
  return amounts.length ? Math.max(...amounts) : 0;
}

function recipientOf(entities: ExtractedEntity[], payment?: PaymentDetails) {
  if (payment?.recipient) return payment.recipient;
  const r = entities.find((e) => e.type === "recipient" && e.flagged) ?? entities.find((e) => e.type === "account");
  return r?.value ?? "Unspecified";
}

/**
 * Builds a kill-chain view of the manipulation:
 * ACTOR → PRETEXT → URGENCY → LEVERAGE → ASK → DESTINATION → IMPACT.
 * Stages with no supporting signal are omitted.
 */
export function buildAttackChain(
  classification: Classification,
  conversation: string,
  signals: DetectedSignal[],
  entities: ExtractedEntity[],
  score: number,
  payment?: PaymentDetails,
): AttackNode[] {
  const m = new Map(signals.map((s) => [s.id, s]));
  const nodes: AttackNode[] = [];
  const inbound = parseConversation(conversation).filter((x) => !x.self);
  const sender = inbound[0]?.sender ?? "Unknown sender";
  const pick = (ids: SignalId[]) =>
    ids.filter((id) => m.has(id)).sort((a, b) => m.get(b)!.confidence * SIGNALS[b].weight - m.get(a)!.confidence * SIGNALS[a].weight);
  const evidenceOf = (ids: SignalId[]) => {
    const seen = new Set<string>();
    return ids
      .flatMap((id) => m.get(id)?.evidence ?? [])
      .filter((e) => (seen.has(e.text) ? false : (seen.add(e.text), true)))
      .sort(byStart);
  };

  const first = inbound[0];
  nodes.push({
    id: "actor",
    stage: "actor",
    label: score >= 55 ? "Scammer" : "Sender",
    sublabel: `Claims to be “${sender}”`,
    signalIds: [],
    evidence: first
      ? [{ text: first.text.length > 180 ? first.text.slice(0, 180) + "…" : first.text, start: first.offset, end: first.offset + Math.min(first.text.length, 180), source: "conversation" }]
      : [],
    details: [
      { label: "Claimed identity", value: sender },
      { label: "Channel", value: "Unsolicited inbound message" },
      { label: "Messages sent", value: String(inbound.length) },
    ],
  });

  const stages: { stage: AttackNode["stage"]; ids: SignalId[]; labels: Partial<Record<SignalId, string>> }[] = [
    { stage: "pretext", ids: ["authority", "guarantee", "refund"], labels: { authority: "Authority Impersonation", guarantee: "Guaranteed Returns", refund: "Refund Bait" } },
    { stage: "urgency", ids: ["urgency", "scarcity"], labels: { urgency: "Artificial Urgency", scarcity: "Manufactured Scarcity" } },
    {
      stage: "leverage",
      ids: ["threat", "social_proof", "isolation", "escalation", "emotional"],
      labels: { threat: "Fear / Threat", social_proof: "Social Proof", isolation: "Isolation", escalation: "Escalation", emotional: "Emotional Leverage" },
    },
  ];
  const stageSub: Record<string, string> = {
    pretext: "Borrowed credibility",
    urgency: "Removes time to think",
    leverage: "Raises the cost of saying no",
  };
  const lead: Partial<Record<Classification, SignalId>> = { "Refund Scam": "refund", "Investment Fraud": "guarantee" };
  for (const st of stages) {
    const present = pick(st.ids);
    const preferred = lead[classification];
    if (preferred && present.includes(preferred)) present.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));
    if (!present.length) continue;
    nodes.push({
      id: st.stage,
      stage: st.stage,
      label: st.labels[present[0]]!,
      sublabel: present.length > 1 ? `${stageSub[st.stage]} · +${present.slice(1).map((p) => SIGNALS[p].shortName.toLowerCase()).join(", ")}` : stageSub[st.stage],
      signalIds: present,
      evidence: evidenceOf(present),
    });
  }

  const amount = amountAtStake(conversation, payment);
  const recipient = recipientOf(entities, payment);
  const askIds = pick(["payment_request", "reversal", "credentials", "amount_anomaly"]);
  if (askIds.some((id) => id !== "amount_anomaly")) {
    const isCred = askIds[0] === "credentials" && !m.has("payment_request");
    nodes.push({
      id: "ask",
      stage: "ask",
      label: isCred ? "Credential Request" : "Payment Request",
      sublabel: m.has("reversal") ? "Framed as refundable / reversible" : isCred ? "Asks for secrets" : "Instruction to move money",
      signalIds: askIds,
      evidence: evidenceOf(askIds),
      details: isCred
        ? [{ label: "Requested", value: entities.filter((e) => e.type === "credential").map((e) => e.value).join(", ") || "Credentials" }]
        : [
            { label: "Recipient", value: recipient },
            { label: "Amount", value: amount ? formatINR(amount) : "Unspecified" },
            { label: "Payment method", value: payment?.method || (/@/.test(recipient) ? "UPI" : "Bank transfer") },
          ],
    });
  }

  const destIds = pick(["new_beneficiary", "unofficial_channel"]);
  if (destIds.length) {
    nodes.push({
      id: "destination",
      stage: "destination",
      label: "New Beneficiary",
      sublabel: m.has("unofficial_channel") ? "Personal handle, not an institution" : "No payment history",
      signalIds: destIds,
      evidence: evidenceOf(destIds),
      details: [
        { label: "Beneficiary", value: recipient },
        { label: "Previous payments", value: "0" },
        { label: "Verified merchant", value: "No" },
      ],
    });
  }

  if (amount > 0 && score >= 25) {
    nodes.push({
      id: "impact",
      stage: "impact",
      label: `${formatINR(amount)} Loss`,
      sublabel: "Potential, if the payment proceeds",
      signalIds: [],
      evidence: [],
      details: [
        { label: "At risk now", value: formatINR(amount) },
        { label: "Recoverability", value: "Low once settled (UPI / IMPS are instant)" },
        { label: "Follow-on exposure", value: "Repeat requests, credential theft" },
      ],
    });
  }
  return nodes;
}

/**
 * Hypothetical escalation tree. Explicitly a risk scenario, not a prediction of
 * what this specific attacker will do.
 */
export function buildPredictedPath(classification: Classification, amount: number, signals: DetectedSignal[]): PathNode {
  const amt = amount ? formatINR(amount) : "the amount";
  const second = amount ? formatINR(Math.round((amount * 1.6) / 100) * 100) : "a larger amount";
  const ids = new Set(signals.map((s) => s.id));

  const safe: PathNode = {
    id: "verify",
    label: "User verifies independently",
    description: "Calls the number on their card or opens the official app. The pretext collapses.",
    tone: "safe",
    children: [{ id: "verify-end", label: "Attack fails · ₹0 lost", description: "No money moves. Sender is reported.", tone: "safe" }],
  };

  let pays: PathNode;
  if (classification === "Investment Fraud") {
    pays = {
      id: "pay",
      label: `User pays ${amt}`,
      description: "Funds land in a mule account. A dashboard shows fake gains.",
      tone: "risk",
      children: [
        {
          id: "gains",
          label: "Fake profits displayed",
          description: "Small 'payout' builds trust and invites a larger deposit.",
          tone: "risk",
          children: [
            {
              id: "upgrade",
              label: `Upgrade request · ${second}`,
              description: "Higher tier or 'last chance' cycle requires more capital.",
              tone: "critical",
              children: [
                { id: "withdraw", label: "Withdrawal blocked", description: "Tax, clearance or release fee demanded to withdraw.", tone: "critical",
                  children: [{ id: "loss", label: "Total loss + further fees", description: "Platform disappears or account is frozen.", tone: "critical" }] },
              ],
            },
          ],
        },
      ],
    };
  } else if (classification === "Refund Scam") {
    pays = {
      id: "pay",
      label: `User sends ${amt}`,
      description: "No refund arrives. Payment is final.",
      tone: "risk",
      children: [
        {
          id: "failed",
          label: "“Transaction failed, try again”",
          description: "Agent claims the reversal didn't go through.",
          tone: "risk",
          children: [
            { id: "retry", label: "Second transfer requested", description: `Often for ${second} to “reverse both payments”.`, tone: "critical",
              children: [{ id: "remote", label: "Screen-share app suggested", description: "Remote access exposes UPI PIN and OTPs.", tone: "critical",
                children: [{ id: "takeover", label: "Potential account compromise", description: "Attacker can initiate payments directly.", tone: "critical" }] }] },
          ],
        },
      ],
    };
  } else {
    pays = {
      id: "pay",
      label: `User pays ${amt}`,
      description: "Money settles instantly to the attacker's account.",
      tone: "risk",
      children: [
        {
          id: "failed",
          label: "“Verification failed”",
          description: "Sender claims a mismatch and keeps the urgency high.",
          tone: "risk",
          children: [
            { id: "second", label: `Second payment request · ${second}`, description: "Framed as a penalty, late fee or re-verification.", tone: "critical",
              children: [{ id: "otp", label: "Request for OTP / credentials", description: "“Share the OTP to reverse the charge.”", tone: "critical",
                children: [{ id: "takeover", label: "Potential account compromise", description: "Credentials allow direct withdrawals and new mandates.", tone: "critical" }] }] },
          ],
        },
      ],
    };
  }

  const root: PathNode = {
    id: "root",
    label: "Current decision point",
    description: ids.has("payment_request") || ids.has("reversal") ? "A payment has been requested." : "Contact has been made.",
    tone: "neutral",
    children: [pays, safe],
  };
  return root;
}

export function buildRecommendations(signals: DetectedSignal[], classification: Classification, score: number): RecommendedAction[] {
  const ids = new Set(signals.map((s) => s.id));
  const recs: RecommendedAction[] = [];
  const add = (id: string, title: string, detail: string, priority: RecommendedAction["priority"]) => recs.push({ id, title, detail, priority });

  if (score < 25) {
    add("proceed", "No manipulation pattern found", "Pay as usual. Confirm the recipient name in your UPI app before approving.", "before-paying");
    return recs;
  }
  if (ids.has("authority") || ids.has("refund"))
    add("official", "Verify through the official website or app", "Open the institution's app or type its website yourself. Don't use links or numbers from the message.", "now");
  add("no-contact", "Don't use contact details from the message", "Numbers, links and UPI IDs in the message are controlled by the sender.", "now");
  add("no-otp", "Never share OTP, PIN or CVV", "No bank, marketplace or regulator will ever ask for them — not even to “reverse” a payment.", "now");
  if (ids.has("reversal") || ids.has("refund"))
    add("no-pay-to-receive", "You never pay to receive money", "Refunds go back to the original payment method automatically.", "before-paying");
  if (ids.has("guarantee"))
    add("sebi", "Check registration independently", "Look up the advisor on the regulator's official register. Guaranteed returns are a red flag on their own.", "before-paying");
  add("circle", "Ask a trusted person to review", "Share the conversation with someone in your Sentinel Circle before acting.", "before-paying");
  if (ids.has("urgency") || ids.has("scarcity") || ids.has("threat"))
    add("wait", "Wait before transferring", "Genuine deadlines survive a 30-minute pause. Manufactured ones don't.", "before-paying");
  if (classification !== "Low Risk")
    add("report", "If you already paid: act within the hour", "Call 1930 (National Cyber Crime Helpline) and your bank to request a freeze on the transaction.", "after");
  return recs;
}

export function buildExplanation(
  classification: Classification,
  signals: DetectedSignal[],
  entities: ExtractedEntity[],
  conversation: string,
  payment?: PaymentDetails,
) {
  const ids = new Set(signals.map((s) => s.id));
  const sender = parseConversation(conversation).find((m) => !m.self)?.sender ?? "The sender";
  const amount = amountAtStake(conversation, payment);
  const recipient = recipientOf(entities, payment);
  const deadlines = entities.filter((e) => e.type === "deadline").map((e) => e.value);
  const deadline = deadlines.find((d) => /minute/i.test(d)) ?? deadlines[0];
  const parts: string[] = [];
  if (ids.has("authority")) parts.push(`claims to be ${sender}`);
  else if (ids.has("guarantee")) parts.push("promises guaranteed returns");
  else if (ids.has("refund")) parts.push("uses a pending refund as bait");
  if (ids.has("urgency")) parts.push(deadline ? `imposes a deadline (“${deadline}”)` : "imposes an artificial deadline");
  if (ids.has("threat")) parts.push("threatens loss of access to money");
  if (ids.has("social_proof")) parts.push("leans on unverifiable social proof");
  if (ids.has("isolation")) parts.push("discourages talking to anyone else");
  if (ids.has("scarcity")) parts.push("claims the opportunity is about to close");
  if (ids.has("payment_request") || ids.has("reversal"))
    parts.push(
      `asks for ${amount ? formatINR(amount) : "a payment"}${recipient !== "Unspecified" ? ` to ${recipient}` : ""}` +
        (ids.has("new_beneficiary") ? " — a recipient this account has never paid" : ""),
    );
  if (!parts.length) return "No meaningful manipulation pattern was found in this conversation. The request is consistent with normal payment behaviour.";
  const lead = `The sender ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? ", and " : ""}${parts[parts.length - 1]}.`;
  const tail: Record<Classification, string> = {
    "Authority Impersonation": " Banks and regulators do not collect KYC or verification fees by UPI transfer to personal handles.",
    "Investment Fraud": " Regulated investments never guarantee returns, and never route money to private accounts via chat.",
    "Refund Scam": " A real refund never requires you to send money first.",
    "Credential Phishing": " No legitimate institution needs your OTP, PIN or remote access.",
    "Unverified Beneficiary": " The recipient cannot be verified from this conversation.",
    "Pressure-Driven Payment": " The pressure exists to stop you from verifying the request.",
    "Low Risk": "",
  };
  return lead + tail[classification];
}
