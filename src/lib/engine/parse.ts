import type { ChatMessage, Evidence, ParseSummary, SpeakerRole } from "../types";

/**
 * Conversation parsing: turns raw pasted text into an attributed message list.
 *
 * Supported shapes (one message per line, continuation lines allowed):
 *   Sender: text
 *   [10:32] Sender: text            (bracketed timestamp)
 *   12/10/26, 10:32 PM - Sender: text  (WhatsApp export)
 * Text without any sender label is kept as a single "unknown" message: Sentinel
 * still analyses it, but marks every excerpt's attribution as uncertain.
 */

const SELF_SENDERS = /^(you|me|myself|i|user|you \(me\)|me \(you\))$/i;

/** Labels that look like "X:" but are content, not a speaker. */
const NOT_A_SENDER =
  /^(note|ps|p\.s|nb|subject|re|fwd|warning|important|reminder|update|step \d+|reason|amount|upi(?: id)?|vpa|account(?: no| number)?|a\/c(?: no)?|ifsc|name|beneficiary|ref(?:erence)?(?: no)?|link|url|otp|pin|time|date|deadline|total|balance|order(?: id| no)?|status|http|https|tel|phone|mobile|email|address|dear .*|hi|hello|hey)$/i;

const TIMESTAMP_PREFIX =
  /^\s*(?:\[\s*[^\]\n]{1,30}\]\s*|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\s*[-–]\s*|\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?\s*[-–]\s*)/i;

function roleFor(sender: string): SpeakerRole {
  return SELF_SENDERS.test(sender.trim()) ? "user" : "counterparty";
}

function normaliseForDup(t: string) {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Splits a raw conversation into attributed messages. */
export function parseConversation(raw: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const lineRe = /[^\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(raw))) {
    const line = m[0];
    if (!line.trim()) continue;
    const ts = TIMESTAMP_PREFIX.exec(line);
    const afterTs = ts ? ts[0].length : 0;
    const header = /^\s*([^:\n]{1,40}?):\s+/.exec(line.slice(afterTs));
    const label = header?.[1].trim() ?? "";
    const isHeader =
      !!header &&
      !/^\d+$/.test(label) &&
      label.split(/\s+/).length <= 6 &&
      !NOT_A_SENDER.test(label) &&
      // A label must start with a letter or bracket, not punctuation / quotes.
      /^[\p{L}(]/u.test(label);
    if (isHeader) {
      const textStart = m.index + afterTs + header![0].length;
      messages.push({
        index: messages.length,
        sender: label,
        text: raw.slice(textStart, m.index + line.length),
        offset: textStart,
        self: roleFor(label) === "user",
        role: roleFor(label),
        labelled: true,
      });
    } else if (messages.length) {
      const prev = messages[messages.length - 1];
      prev.text = raw.slice(prev.offset, m.index + line.length);
    } else {
      messages.push({
        index: 0,
        sender: "Unknown sender",
        text: line,
        offset: m.index,
        self: false,
        role: "unknown",
        labelled: false,
      });
    }
  }

  // Duplicates: identical text from the same sender is counted once.
  const seen = new Map<string, number>();
  for (const msg of messages) {
    const k = msg.sender.toLowerCase() + "\u0000" + normaliseForDup(msg.text);
    if (seen.has(k)) msg.duplicateOf = seen.get(k);
    else seen.set(k, msg.index);
  }

  // Quoted text inside the user's own messages ("they said: '...'") is
  // third-party content reported by the user — not the user's own words.
  const reported: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const q = /(?:^|[\s:(])(["“'‘])([^"“”'‘’\n]{12,})(["”'’])/g;
    let qm: RegExpExecArray | null;
    while ((qm = q.exec(msg.text))) {
      const local = qm.index + qm[0].indexOf(qm[1]) + 1;
      reported.push({
        index: -1,
        sender: "Quoted by you",
        text: qm[2],
        offset: msg.offset + local,
        self: false,
        role: "reported",
        labelled: false,
        quotedIn: msg.index,
      });
    }
  }
  for (const r of reported) {
    r.index = messages.length;
    messages.push(r);
  }
  return messages;
}

export function summariseParse(raw: string, messages: ChatMessage[]): ParseSummary {
  const primary = messages.filter((m) => m.role !== "reported");
  const warnings: string[] = [];
  const labelled = primary.filter((m) => m.labelled).length;
  const format: ParseSummary["format"] = !primary.length
    ? "empty"
    : labelled === primary.length
      ? "labelled"
      : labelled === 0
        ? "unlabelled"
        : "mixed";
  if (format === "unlabelled")
    warnings.push("No sender labels were found, so Sentinel cannot tell who wrote which line. Evidence attribution is marked uncertain.");
  if (format === "mixed") warnings.push("Some lines have no sender label; they are attributed to an unknown sender.");
  const dups = primary.filter((m) => m.duplicateOf !== undefined).length;
  if (dups) warnings.push(`${dups} duplicate message${dups > 1 ? "s were" : " was"} ignored for scoring.`);
  const reported = messages.filter((m) => m.role === "reported").length;
  if (reported) warnings.push(`${reported} quoted passage${reported > 1 ? "s" : ""} inside your own messages ${reported > 1 ? "were" : "was"} treated as reported third-party text.`);
  const senders = new Set(primary.filter((m) => m.role === "counterparty").map((m) => m.sender.toLowerCase()));
  if (senders.size > 2) warnings.push(`${senders.size} different non-user senders were found. Sentinel treats all of them as the other party.`);
  if (primary.length && !primary.some((m) => m.role === "counterparty" || m.role === "unknown"))
    warnings.push("Every message is labelled as written by you, so there is no counterparty text to analyse.");
  if (raw.length > 0 && raw.trim().length < 20) warnings.push("The input is very short; there is little evidence to assess.");
  return {
    format,
    messageCount: primary.length,
    counterpartyMessages: primary.filter((m) => m.role === "counterparty" || m.role === "unknown").length,
    userMessages: primary.filter((m) => m.role === "user").length,
    warnings,
  };
}

/** True when the message's text may be used as evidence about the other party. */
export function isAnalysable(m: ChatMessage) {
  return m.role !== "user" && m.duplicateOf === undefined;
}

export function attributionFor(m: ChatMessage): Evidence["attribution"] {
  return m.role === "counterparty" ? "attributed" : m.role === "reported" ? "reported" : "uncertain";
}

const ABBREV = /(?:\brs|\bno|\bmr|\bmrs|\bms|\bdr|\bltd|\bpvt|\bst|\bvs|\be\.g|\bi\.e|\ba\/c)$/i;

function isBoundary(t: string, i: number) {
  const ch = t[i];
  if (!/[.!?]/.test(ch)) return false;
  const next = t[i + 1];
  if (next !== undefined && !/\s/.test(next)) return false; // "₹1.5", "example.com"
  if (ch === "." && ABBREV.test(t.slice(Math.max(0, i - 4), i))) return false;
  return true;
}

function evidenceFor(msg: ChatMessage, s: number, e: number): Evidence {
  const t = msg.text;
  while (s < e && /\s/.test(t[s])) s++;
  while (e > s && /\s/.test(t[e - 1])) e--;
  return {
    text: t.slice(s, e),
    start: msg.offset + s,
    end: msg.offset + e,
    source: "conversation",
    kind: "quote",
    messageIndex: msg.index,
    speaker: msg.sender,
    speakerRole: msg.role,
    attribution: attributionFor(msg),
  };
}

/** Expands a match to the sentence that contains it, inside a message. */
export function sentenceAround(msg: ChatMessage, localStart: number, localEnd: number): Evidence {
  const t = msg.text;
  let s = localStart;
  while (s > 0 && !isBoundary(t, s - 1) && t[s - 1] !== "\n") s--;
  let e = localEnd;
  while (e < t.length && !isBoundary(t, e) && t[e] !== "\n") e++;
  if (e < t.length && t[e] !== "\n") e++;
  if (e - s > 240) {
    s = Math.max(localStart - 80, 0);
    e = Math.min(localEnd + 80, t.length);
  }
  return evidenceFor(msg, s, e);
}

/** The full sentence list of a message, as evidence-ready ranges. */
export function sentences(msg: ChatMessage): Evidence[] {
  const out: Evidence[] = [];
  const t = msg.text;
  let s = 0;
  for (let i = 0; i < t.length; i++) {
    if (isBoundary(t, i) || t[i] === "\n") {
      const e = t[i] === "\n" ? i : i + 1;
      if (t.slice(s, e).trim()) out.push(evidenceFor(msg, s, e));
      s = i + 1;
    }
  }
  if (t.slice(s).trim()) out.push(evidenceFor(msg, s, t.length));
  return out;
}

function normalise(s: string) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Locates a quote in the conversation. Matching tolerates case, curly quotes
 * and whitespace differences only — never paraphrase. Returns every message
 * that contains the quote, so the caller can decide on attribution.
 */
export function locateQuote(raw: string, messages: ChatMessage[], quote: string): Evidence[] {
  const q = normalise(quote.trim().replace(/^["'“‘]+|["'”’]+$/g, "").trim());
  if (q.length < 3) return [];
  const out: Evidence[] = [];
  for (const msg of messages) {
    // Build a normalised copy of the message with an index map back to raw offsets.
    const map: number[] = [];
    let norm = "";
    let prevSpace = false;
    for (let i = 0; i < msg.text.length; i++) {
      const c = msg.text[i];
      if (/\s/.test(c)) {
        if (prevSpace) continue;
        prevSpace = true;
        norm += " ";
      } else {
        prevSpace = false;
        norm += normalise(c);
      }
      map.push(i);
    }
    const idx = norm.indexOf(q);
    if (idx < 0) continue;
    const s = map[idx];
    const e = map[idx + q.length - 1] + 1;
    out.push(evidenceFor(msg, s, e));
  }
  // Reported messages overlap their quoting user message; prefer the reported span.
  return out.sort((a, b) => rank(a) - rank(b));
}

const RANK: Record<string, number> = { counterparty: 0, unknown: 1, reported: 2, user: 3 };
function rank(e: Evidence) {
  return RANK[e.speakerRole ?? "unknown"] ?? 4;
}

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export interface AmountMatch {
  value: number;
  index: number;
  length: number;
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7 };

/** Pulls rupee amounts from text: "₹18,500", "Rs. 2,499", "INR 5000", "₹1.5 lakh", "40,000 rupees". */
export function findAmountMatches(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  const re =
    /(?:(?:₹|\brs\.?|\binr)\s?([\d,]+(?:\.\d+)?)(?:\s?(k|thousand|lakhs?|lacs?|crores?|cr)\b)?|\b([\d,]+(?:\.\d+)?)(?:\s?(k|thousand|lakhs?|lacs?|crores?))?\s?(?:rupees|rs\b|inr\b|\/-))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = Number((m[1] ?? m[3]).replace(/,/g, ""));
    const unit = (m[2] ?? m[4])?.toLowerCase();
    const v = num * (unit ? MULT[unit] ?? 1 : 1);
    if (v > 0 && Number.isFinite(v)) out.push({ value: v, index: m.index, length: m[0].length });
  }
  return out;
}

export function findAmounts(text: string): number[] {
  return findAmountMatches(text).map((a) => a.value);
}

export const UPI_RE = /\b[a-z0-9][a-z0-9._-]{1,48}@[a-z][a-z0-9]{1,15}\b/gi;
export const ACCOUNT_RE = /\b(?:a\/c|acc(?:ount)?(?:\s?(?:no\.?|number|#))?)[\s:#.-]*(\d{9,18})\b/gi;
export const IFSC_RE = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
export const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+|\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|rb\.gy|cutt\.ly|is\.gd)\/[^\s<>"]+/gi;
export const PHONE_RE = /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g;
export const EMAIL_LIKE = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i;
