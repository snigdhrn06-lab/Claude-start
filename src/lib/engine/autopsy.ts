import type { SignalId } from "../types";
import { SIGNALS } from "./catalog";
import { detectLocal } from "./detect";
import { formatINR, parseConversation } from "./parse";
import { scoreSignals } from "./score";

export interface AutopsyInput {
  amount: number;
  recipient: string;
  reason: string;
  conversation: string;
  date: string;
  afterward: string;
}

export type AutopsyStage = "MESSAGE" | "PRETEXT" | "PRESSURE" | "PAYMENT REQUEST" | "PAYMENT" | "FOLLOW-UP" | "SECOND REQUEST" | "REPLY";

export interface AutopsyEvent {
  id: string;
  stage: AutopsyStage;
  actor: string;
  text: string;
  /** Cumulative risk score after this event. */
  risk: number;
  newSignals: SignalId[];
  isFirstVisible?: boolean;
  isSafeExit?: boolean;
}

export interface AutopsyReport {
  events: AutopsyEvent[];
  firstVisibleIndex: number;
  safeExitIndex: number;
  safeExitReason: string;
  whatWentWrong: string[];
  prevention: string[];
  recovery: string[];
  finalRisk: number;
  totalLoss: number;
  followUpDemand?: string;
}

const EXIT_REASONS: Partial<Record<SignalId, string>> = {
  urgency: "immediately after the sender introduced an artificial deadline",
  threat: "as soon as the sender threatened to freeze or block the account",
  guarantee: "the moment returns were described as guaranteed",
  reversal: "when a payment was required in order to receive money",
  payment_request: "when an unsolicited contact first asked for money",
  credentials: "the moment an OTP, PIN or remote access was requested",
  authority: "when an institution contacted you through an unofficial channel",
  scarcity: "when the offer was framed as about to close",
};

const DECISIVE: SignalId[] = ["urgency", "threat", "guarantee", "reversal", "credentials", "payment_request"];

function stageFor(ids: SignalId[], isSelf: boolean): AutopsyStage {
  if (isSelf) return "REPLY";
  if (ids.some((i) => ["payment_request", "reversal", "credentials"].includes(i))) return "PAYMENT REQUEST";
  if (ids.some((i) => ["urgency", "threat", "scarcity", "isolation", "escalation"].includes(i))) return "PRESSURE";
  if (ids.some((i) => ["authority", "guarantee", "refund", "social_proof"].includes(i))) return "PRETEXT";
  return "MESSAGE";
}

export function runAutopsy(input: AutopsyInput): AutopsyReport {
  const messages = parseConversation(input.conversation);
  const events: AutopsyEvent[] = [];
  const seen = new Set<SignalId>();
  let firstVisibleIndex = -1;
  let safeExitIndex = -1;
  let safeExitReason = "";

  messages.forEach((msg, i) => {
    const end = msg.offset + msg.text.length;
    const prefix = input.conversation.slice(0, end);
    const d = detectLocal(prefix);
    const risk = scoreSignals(d.signals).riskScore;
    const ids = d.signals.map((s) => s.id).filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    const ev: AutopsyEvent = {
      id: `m${i}`,
      stage: i === 0 && !msg.self ? (ids.length ? stageFor(ids, false) : "MESSAGE") : stageFor(ids, msg.self),
      actor: msg.self ? "You" : msg.sender,
      text: msg.text,
      risk,
      newSignals: ids.filter((id) => !SIGNALS[id].mitigating),
    };
    if (firstVisibleIndex < 0 && risk >= 40) {
      firstVisibleIndex = events.length;
      ev.isFirstVisible = true;
    }
    const decisive = ids.find((id) => DECISIVE.includes(id));
    if (safeExitIndex < 0 && decisive && !msg.self) {
      safeExitIndex = events.length;
      ev.isSafeExit = true;
      safeExitReason = EXIT_REASONS[decisive] ?? "at the first manipulation signal";
    }
    events.push(ev);
  });

  const base = detectLocal(input.conversation, {
    recipient: input.recipient,
    amount: input.amount,
    method: "UPI",
    reason: input.reason,
  });
  const paidRisk = scoreSignals(base.signals).riskScore;
  events.push({
    id: "payment",
    stage: "PAYMENT",
    actor: "You",
    text: `Paid ${formatINR(input.amount)} to ${input.recipient || "an unknown recipient"}${input.reason ? ` — “${input.reason}”` : ""}.`,
    risk: paidRisk,
    newSignals: [],
  });

  let followUpDemand: string | undefined;
  let finalRisk = paidRisk;
  if (input.afterward.trim()) {
    const after = detectLocal(`Sender: ${input.afterward}`);
    const ids = after.signals.map((s) => s.id);
    const second = ids.some((i) => ["payment_request", "escalation", "credentials", "reversal"].includes(i));
    const amounts = [...input.afterward.matchAll(/(?:₹|rs\.?\s?|inr\s?)\s?([\d,]+)/gi)].map((m) => Number(m[1].replace(/,/g, "")));
    if (amounts.length) followUpDemand = formatINR(Math.max(...amounts));
    finalRisk = Math.min(99, Math.max(paidRisk, paidRisk + (second ? 4 : 0)));
    const sentences = input.afterward.split(/(?<=[.!?])\s+/).filter(Boolean);
    sentences.forEach((s, j) => {
      const sd = detectLocal(`Sender: ${s}`).signals.map((x) => x.id);
      const isSecond = sd.some((i) => ["payment_request", "escalation", "credentials", "reversal"].includes(i)) || /(more|again|another|second|penalty|fee|otp)/i.test(s);
      events.push({
        id: `after${j}`,
        stage: isSecond ? "SECOND REQUEST" : "FOLLOW-UP",
        actor: "Sender",
        text: s,
        risk: finalRisk,
        newSignals: sd.filter((id) => !SIGNALS[id].mitigating),
      });
    });
  }

  const all = new Set([...base.signals.map((s) => s.id)]);
  const whatWentWrong: string[] = [];
  if (all.has("authority")) whatWentWrong.push("An unofficial contact borrowed the identity of a trusted institution — and it was never independently verified.");
  if (all.has("guarantee")) whatWentWrong.push("Guaranteed returns were accepted as plausible. No regulated product can promise them.");
  if (all.has("refund") || all.has("reversal")) whatWentWrong.push("Money was sent in order to receive money — the defining move of a refund-reversal scam.");
  if (all.has("urgency") || all.has("threat")) whatWentWrong.push("A deadline and a threat compressed the decision into minutes, leaving no time to check.");
  if (all.has("isolation")) whatWentWrong.push("The sender discouraged speaking to anyone, removing the people who could have stopped it.");
  if (all.has("new_beneficiary")) whatWentWrong.push(`${input.recipient || "The recipient"} had never been paid before and was not a verified merchant.`);
  if (!whatWentWrong.length) whatWentWrong.push("No strong manipulation pattern was found in the conversation provided. The loss may involve information not included here.");

  const prevention = [
    "Hang up and call the institution using the number printed on your card or its official app.",
    "Pause for 30 minutes on any payment that arrives with a deadline. Real deadlines survive a pause.",
    "Ask one person in your Sentinel Circle to review before sending money to a new beneficiary.",
    "Treat any request to pay in order to receive money as fraud, without exception.",
  ];
  const recovery = [
    "Call 1930 (National Cyber Crime Helpline) immediately — the first hours matter most for freezing funds.",
    "File a complaint at cybercrime.gov.in with the transaction reference and screenshots.",
    "Ask your bank to raise a fraud dispute and block further debits to this beneficiary.",
    "Do not pay any 'recovery', 'penalty' or 'release' fee — recovery scams target recent victims.",
    "Change UPI PIN and net-banking passwords if any credential or screen-share was involved.",
  ];

  return {
    events,
    firstVisibleIndex,
    safeExitIndex,
    safeExitReason: safeExitReason || "before any payment was made",
    whatWentWrong,
    prevention,
    recovery,
    finalRisk,
    totalLoss: input.amount,
    followUpDemand,
  };
}

export const AUTOPSY_EXAMPLE: AutopsyInput = {
  amount: 18500,
  recipient: "verify-kyc@upi",
  reason: "KYC verification deposit",
  date: "2026-09-28",
  conversation: [
    "SecureBank Alerts: Dear Customer, your SecureBank KYC is pending as per RBI guidelines.",
    "You: I updated it last year. What do I need to do?",
    "SecureBank KYC Desk: This is Rohit Verma from the SecureBank KYC Verification Cell. Your account will be frozen within 30 minutes if verification is not completed.",
    "You: Okay, how do I complete it?",
    "SecureBank KYC Desk: Transfer ₹18,500 immediately to verify-kyc@upi. The amount will be credited back within 2 hours.",
  ].join("\n"),
  afterward:
    "Two hours later they said verification failed due to a PAN mismatch. They asked for ₹29,600 more as a re-verification penalty. Then they asked me to read out the OTP I received to reverse the first charge.",
};
