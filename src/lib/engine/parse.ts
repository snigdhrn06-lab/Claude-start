import type { ChatMessage, Evidence } from "../types";

const SELF_SENDERS = /^(you|me|user|i)$/i;

/**
 * Splits a raw conversation into messages. Lines shaped like "Sender: text"
 * start a new message; other lines continue the previous one. Text without any
 * sender prefix is treated as a single inbound message.
 */
export function parseConversation(raw: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const lineRe = /[^\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(raw))) {
    const line = m[0];
    const header = /^\s*([^:\n]{1,40}?):\s+/.exec(line);
    // Treat "12:30" style timestamps as content, not senders.
    if (header && !/^\d+$/.test(header[1].trim())) {
      const sender = header[1].trim();
      messages.push({
        sender,
        text: line.slice(header[0].length),
        offset: m.index + header[0].length,
        self: SELF_SENDERS.test(sender),
      });
    } else if (messages.length && line.trim()) {
      const prev = messages[messages.length - 1];
      const end = m.index + line.length;
      prev.text = raw.slice(prev.offset, end);
    } else if (line.trim()) {
      messages.push({ sender: "Unknown sender", text: line, offset: m.index, self: false });
    }
  }
  return messages;
}

/** Expands a match to the sentence that contains it, inside a message. */
export function sentenceAround(msg: ChatMessage, localStart: number, localEnd: number): Evidence {
  const t = msg.text;
  let s = localStart;
  while (s > 0 && !/[.!?]/.test(t[s - 1])) s--;
  while (s < localStart && /\s/.test(t[s])) s++;
  let e = localEnd;
  while (e < t.length && !/[.!?]/.test(t[e])) e++;
  if (e < t.length) e++;
  // Don't treat "Rs." or decimals as sentence ends: keep it simple but bounded.
  if (e - s > 220) {
    s = Math.max(localStart - 60, 0);
    e = Math.min(localEnd + 60, t.length);
  }
  return {
    text: t.slice(s, e).trim(),
    start: msg.offset + s,
    end: msg.offset + e,
    source: "conversation",
  };
}

/** Locates an exact (or case-insensitive) quote in the conversation. */
export function locateQuote(raw: string, quote: string): Evidence | null {
  const q = quote.trim().replace(/^["'“]|["'”]$/g, "");
  if (!q) return null;
  let idx = raw.indexOf(q);
  if (idx < 0) idx = raw.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;
  return { text: raw.slice(idx, idx + q.length), start: idx, end: idx + q.length, source: "conversation" };
}

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Pulls rupee amounts from text. */
export function findAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|rs\.?\s?|inr\s?)\s?([\d,]+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = Number(m[1].replace(/,/g, ""));
    if (v > 0) out.push(v);
  }
  return out;
}

export const UPI_RE = /\b[a-z0-9][a-z0-9._-]{1,48}@[a-z]{2,15}\b/gi;
export const ACCOUNT_RE = /\b(?:a\/c|account(?: no\.?| number)?)[\s:#-]*(\d{9,18})\b/gi;
export const IFSC_RE = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
export const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s]+|\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|rb\.gy)\/[^\s]+/gi;
export const PHONE_RE = /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g;
