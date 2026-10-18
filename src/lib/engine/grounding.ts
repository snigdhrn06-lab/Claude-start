import type { ChatMessage, Evidence, ExtractedEntity, PaymentDetails, RejectedEvidence } from "../types";
import { SIGNALS } from "./catalog";
import { patternMatches, type DetectedSignal } from "./detect";
import { attributionFor, findAmounts, locateQuote } from "./parse";

/**
 * Evidence validation. Runs on every analysis before it reaches the UI.
 *
 * Three separate checks — textual grounding is not semantic support:
 *  1. Grounding: a quote must equal conversation.slice(start, end), inside the
 *     message it claims to come from.
 *  2. Attribution: the quote's message must not be the user's own words.
 *     Unlabelled text is kept but marked "uncertain".
 *  3. Support: does an independent local pattern for the same signal match the
 *     excerpt? If not, the evidence is "model-only" and its strength is capped.
 */

export const MODEL_ONLY_CAP = 0.7;

export function validateSignals(
  conversation: string,
  messages: ChatMessage[],
  signals: DetectedSignal[],
): { signals: DetectedSignal[]; rejected: RejectedEvidence[] } {
  const rejected: RejectedEvidence[] = [];
  const out: DetectedSignal[] = [];
  for (const s of signals) {
    const kept: Evidence[] = [];
    for (const e of s.evidence) {
      if (e.kind === "context" || e.source !== "conversation") {
        kept.push(e);
        continue;
      }
      if (e.start < 0 || e.end > conversation.length || conversation.slice(e.start, e.end) !== e.text) {
        rejected.push({ signalId: s.id, text: e.text, reason: "Quote does not match the submitted text at the stated position." });
        continue;
      }
      const msg = e.messageIndex !== undefined ? messages[e.messageIndex] : messages.find((m) => e.start >= m.offset && e.end <= m.offset + m.text.length);
      if (!msg || e.start < msg.offset || e.end > msg.offset + msg.text.length) {
        rejected.push({ signalId: s.id, text: e.text, reason: "Quote could not be tied to a single message." });
        continue;
      }
      if (msg.role === "user") {
        rejected.push({ signalId: s.id, text: e.text, reason: "This is the user's own message, not evidence about the other party." });
        continue;
      }
      if (msg.duplicateOf !== undefined) {
        rejected.push({ signalId: s.id, text: e.text, reason: "Duplicate message — already counted once." });
        continue;
      }
      kept.push({
        ...e,
        messageIndex: msg.index,
        speaker: msg.sender,
        speakerRole: msg.role,
        attribution: attributionFor(msg),
        support: e.support === "rule" ? "rule" : patternMatches(s.id, e.text) ? "pattern" : "model-only",
      });
    }
    if (!kept.length) continue;
    const next = { ...s, evidence: kept };
    if (kept.every((e) => e.support === "model-only")) {
      next.confidence = Math.min(next.confidence, MODEL_ONLY_CAP);
    }
    out.push(next);
  }
  return { signals: out, rejected };
}

/** Grounds raw LLM quotes into attributed evidence. Unlocatable quotes are rejected. */
export function groundQuotes(conversation: string, messages: ChatMessage[], signalId: DetectedSignal["id"], quotes: string[]) {
  const evidence: Evidence[] = [];
  const rejected: RejectedEvidence[] = [];
  for (const q of quotes) {
    const hits = locateQuote(conversation, messages, q);
    if (!hits.length) {
      rejected.push({ signalId, text: q, reason: "Quote not found verbatim in the conversation (possible fabrication)." });
      continue;
    }
    const best = hits.find((h) => h.speakerRole !== "user");
    if (!best) {
      rejected.push({ signalId, text: q, reason: "Quote appears only in the user's own messages." });
      continue;
    }
    evidence.push(best);
  }
  return { evidence, rejected };
}

function digits(s: string) {
  return s.replace(/\D/g, "");
}

/**
 * Keeps only entities whose value can be found in the conversation or the
 * payment fields. Model-supplied "flagged" values are not trusted.
 */
export function validateEntities(
  entities: ExtractedEntity[],
  conversation: string,
  messages: ChatMessage[],
  payment?: PaymentDetails,
): { entities: ExtractedEntity[]; rejected: RejectedEvidence[] } {
  const rejected: RejectedEvidence[] = [];
  const out: ExtractedEntity[] = [];
  const lc = conversation.toLowerCase();
  const paymentText = payment ? `${payment.recipient} ${payment.method} ${payment.reason} ${payment.amount}`.toLowerCase() : "";
  const amounts = new Set([...findAmounts(conversation), ...(payment?.amount ? [payment.amount] : [])].map((a) => Math.round(a)));
  for (const e of entities) {
    const v = e.value.trim();
    if (!v) continue;
    let source: ExtractedEntity["source"] | undefined;
    if (e.type === "amount") {
      const n = Number(digits(v.replace(/\.\d+$/, "")));
      if (amounts.has(n)) source = payment?.amount === n ? "payment" : "conversation";
    } else if (lc.includes(v.toLowerCase())) source = "conversation";
    else if (paymentText.includes(v.toLowerCase())) source = "payment";
    else if (e.type === "account" && digits(v).length >= 9 && (digits(conversation).includes(digits(v)) || digits(paymentText).includes(digits(v)))) source = "conversation";
    if (!source) {
      rejected.push({ entity: `${e.type}: ${v}`, text: v, reason: "Entity not found in the submitted text or payment details." });
      continue;
    }
    let speakerRole: ExtractedEntity["speakerRole"];
    if (source === "conversation") {
      const hit = locateQuote(conversation, messages, v)[0];
      speakerRole = hit?.speakerRole;
    }
    const sentByOther = source === "conversation" && speakerRole !== "user";
    out.push({
      type: e.type,
      value: v,
      source,
      speakerRole,
      flagged: sentByOther && ["recipient", "account", "link", "phone", "credential"].includes(e.type),
      note: e.note ?? (sentByOther ? "Mentioned by the other party (unverified)" : source === "payment" ? "From payment details" : undefined),
    });
  }
  return { entities: out, rejected };
}

/** True if the signal's evidence came only from text the user wrote. Used in tests. */
export function hasUserAuthoredEvidence(s: { id: string; evidence: Evidence[] }) {
  return !SIGNALS[s.id as keyof typeof SIGNALS]?.mitigating && s.evidence.some((e) => e.speakerRole === "user");
}
