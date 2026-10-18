import type { AttackNode, ChatMessage, Classification, Evidence, PathNode, RiskBand, SignalId } from "../types";
import { SIGNALS } from "./catalog";
import type { DetectedSignal } from "./detect";
import { findAmounts, formatINR, isAnalysable, parseConversation } from "./parse";

const byStart = (a: Evidence, b: Evidence) => (a.start < 0 ? 1e9 : a.start) - (b.start < 0 ? 1e9 : b.start);

export function classify(signals: DetectedSignal[], band: RiskBand, insufficient: boolean): Classification {
  const ids = new Set(signals.map((s) => s.id));
  const c = (id: SignalId) => signals.find((s) => s.id === id)?.confidence ?? 0;
  if (band === "low") return insufficient ? "Insufficient Evidence" : "Low Risk";
  if (ids.has("guarantee")) return "Investment Fraud";
  if (ids.has("credentials") && !ids.has("payment_request") && !ids.has("reversal")) return "Credential Phishing";
  if ((ids.has("refund") || ids.has("reversal")) && c("refund") + c("reversal") >= c("authority")) return "Refund Scam";
  if (ids.has("authority")) return "Authority Impersonation";
  if (ids.has("credentials")) return "Credential Phishing";
  if (ids.has("payment_request") && (ids.has("urgency") || ids.has("threat") || ids.has("identity_change"))) return "Pressure-Driven Payment";
  if (ids.has("new_beneficiary") || ids.has("unofficial_channel")) return "Unverified Beneficiary";
  if (insufficient) return "Insufficient Evidence";
  return "Pressure-Driven Payment";
}

export function headlineFor(band: RiskBand, insufficient: boolean) {
  if (band === "high") return "Strong signs of social engineering";
  if (band === "elevated") return "Elevated risk — verify before you pay";
  if (band === "caution") return insufficient ? "Not enough evidence for a confident assessment" : "Some risk indicators present";
  return insufficient ? "Not enough evidence for a confident assessment" : "No significant manipulation pattern found";
}

/**
 * Attack-chain view: ACTOR → PRETEXT → URGENCY → LEVERAGE → ASK → DESTINATION → IMPACT.
 * Each node is labelled observed (quoted counterparty text), inferred (from
 * context/payment fields) or hypothetical (a possible consequence). Stages
 * without supporting evidence are omitted.
 */
export function buildAttackChain(
  messages: ChatMessage[],
  signals: DetectedSignal[],
  band: RiskBand,
  recipient: string | undefined,
  amount: number,
  method?: string,
): AttackNode[] {
  const m = new Map(signals.map((s) => [s.id, s]));
  const nodes: AttackNode[] = [];
  const inbound = messages.filter(isAnalysable);
  const sender = inbound.find((x) => x.role === "counterparty")?.sender ?? inbound[0]?.sender ?? "Unknown sender";
  const pick = (ids: SignalId[]) =>
    ids.filter((id) => m.has(id)).sort((a, b) => m.get(b)!.confidence * SIGNALS[b].weight - m.get(a)!.confidence * SIGNALS[a].weight);
  const evidenceOf = (ids: SignalId[]) => {
    const seen = new Set<string>();
    return ids
      .flatMap((id) => m.get(id)?.evidence ?? [])
      .filter((e) => (seen.has(e.text) ? false : (seen.add(e.text), true)))
      .sort(byStart);
  };
  const statusOf = (ev: Evidence[]): AttackNode["status"] => (ev.some((e) => e.kind !== "context" && e.attribution === "attributed") ? "observed" : "inferred");

  const first = inbound[0];
  if (first) {
    const len = Math.min(first.text.length, 180);
    nodes.push({
      id: "actor",
      stage: "actor",
      label: "Sender (unverified)",
      sublabel: first.labelled ? `Identifies as “${sender}”` : "No sender label in the input",
      signalIds: [],
      evidence: [
        {
          text: first.text.slice(0, len),
          start: first.offset,
          end: first.offset + len,
          source: "conversation",
          kind: "quote",
          messageIndex: first.index,
          speaker: first.sender,
          speakerRole: first.role,
          attribution: first.role === "counterparty" ? "attributed" : "uncertain",
        },
      ],
      details: [
        { label: "Claimed identity", value: first.labelled ? sender : "Unknown" },
        { label: "Identity verified", value: "No — Sentinel cannot verify senders" },
        { label: "Messages from sender", value: String(inbound.length) },
      ],
      status: "observed",
    });
  }

  const stages: { stage: AttackNode["stage"]; ids: SignalId[]; labels: Partial<Record<SignalId, string>>; sub: string }[] = [
    {
      stage: "pretext",
      ids: ["authority", "guarantee", "refund", "identity_change"],
      labels: { authority: "Authority Claim", guarantee: "Guaranteed Returns", refund: "Refund Bait", identity_change: "New-Number Claim" },
      sub: "Borrowed credibility",
    },
    { stage: "urgency", ids: ["urgency", "scarcity"], labels: { urgency: "Artificial Urgency", scarcity: "Manufactured Scarcity" }, sub: "Removes time to verify" },
    {
      stage: "leverage",
      ids: ["threat", "social_proof", "isolation", "escalation", "emotional"],
      labels: { threat: "Fear / Threat", social_proof: "Social Proof", isolation: "Isolation", escalation: "Escalation", emotional: "Emotional Leverage" },
      sub: "Raises the cost of saying no",
    },
  ];
  for (const st of stages) {
    const present = pick(st.ids);
    if (!present.length) continue;
    const ev = evidenceOf(present);
    nodes.push({
      id: st.stage,
      stage: st.stage,
      label: st.labels[present[0]]!,
      sublabel: present.length > 1 ? `${st.sub} · +${present.slice(1).map((p) => SIGNALS[p].shortName.toLowerCase()).join(", ")}` : st.sub,
      signalIds: present,
      evidence: ev,
      status: statusOf(ev),
    });
  }

  const askIds = pick(["credentials", "reversal", "payment_request"]);
  if (askIds.length) {
    const isCred = askIds[0] === "credentials" && !m.has("payment_request") && !m.has("reversal");
    const ev = evidenceOf(askIds);
    nodes.push({
      id: "ask",
      stage: "ask",
      label: isCred ? "Credential Request" : "Payment Request",
      sublabel: m.has("reversal") ? "Framed as refundable / reversible" : isCred ? "Asks for secrets" : "Instruction to move money",
      signalIds: askIds,
      evidence: ev,
      details: isCred
        ? [{ label: "Requested", value: "Secret credentials" }]
        : [
            { label: "Recipient", value: recipient ?? "Not identified" },
            { label: "Amount", value: amount ? formatINR(amount) : "Not stated" },
            { label: "Payment method", value: method || (recipient?.includes("@") ? "UPI" : recipient ? "Bank transfer" : "Not stated") },
          ],
      status: statusOf(ev),
    });
  }

  const destIds = pick(["unofficial_channel", "new_beneficiary"]);
  if (destIds.length && recipient) {
    const ev = evidenceOf(destIds);
    nodes.push({
      id: "destination",
      stage: "destination",
      label: m.has("unofficial_channel") ? "Unofficial Destination" : "Unsaved Recipient",
      sublabel: m.has("unofficial_channel") ? "Handle or account given in chat" : "Not in the saved-recipient list",
      signalIds: destIds,
      evidence: ev,
      details: [
        { label: "Beneficiary", value: recipient },
        { label: "In saved recipients", value: m.has("new_beneficiary") ? "No (per context in use)" : "Unknown" },
        { label: "Known to be fraudulent", value: "Not known — Sentinel has no fraud database" },
      ],
      status: statusOf(ev),
    });
  }

  if (amount > 0 && (band === "elevated" || band === "high") && askIds.some((id) => id !== "credentials")) {
    nodes.push({
      id: "impact",
      stage: "impact",
      label: `Up to ${formatINR(amount)} at risk`,
      sublabel: "Hypothetical — only if the payment proceeds and this is fraud",
      signalIds: [],
      evidence: [],
      details: [
        { label: "Requested amount", value: formatINR(amount) },
        { label: "Reversibility", value: "UPI / IMPS settle instantly; recovery is not guaranteed" },
      ],
      status: "hypothetical",
    });
  }
  return nodes;
}

/**
 * Hypothetical escalation tree, shown only for elevated/high results. It
 * describes how this *pattern* commonly develops, conditioned on the request
 * being fraudulent — not a prediction about this sender.
 */
export function buildPredictedPath(classification: Classification, band: RiskBand, amount: number, signals: DetectedSignal[]): PathNode {
  const ids = new Set(signals.map((s) => s.id));
  const amt = amount ? formatINR(amount) : "the amount";
  const safe: PathNode = {
    id: "verify",
    label: "You verify independently",
    description: "You contact the person or institution through a channel you already trust. If the request was false, it stops here.",
    tone: "safe",
    children: [{ id: "verify-end", label: "Nothing sent until verified", description: "If it was genuine, you pay knowing it is.", tone: "safe" }],
  };
  const root: PathNode = {
    id: "root",
    label: "Current decision point",
    description: ids.has("credentials")
      ? "Credentials have been requested."
      : ids.has("payment_request") || ids.has("reversal")
        ? "A payment has been requested."
        : "No concrete request yet.",
    tone: "neutral",
    children: [],
  };
  if (band === "low" || band === "caution") {
    root.children = [
      {
        id: "proceed",
        label: band === "low" ? "Proceed as usual" : "Proceed after the checks above",
        description: "No escalation pattern is projected: the evidence does not support a fraud scenario.",
        tone: "neutral",
      },
      safe,
    ];
    return root;
  }

  let pays: PathNode;
  if (ids.has("credentials") && !ids.has("payment_request")) {
    pays = {
      id: "share",
      label: "If you share the code",
      description: "If this is fraud, a one-time code or PIN can authorise payments or new device registrations you didn't intend.",
      tone: "risk",
      children: [{ id: "drain", label: "Possible unauthorised debits", description: "Typical next step in this pattern: transactions you did not initiate.", tone: "critical" }],
    };
  } else if (classification === "Investment Fraud") {
    pays = {
      id: "pay",
      label: `If you pay ${amt}`,
      description: "If this is fraud, this pattern often shows early ‘gains’ on a dashboard to build trust.",
      tone: "risk",
      children: [
        {
          id: "upgrade",
          label: "Requests for more capital",
          description: ids.has("escalation") ? "Already hinted at in this conversation (upgrade / extra tier)." : "Common next step in this pattern.",
          tone: "critical",
          children: [{ id: "withdraw", label: "Withdrawal fees", description: "Fees or ‘tax’ demanded before funds can be withdrawn.", tone: "critical" }],
        },
      ],
    };
  } else if (classification === "Refund Scam") {
    pays = {
      id: "pay",
      label: `If you send ${amt}`,
      description: "If this is fraud, the promised refund does not arrive; the payment is final.",
      tone: "risk",
      children: [
        {
          id: "retry",
          label: "“It failed — try again”",
          description: "Common next step: a second transfer or a screen-sharing app ‘to fix it’.",
          tone: "critical",
        },
      ],
    };
  } else {
    pays = {
      id: "pay",
      label: `If you pay ${amt}`,
      description: "If this is fraud, the money settles instantly and recovery is uncertain.",
      tone: "risk",
      children: [
        {
          id: "second",
          label: "Follow-up demands",
          description: ids.has("escalation") ? "Already hinted at here (extra fees / second payment)." : "Common next step in this pattern: a ‘penalty’, ‘re-verification’ or OTP request.",
          tone: "critical",
        },
      ],
    };
  }
  root.children = [pays, safe];
  return root;
}

export function buildExplanation(classification: Classification, signals: DetectedSignal[], sender: string | undefined, recipient: string | undefined, amount: number, insufficient: boolean) {
  const ids = new Set(signals.map((s) => s.id));
  const parts: string[] = [];
  if (ids.has("authority")) parts.push(sender ? `presents itself as ${sender}` : "presents itself as an institution");
  if (ids.has("identity_change")) parts.push("claims to be a known contact on a new number");
  if (ids.has("guarantee")) parts.push("promises guaranteed returns");
  if (ids.has("refund")) parts.push("uses a pending refund as the reason to pay");
  if (ids.has("urgency")) parts.push("imposes a deadline");
  if (ids.has("threat")) parts.push("threatens loss of access or penalties");
  if (ids.has("social_proof")) parts.push("leans on unverifiable social proof");
  if (ids.has("isolation")) parts.push("discourages involving anyone else");
  if (ids.has("scarcity")) parts.push("claims the opportunity is about to close");
  if (ids.has("credentials")) parts.push("asks for secret credentials or remote access");
  if (ids.has("payment_request") || ids.has("reversal"))
    parts.push(`asks for ${amount ? formatINR(amount) : "a payment"}${recipient ? ` to ${recipient}` : ""}` + (ids.has("new_beneficiary") ? " (not in the saved-recipient list in use)" : ""));
  const mit: string[] = [];
  if (ids.has("verification")) mit.push("points to independent, official channels");
  if (ids.has("known_beneficiary")) mit.push("the recipient is a saved beneficiary");

  if (!parts.length) {
    const base = insufficient
      ? "There is too little information here for a confident assessment."
      : "No manipulation pattern was found in the text submitted.";
    return mit.length ? `${base} On the positive side, ${mit.join(" and ")}.` : base;
  }
  const lead = `The other party ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? ", and " : ""}${parts[parts.length - 1]}.`;
  const tail: Record<Classification, string> = {
    "Authority Impersonation": " Institutions do not normally collect verification fees by transfer to handles shared in chat.",
    "Investment Fraud": " Market-linked investments cannot guarantee returns.",
    "Refund Scam": " A genuine refund does not require you to send money first.",
    "Credential Phishing": " Anyone holding an OTP or PIN can act on your account.",
    "Unverified Beneficiary": " The recipient cannot be verified from this conversation.",
    "Pressure-Driven Payment": " Pressure to act quickly is a reason to verify, not to skip verification.",
    "Insufficient Evidence": "",
    "Low Risk": " Taken together this does not form a strong manipulation pattern.",
  };
  return lead + tail[classification] + (mit.length ? ` Mitigating: ${mit.join("; ")}.` : "");
}

/** Money at stake: the payment field, else the largest amount the other party mentioned. */
export function amountAtStake(conversation: string, payment?: { amount: number }) {
  if (payment?.amount) return payment.amount;
  const amounts = parseConversation(conversation)
    .filter(isAnalysable)
    .flatMap((m) => findAmounts(m.text));
  return amounts.length ? Math.max(...amounts) : 0;
}
