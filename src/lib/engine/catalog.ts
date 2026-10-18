import type { Dimension, Severity, SignalCategory, SignalId } from "../types";

/**
 * Versioned signal catalogue. Bump CATALOG_VERSION whenever a signal's meaning,
 * weight or detector changes, so stored analyses remain reproducible.
 */
export const CATALOG_VERSION = "2.0.0";

export interface SignalSpec {
  id: SignalId;
  label: string;
  category: SignalCategory;
  dimension: Dimension;
  /** Contribution weight (0–1) inside its dimension's noisy-OR. */
  weight: number;
  /** Default evidence strength for a single pattern match (0–1). */
  baseConfidence: number;
  severity: Severity;
  explanation: string;
  /** Short reason used in counterfactual diffs. */
  shortName: string;
  mitigating?: boolean;
}

export const SIGNALS: Record<SignalId, SignalSpec> = {
  urgency: {
    id: "urgency",
    label: "Artificial Urgency",
    category: "language",
    dimension: "pressure",
    weight: 0.78,
    baseConfidence: 0.88,
    severity: "critical",
    explanation: "Message creates a short deadline to prevent independent verification.",
    shortName: "Urgency",
  },
  threat: {
    id: "threat",
    label: "Financial Threat",
    category: "language",
    dimension: "pressure",
    weight: 0.75,
    baseConfidence: 0.86,
    severity: "critical",
    explanation: "User is told they will lose access to money or face penalties unless they act.",
    shortName: "Threat",
  },
  authority: {
    id: "authority",
    label: "Authority Impersonation",
    category: "context",
    dimension: "context",
    weight: 0.86,
    baseConfidence: 0.84,
    severity: "high",
    explanation: "Sender presents itself as a financial institution or official body to borrow its credibility.",
    shortName: "Authority claim",
  },
  guarantee: {
    id: "guarantee",
    label: "Guaranteed Returns",
    category: "language",
    dimension: "context",
    weight: 0.88,
    baseConfidence: 0.87,
    severity: "critical",
    explanation: "Promises fixed or risk-free returns. Market-linked investments cannot guarantee profit.",
    shortName: "Guarantee",
  },
  scarcity: {
    id: "scarcity",
    label: "Manufactured Scarcity",
    category: "language",
    dimension: "pressure",
    weight: 0.72,
    baseConfidence: 0.82,
    severity: "high",
    explanation: "Claims limited slots or a closing window to rush commitment.",
    shortName: "Scarcity",
  },
  social_proof: {
    id: "social_proof",
    label: "Social Proof",
    category: "language",
    dimension: "context",
    weight: 0.6,
    baseConfidence: 0.8,
    severity: "medium",
    explanation: "Uses unverifiable claims about other people's gains to lower suspicion.",
    shortName: "Social proof",
  },
  refund: {
    id: "refund",
    label: "Refund Manipulation",
    category: "context",
    dimension: "context",
    weight: 0.7,
    baseConfidence: 0.82,
    severity: "high",
    explanation: "A refund or cashback is used as bait to start a money-out conversation.",
    shortName: "Refund pretext",
  },
  reversal: {
    id: "reversal",
    label: "Payment Reversal Trick",
    category: "transaction",
    dimension: "transaction",
    weight: 0.64,
    baseConfidence: 0.86,
    severity: "critical",
    explanation: "User is asked to send money (or approve a collect request) in order to receive money. Genuine refunds go back to the original payment method.",
    shortName: "Pay-to-receive",
  },
  payment_request: {
    id: "payment_request",
    label: "Unusual Payment Request",
    category: "transaction",
    dimension: "transaction",
    weight: 0.7,
    baseConfidence: 0.85,
    severity: "high",
    explanation: "The other party gives a concrete instruction to move money.",
    shortName: "Payment instruction",
  },
  isolation: {
    id: "isolation",
    label: "Secrecy / Isolation",
    category: "behavioral",
    dimension: "pressure",
    weight: 0.5,
    baseConfidence: 0.8,
    severity: "high",
    explanation: "User is discouraged from talking to anyone who could stop the payment.",
    shortName: "Isolation",
  },
  credentials: {
    id: "credentials",
    label: "Credential Harvesting",
    category: "behavioral",
    dimension: "context",
    weight: 0.95,
    baseConfidence: 0.9,
    severity: "critical",
    explanation: "Asks for an OTP, PIN, CVV, password or a remote-access / screen-sharing app. Banks and payment apps consistently tell customers never to share these.",
    shortName: "Credential request",
  },
  escalation: {
    id: "escalation",
    label: "Escalating Requests",
    category: "behavioral",
    dimension: "pressure",
    weight: 0.6,
    baseConfidence: 0.78,
    severity: "high",
    explanation: "Requests grow over time — extra fees, upgrades or a second payment.",
    shortName: "Escalation",
  },
  emotional: {
    id: "emotional",
    label: "Emotional Leverage",
    category: "language",
    dimension: "pressure",
    weight: 0.4,
    baseConfidence: 0.72,
    severity: "medium",
    explanation: "Reassurance or aspiration is used to override caution.",
    shortName: "Emotional leverage",
  },
  new_beneficiary: {
    id: "new_beneficiary",
    label: "New Beneficiary",
    category: "transaction",
    dimension: "recipient",
    weight: 0.62,
    baseConfidence: 0.86,
    severity: "high",
    explanation: "Recipient is not in the saved-recipient list of the account context in use. A risk indicator, not proof of fraud.",
    shortName: "Unknown recipient",
  },
  unofficial_channel: {
    id: "unofficial_channel",
    label: "Unofficial Payment Channel",
    category: "context",
    dimension: "recipient",
    weight: 0.6,
    baseConfidence: 0.8,
    severity: "high",
    explanation: "Money is routed to a personal handle, private account or sender-supplied link while the sender claims to act for an institution.",
    shortName: "Unofficial channel",
  },
  amount_anomaly: {
    id: "amount_anomaly",
    label: "Amount Anomaly",
    category: "transaction",
    dimension: "transaction",
    weight: 0.3,
    baseConfidence: 0.75,
    severity: "medium",
    explanation: "Amount is well above the typical outgoing payment in the account context in use.",
    shortName: "Unusual amount",
  },
  verification: {
    id: "verification",
    label: "Independent Verification Path",
    category: "context",
    dimension: "context",
    weight: 0.6,
    baseConfidence: 0.85,
    severity: "info",
    explanation: "The message points to official, independently verifiable channels.",
    shortName: "Verification path",
    mitigating: true,
  },
  identity_change: {
    id: "identity_change",
    label: "Unverified Identity Change",
    category: "context",
    dimension: "context",
    weight: 0.72,
    baseConfidence: 0.82,
    severity: "high",
    explanation: "Sender says they are someone you know writing from a new number or account. The identity cannot be confirmed from the message itself.",
    shortName: "New-number claim",
  },
  windfall: {
    id: "windfall",
    label: "Unexpected Reward or Offer",
    category: "context",
    dimension: "context",
    weight: 0.7,
    baseConfidence: 0.82,
    severity: "high",
    explanation: "Announces a prize, loan, job, bonus or parcel the user did not seek. Advance-fee schemes use the promised benefit to justify a fee.",
    shortName: "Windfall claim",
  },
  known_beneficiary: {
    id: "known_beneficiary",
    label: "Saved Recipient",
    category: "transaction",
    dimension: "recipient",
    weight: 0.6,
    baseConfidence: 0.9,
    severity: "info",
    explanation: "Recipient is in the saved-recipient list of the account context in use. Lowers recipient risk only; it does not rule out a compromised or impersonated contact.",
    shortName: "Saved recipient",
    mitigating: true,
  },
};

export const SIGNAL_IDS = Object.keys(SIGNALS) as SignalId[];

/** Signals the LLM may report. Account-context signals always come from the context provider. */
export const CONTEXT_SIGNALS: SignalId[] = ["new_beneficiary", "amount_anomaly", "known_beneficiary"];
export const PERCEIVABLE_SIGNALS = SIGNAL_IDS.filter((id) => !CONTEXT_SIGNALS.includes(id));

/** Signals that represent a concrete ask (money or secrets). Escalation is, by definition, a request for more money. */
export const ASK_SIGNALS: SignalId[] = ["payment_request", "reversal", "credentials", "escalation"];

export { ACCOUNT_PROFILE, DEMO_PROFILE } from "./context";

