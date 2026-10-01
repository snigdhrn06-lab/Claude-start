import type { ChatMessage, Evidence, ExtractedEntity, PaymentDetails, SignalId } from "../types";
import { ACCOUNT_PROFILE, SIGNALS } from "./catalog";
import {
  ACCOUNT_RE,
  IFSC_RE,
  LINK_RE,
  PHONE_RE,
  UPI_RE,
  findAmounts,
  formatINR,
  parseConversation,
  sentenceAround,
} from "./parse";

export interface DetectedSignal {
  id: SignalId;
  /** 0–1 */
  confidence: number;
  evidence: Evidence[];
  explanation?: string;
}

const P: Partial<Record<SignalId, RegExp[]>> = {
  urgency: [
    /\bimmediately\b/i,
    /\burgent(?:ly)?\b/i,
    /\bright now\b/i,
    /\basap\b/i,
    /\bwithin \d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i,
    /\bin (?:the next )?\d+\s*(?:minutes?|mins?)\b/i,
    /\b(?:expires?|expiring) (?:today|tonight|in)\b/i,
    /\btoday itself\b/i,
    /\blast chance\b/i,
    /\bbefore \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
    /\bact now\b/i,
    /\bwithout delay\b/i,
    /\bcloses? tonight\b/i,
    /\bby (?:tonight|end of day|eod)\b/i,
  ],
  threat: [
    /\b(?:will be|be|get|is being|are) (?:frozen|blocked|suspended|deactivated|locked|closed|cancell?ed permanently)\b/i,
    /\bfreez(?:e|ing)\b/i,
    /\blegal action\b/i,
    /\bpenalt(?:y|ies)\b/i,
    /\b(?:police|arrest|fir)\b/i,
    /\bcancell?ed permanently\b/i,
    /\blose (?:access|your (?:money|funds|account))\b/i,
    /\bservice interruption\b/i,
  ],
  authority: [
    /\b(?:as per )?rbi (?:guidelines|rules|norms|directive)\b/i,
    /\breserve bank\b/i,
    /\bkyc (?:desk|cell|department|team|verification cell|update team)\b/i,
    /\b(?:verification|compliance|security) (?:cell|team|department|desk)\b/i,
    /\bbank (?:official|officer|executive|alerts?)\b/i,
    /\bsebi[- ]registered\b/i,
    /\bincome tax department\b/i,
    /\bcyber ?cell\b/i,
    /\bthis is [A-Z][a-z]+ [A-Z][a-z]+ from (?:the )?[A-Z]/,
    /\b(?:customer|support) (?:care|team|desk|executive)\b/i,
  ],
  guarantee: [
    /\bguarantee(?:d)?\b/i,
    /\bassured (?:returns?|profit)\b/i,
    /\brisk[- ]free\b/i,
    /\bzero loss\b/i,
    /\bcapital is (?:fully )?protected\b/i,
    /\b\d{2,3}% (?:monthly|weekly|daily) returns?\b/i,
    /\bdouble your\b/i,
  ],
  scarcity: [
    /\bonly \d+ (?:slots?|seats?|spots?)\b/i,
    /\blimited (?:slots?|seats?|spots?|window)\b/i,
    /\bwindow closes\b/i,
    /\binvite[- ]only\b/i,
    /\blast \d+ (?:slots?|seats?|spots?)\b/i,
  ],
  social_proof: [
    /\b[\d,]+\+? (?:members|investors|people) (?:have )?(?:already )?(?:earned|joined|invested)\b/i,
    /\bpayout screenshots?\b/i,
    /\bscreenshots? (?:of|from) (?:our )?(?:payouts?|profits?|group)\b/i,
    /\btestimonials?\b/i,
    /\beveryone in the group\b/i,
  ],
  refund: [/\brefund\b/i, /\bcash ?back\b/i, /\bcredited back\b/i, /\bmoney back\b/i],
  reversal: [
    /\bverification (?:transfer|payment|amount)\b/i,
    /\b(?:refundable|security) deposit\b/i,
    /\bwill be (?:credited back|refunded|returned|reversed)\b/i,
    /\breversal procedure\b/i,
    /\bpay(?:ing)? (?:to )?(?:receive|get) (?:the|your)\b/i,
    /\bapprove the (?:collect )?request\b/i,
  ],
  payment_request: [
    /\b(?:transfer|send|pay|deposit|remit)\s+(?:₹|rs\.?|inr)\s?[\d,]+/i,
    /\b(?:transfer|send|pay|deposit)\b[^.?!]{0,40}\b(?:to|into) (?:our|this|the following|my)\b/i,
    /\bminimum (?:entry|deposit|investment) is\b/i,
    /\btransfer to\b/i,
    /\bsend (?:the )?(?:amount|money)\b/i,
    /\bcomplete the payment\b/i,
  ],
  isolation: [
    /\bdo not (?:disconnect|discuss|tell|inform|share this)\b/i,
    /\bdon'?t (?:tell|discuss|inform)\b/i,
    /\bkeep (?:this|it) (?:confidential|secret|private|between us)\b/i,
    /\bconfidential\b/i,
  ],
  credentials: [
    /\botp\b/i,
    /\bupi pin\b/i,
    /\b(?:atm |card )?pin\b(?! ?code)/i,
    /\bcvv\b/i,
    /\bpassword\b/i,
    /\b(?:anydesk|teamviewer|quicksupport)\b/i,
    /\bscreen ?shar(?:e|ing)\b/i,
  ],
  escalation: [
    /\bupgrade to\b/i,
    /\b(?:processing|clearance|release|tax|gst) (?:fee|charge)\b/i,
    /\badditional (?:fee|charge|payment|amount)\b/i,
    /\banother (?:payment|transfer)\b/i,
    /\bone more (?:payment|transfer|step)\b/i,
    /\bsecond payment\b/i,
  ],
  emotional: [
    /\bdon'?t (?:worry|panic)\b/i,
    /\btrust me\b/i,
    /\bfor your (?:own )?(?:safety|security|benefit)\b/i,
    /\blife[- ]chang(?:ing|er)\b/i,
    /\bonce in a lifetime\b/i,
    /\bi(?:'m| am) (?:only )?(?:trying to )?help(?:ing)? you\b/i,
  ],
  verification: [
    /\bofficial (?:[A-Z][\w-]* )?(?:website|app|helpline|branch|channels?)\b/i,
    /\bcontact (?:our |the )?customer support\b/i,
    /\b(?:visit|call) (?:your|the|our) (?:nearest )?(?:home )?branch\b/i,
    /\bnumber (?:printed )?on (?:the back of )?your (?:card|passbook)\b/i,
    /\bnever (?:ask|asks|request)s? (?:for )?(?:your )?(?:otp|pin|password)\b/i,
    /\bverify independently\b/i,
  ],
};

/** Words that make a personal UPI handle look institutional. */
const INSTITUTIONAL_HANDLE = /(kyc|verify|verification|refund|support|helpdesk|care|reward|cashback|claim|settle)/i;

function isKnownBeneficiary(handle: string) {
  return ACCOUNT_PROFILE.knownBeneficiaries.includes(handle.toLowerCase());
}

function bump(map: Map<SignalId, DetectedSignal>, id: SignalId, ev: Evidence, extra = 0.035) {
  const existing = map.get(id);
  if (existing) {
    if (!existing.evidence.some((e) => e.start === ev.start && e.end === ev.end && e.text === ev.text)) {
      existing.evidence.push(ev);
      existing.confidence = Math.min(0.98, existing.confidence + extra);
    }
  } else {
    map.set(id, { id, confidence: SIGNALS[id].baseConfidence, evidence: [ev] });
  }
}

/**
 * Local perception layer: deterministic detectors over the conversation and
 * payment details. Produces the same shape an LLM perception would.
 */
export function detectLocal(conversation: string, payment?: PaymentDetails) {
  const messages = parseConversation(conversation);
  const inbound = messages.filter((m) => !m.self);
  const found = new Map<SignalId, DetectedSignal>();

  for (const msg of inbound) {
    for (const [id, patterns] of Object.entries(P) as [SignalId, RegExp[]][]) {
      for (const re of patterns) {
        const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        let m: RegExpExecArray | null;
        while ((m = g.exec(msg.text))) {
          bump(found, id, sentenceAround(msg, m.index, m.index + m[0].length));
          if (m[0].length === 0) g.lastIndex++;
        }
      }
    }
    // Institutional-looking sender name with a money conversation = authority claim.
    if (/(bank|kyc|support|care|official|rbi|alerts?|desk)/i.test(msg.sender) && !found.has("authority")) {
      bump(found, "authority", sentenceAround(msg, 0, Math.min(msg.text.length, 10)));
      const hasMoney = /(?:₹|rs\.?|inr)\s?\d|transfer|deposit|refund|account/i.test(msg.text);
      if (!hasMoney) found.get("authority")!.confidence = 0.7;
    }
  }

  // Beneficiary + channel analysis from the text.
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const addEntity = (e: ExtractedEntity) => {
    const k = e.type + ":" + e.value.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      entities.push(e);
    }
  };

  for (const msg of inbound) {
    const runs: [RegExp, (v: string, i: number, len: number) => void][] = [
      [
        new RegExp(UPI_RE.source, "gi"),
        (v, i, len) => {
          const known = isKnownBeneficiary(v);
          addEntity({ type: "recipient", value: v, flagged: !known, note: known ? "Saved beneficiary" : "Never paid before" });
          if (!known) {
            bump(found, "new_beneficiary", sentenceAround(msg, i, i + len));
            if (INSTITUTIONAL_HANDLE.test(v.split("@")[0])) {
              bump(found, "unofficial_channel", sentenceAround(msg, i, i + len));
            }
          }
        },
      ],
      [
        new RegExp(ACCOUNT_RE.source, "gi"),
        (v, i, len) => {
          addEntity({ type: "account", value: v.replace(/^\D+/, "A/C "), flagged: true, note: "Private account" });
          bump(found, "new_beneficiary", sentenceAround(msg, i, i + len));
          bump(found, "unofficial_channel", sentenceAround(msg, i, i + len));
        },
      ],
      [
        new RegExp(LINK_RE.source, "gi"),
        (v, i, len) => {
          addEntity({ type: "link", value: v, flagged: true, note: "Link supplied by sender" });
          bump(found, "unofficial_channel", sentenceAround(msg, i, i + len));
        },
      ],
      [
        new RegExp(PHONE_RE.source, "g"),
        (v) => addEntity({ type: "phone", value: v, flagged: true, note: "Contact supplied by sender" }),
      ],
      [new RegExp(IFSC_RE.source, "g"), (v) => addEntity({ type: "account", value: "IFSC " + v })],
    ];
    for (const [re, fn] of runs) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(msg.text))) fn(m[0], m.index, m[0].length);
    }
  }

  // Sender identity / organisations.
  for (const msg of inbound) {
    if (msg.sender !== "Unknown sender") addEntity({ type: "organization", value: msg.sender, note: "Claimed identity" });
    const person = /this is ([A-Z][a-z]+ [A-Z][a-z]+)/.exec(msg.text);
    if (person) addEntity({ type: "person", value: person[1], note: "Claimed agent" });
  }

  // Amounts.
  const amounts = inbound.flatMap((m) => findAmounts(m.text));
  for (const a of amounts) addEntity({ type: "amount", value: formatINR(a), flagged: a > ACCOUNT_PROFILE.typicalOutgoing * 3 });

  // Deadlines.
  for (const msg of inbound) {
    const d = /(within \d+\s*(?:minutes?|mins?)|in the next \d+ minutes|before \d{1,2}(?::\d{2})?\s*(?:am|pm)(?: today)?|tonight at \d{1,2}(?::\d{2})?\s*(?:am|pm)|in \d+ minutes|expires? today)/i.exec(msg.text);
    if (d && !/(credited|refunded|returned|back)/i.test(msg.text.slice(Math.max(0, d.index - 40), d.index)))
      addEntity({ type: "deadline", value: d[0], flagged: true });
  }
  if (found.has("credentials")) {
    for (const ev of found.get("credentials")!.evidence) {
      const c = /(otp|upi pin|pin|cvv|password|anydesk|teamviewer|screen ?shar\w*)/i.exec(ev.text);
      if (c) addEntity({ type: "credential", value: c[0].toUpperCase(), flagged: true, note: "Never share" });
    }
  }

  // Payment fields (transaction context).
  if (payment) {
    const pe = (text: string): Evidence => ({ text, start: -1, end: -1, source: "payment" });
    if (payment.recipient) {
      const handle = payment.recipient.trim();
      const known = isKnownBeneficiary(handle);
      addEntity({ type: "recipient", value: handle, flagged: !known, note: known ? "Saved beneficiary" : "Never paid before" });
      if (!known) {
        bump(found, "new_beneficiary", pe(`Recipient ${handle} has no payment history on this account.`));
        if (INSTITUTIONAL_HANDLE.test(handle.split("@")[0])) {
          bump(found, "unofficial_channel", pe(`${handle} is a personal UPI handle styled as an institutional service.`));
        }
      }
    }
    if (payment.amount > 0) {
      addEntity({ type: "amount", value: formatINR(payment.amount), flagged: payment.amount > ACCOUNT_PROFILE.typicalOutgoing * 3 });
      if (payment.amount > ACCOUNT_PROFILE.typicalOutgoing * 3) {
        const x = (payment.amount / ACCOUNT_PROFILE.typicalOutgoing).toFixed(1);
        const ev = pe(`${formatINR(payment.amount)} is ${x}× this account's typical outgoing payment (${formatINR(ACCOUNT_PROFILE.typicalOutgoing)}).`);
        bump(found, "amount_anomaly", ev);
        const a = found.get("amount_anomaly")!;
        a.confidence = Math.min(0.95, 0.6 + Math.log10(payment.amount / ACCOUNT_PROFILE.typicalOutgoing) * 0.3);
      }
    }
    if (payment.method) addEntity({ type: "payment_method", value: payment.method });
    if (payment.reason && /(kyc|verification|refund|deposit|unlock|release|fee|penalty|investment|returns?)/i.test(payment.reason)) {
      bump(found, "payment_request", pe(`Stated reason "${payment.reason}" is not a normal reason to pay a stranger.`));
    }
  } else if (amounts.length && found.has("payment_request")) {
    const max = Math.max(...amounts);
    if (max > ACCOUNT_PROFILE.typicalOutgoing * 3) {
      const ev = found.get("payment_request")!.evidence[0];
      bump(found, "amount_anomaly", ev);
      found.get("amount_anomaly")!.confidence = Math.min(0.95, 0.6 + Math.log10(max / ACCOUNT_PROFILE.typicalOutgoing) * 0.3);
    }
  }

  // A promised fast refund ("credited back within 2 hours") is bait, not a deadline.
  const urgent = found.get("urgency");
  if (urgent) {
    const kept = urgent.evidence.filter((e) => !/(credited back|will be (?:refunded|returned|reversed))/i.test(e.text));
    if (!kept.length) found.delete("urgency");
    else if (kept.length < urgent.evidence.length) {
      urgent.confidence -= 0.035 * (urgent.evidence.length - kept.length);
      urgent.evidence = kept;
    }
  }

  // Ultimatum structure: a deadline and a threat in the same sentence ("pay now or be frozen").
  const urg = found.get("urgency");
  const thr = found.get("threat");
  if (urg && thr) {
    const shared = urg.evidence.some((u) => thr.evidence.some((t) => t.start === u.start && t.end === u.end));
    if (shared) {
      urg.confidence = Math.min(0.98, urg.confidence + 0.06);
      thr.confidence = Math.min(0.98, thr.confidence + 0.06);
    }
  }

  // An imperative with an explicit amount is a stronger payment instruction than a vague ask.
  const pr = found.get("payment_request");
  if (pr && pr.evidence.some((e) => /(transfer|send|pay|deposit)\s+(?:₹|rs\.?|inr)\s?[\d,]+/i.test(e.text))) {
    pr.confidence = Math.min(0.98, pr.confidence + 0.05);
  }

  // Coercive payment ultimatum: the money instruction itself carries the deadline and the threat.
  const payReq = found.get("payment_request");
  if (payReq && urg && thr) {
    const same = (a: Evidence, b: Evidence) => a.start === b.start && a.end === b.end;
    const coercive = payReq.evidence.some((p) => urg.evidence.some((u) => same(p, u)) && thr.evidence.some((t) => same(p, t)));
    if (coercive) payReq.confidence = Math.min(0.98, payReq.confidence + 0.05);
  }

  // A refund conversation with a payment instruction implies pay-to-receive.
  if (found.has("refund") && found.has("payment_request") && !found.has("reversal")) {
    const ev = found.get("payment_request")!.evidence[0];
    bump(found, "reversal", ev);
    found.get("reversal")!.confidence = 0.8;
  }
  // Refund is only a manipulation when money is requested; otherwise drop it.
  if (found.has("refund") && !found.has("payment_request") && !found.has("reversal")) found.delete("refund");

  return { messages, signals: [...found.values()], entities };
}

export type LocalDetection = ReturnType<typeof detectLocal>;
export type { ChatMessage };
