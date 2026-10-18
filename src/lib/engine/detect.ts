import type { ChatMessage, Evidence, ExtractedEntity, PaymentDetails, RejectedEvidence, SignalId, AccountContextInput } from "../types";
import { SIGNALS } from "./catalog";
import { contextProvider, type AccountContextProvider } from "./context";
import {
  ACCOUNT_RE,
  IFSC_RE,
  LINK_RE,
  PHONE_RE,
  UPI_RE,
  findAmountMatches,
  formatINR,
  isAnalysable,
  parseConversation,
  sentenceAround,
} from "./parse";

export interface DetectedSignal {
  id: SignalId;
  /** 0–1 evidence strength. Not a probability of fraud. */
  confidence: number;
  evidence: Evidence[];
  explanation?: string;
}

interface Pattern {
  re: RegExp;
  /** Evidence strength for this pattern (defaults to the catalogue's baseConfidence). */
  strength?: number;
}

/** Words that, earlier in the same clause, invert a request ("we will NEVER ask for your OTP"). */
const NEGATOR = /\b(?:never|not|no|don'?t|do not|doesn'?t|does not|won'?t|will not|cannot|can'?t|nobody|no one|without)\b/i;
/** A sentence that describes what scammers do ("scammers may ask you to transfer money") is not itself a request. */
const DESCRIPTIVE = /\b(?:scammers?|fraudsters?|criminals?|cheats?|imposters?|impostors?)\b[^.?!\n]{0,60}\b(?:may|might|could|often|usually|sometimes|will|can|pretend|claim|say|ask)\b/i;
/** Signals whose patterns describe a request/claim that a negator cancels. */
const NEGATABLE = new Set<SignalId>(["credentials", "payment_request", "urgency", "threat", "guarantee", "reversal", "scarcity", "identity_change", "windfall"]);

const REQ_VERB = "(?:share|send|tell|give|provide|forward|read(?: out| back)?|confirm|type|say|sms|whatsapp|repeat|enter|reply with|respond with|send back|text)";
const SECRET = "(?:otp|one[- ]time (?:password|code)|upi pin|m-?pin|atm pin|card pin|pin\\b(?! ?code)|cvv|password|passcode|verification code|security code|(?:six|6|four|4)[- ]digit (?:number|code)|net ?banking (?:password|credentials|login)|card (?:number|details))";
const REMOTE_APP = "(?:anydesk|any desk|teamviewer|quick ?support|rustdesk|airdroid|screen ?share app)";

const P: Partial<Record<SignalId, Pattern[]>> = {
  urgency: [
    { re: /\bimmediately\b/i },
    { re: /\burgent(?:ly)?\b/i, strength: 0.78 },
    { re: /\bright now\b/i },
    { re: /\basap\b/i },
    { re: /\bwithin (?:the next )?\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i, strength: 0.9 },
    { re: /\bin (?:the )?(?:next )?\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i, strength: 0.88 },
    { re: /\b(?:now|today|tonight) or (?:else )?(?:your|you|the|it|i|we)\b/i, strength: 0.85 },
    { re: /\b(?:expires?|expiring|lapses?|will lapse) (?:today|tonight|in|soon)\b/i },
    { re: /\btoday itself\b/i },
    { re: /\blast chance\b/i },
    { re: /\bbefore \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i, strength: 0.8 },
    { re: /\bact (?:now|fast|quickly)\b/i },
    { re: /\bwithout (?:any )?delay\b/i },
    { re: /\bcloses? tonight\b/i },
    { re: /\bby (?:tonight|end of (?:the )?day|eod)\b/i, strength: 0.75 },
    { re: /\b(?:otherwise|or else) the (?:refund|request|offer) (?:will )?(?:lapse|expire|be cancell?ed)/i },
  ],
  threat: [
    { re: /\b(?:will be|be|get|gets|is being|are being|has been|have been) (?:permanently )?(?:frozen|blocked|suspended|deactivated|locked|closed|disconnected|cancell?ed permanently)\b/i },
    { re: /\bfreez(?:e|ing)\b/i, strength: 0.8 },
    { re: /\blegal action\b/i },
    { re: /\bpenalt(?:y|ies)\b/i, strength: 0.75 },
    { re: /\b(?:arrest(?:ed)?|warrant|fir (?:will be|has been)|digital arrest)\b/i, strength: 0.9 },
    { re: /\bpolice (?:case|complaint|will)\b/i, strength: 0.88 },
    { re: /\bcancell?ed permanently\b/i },
    { re: /\blose (?:access|your (?:money|funds|account|savings))\b/i },
    { re: /\b(?:service|electricity|power|connection) (?:will be )?(?:interrupted|disconnected|cut)\b/i },
    { re: /\b(?:or|otherwise) (?:i|we)(?:'ll| will)? (?:send|share|post|leak|publish|expose|forward) (?:them|it|the|your|these)\b/i, strength: 0.9 },
    { re: /\bconfiscated\b/i, strength: 0.8 },
  ],
  authority: [
    { re: /\b(?:as per )?rbi (?:guidelines|rules|norms|directives?|circular)\b/i },
    { re: /\breserve bank\b/i },
    { re: /\bkyc (?:desk|cell|department|team|verification cell|update team)\b/i },
    { re: /\b(?:verification|compliance|security|fraud|risk) (?:cell|team|department|desk)\b/i },
    { re: /\bbank (?:official|officer|executive|manager|alerts?)\b/i },
    { re: /\bsebi[- ]registered\b/i },
    { re: /\b(?:income tax|customs|narcotics|cyber ?crime) (?:department|officer|cell|bureau)\b/i },
    { re: /\bcyber ?cell\b/i },
    { re: /\b(?:calling|writing|messaging) (?:you )?from (?:the )?[A-Za-z ]{0,30}(?:bank|police|department|customs|courier|telecom|trai|electricity|board)\b/i },
    { re: /\bthis is [A-Z][a-z]+ [A-Z][a-z]+ from (?:the )?[A-Z]/ },
    { re: /\b(?:customer|support) (?:care|team|desk|executive)\b/i, strength: 0.7 },
  ],
  guarantee: [
    { re: /\bguarantee(?:d|s)?\s+(?:\d+(?:\.\d+)?\s?%|returns?|profits?|income|payouts?|earnings|gains)\b/i },
    { re: /\b(?:returns?|profits?|income|payouts?) (?:are |is )?(?:100% )?guaranteed\b/i },
    { re: /\bassured (?:returns?|profits?|income)\b/i },
    { re: /\brisk[- ]free\b/i, strength: 0.8 },
    { re: /\bzero (?:loss|risk)\b/i },
    { re: /\bcapital is (?:fully |100% )?(?:protected|safe)\b/i },
    { re: /\b\d{1,3}(?:\.\d+)?\s?% (?:monthly|weekly|daily|per (?:month|week|day)) (?:returns?|profits?|income)\b/i },
    { re: /\bdouble your (?:money|investment|capital)\b/i },
    { re: /\bfixed (?:daily|weekly|monthly) (?:income|returns?|profits?)\b/i },
  ],
  scarcity: [
    { re: /\bonly \d+ (?:slots?|seats?|spots?|places?)\b/i },
    { re: /\blimited (?:slots?|seats?|spots?|window|period offer)\b/i },
    { re: /\bwindow closes\b/i },
    { re: /\binvite[- ]only\b/i },
    { re: /\blast \d+ (?:slots?|seats?|spots?)\b/i },
  ],
  social_proof: [
    { re: /\b[\d,]+\+? (?:members|investors|people|users|customers) (?:have )?(?:already )?(?:earned|joined|invested|made)\b/i },
    { re: /\bpayout screenshots?\b/i },
    { re: /\bscreenshots? (?:of|from) (?:our )?(?:payouts?|profits?|group|members)\b/i },
    { re: /\btestimonials?\b/i, strength: 0.7 },
    { re: /\beveryone in the group\b/i },
  ],
  refund: [{ re: /\brefund\b/i }, { re: /\bcash ?back\b/i }, { re: /\bcredited back\b/i }, { re: /\bmoney back\b/i }],
  reversal: [
    { re: /\bverification (?:transfer|payment|amount|fee)\b/i },
    { re: /\brefundable (?:security )?deposit\b/i },
    { re: /\bsecurity deposit\b[^.?!\n]{0,60}\b(?:refund|return|credited back|verification|verify|kyc|unlock)/i },
    { re: /\b(?:deposit|pay|send|invest|top up)\b[^.?!\n]{0,30}\b(?:and|to) (?:get|receive|earn) (?:₹|rs\.?|inr|\d)/i, strength: 0.86 },
    { re: /\breversal (?:procedure|process)\b/i },
    { re: /\bpay(?:ing)? (?:to )?(?:receive|get|claim) (?:the|your)\b/i },
    { re: /\bto (?:receive|get|claim) (?:the |your )?(?:refund|money|amount|payment|prize|cashback)\b[^.?!\n]{0,40}\b(?:approve|pay|send|enter|scan)\b/i },
    { re: /\bapprove the (?:collect |payment |upi )?request\b/i, strength: 0.84 },
    { re: /\benter (?:your )?(?:upi )?pin\b[^.?!\n]{0,30}\b(?:receive|get|claim|refund|credit|cashback)\b/i, strength: 0.9 },
  ],
  payment_request: [
    { re: /\b(?:transfer|send|pay|deposit|remit)\s+(?:me\s+|us\s+)?(?:₹|rs\.?|inr)\s?[\d,]+/i, strength: 0.9 },
    { re: /\b(?:transfer|send|pay|deposit)\b[^.?!\n]{0,40}\b(?:to|into|on)\s+(?:our|this|the following|my|the below|below)\b/i },
    { re: /\b(?:transfer|send|pay|deposit)\b[^.?!\n]{0,40}\bto\s+[a-z0-9._-]+@[a-z]+\b/i, strength: 0.88 },
    { re: /\bminimum (?:entry|deposit|investment) is\b/i },
    { re: /\btransfer to\b/i },
    { re: /\b(?:send|transfer|pay) (?:the |this )?(?:amount|money|fee|charges?|deposit|balance)\b/i },
    { re: /\b(?:complete|make) (?:the |a )?payment\b/i, strength: 0.78 },
    { re: /\bscan (?:the |this )?qr\b/i, strength: 0.8 },
    { re: /\bcan you (?:please )?(?:send|transfer|pay)\b/i, strength: 0.82 },
    { re: /\bplease pay\b/i, strength: 0.8 },
    { re: /\b(?:pay|transfer|send|deposit|remit)\b[^.?!\n]{0,40}(?:₹|\brs\.?\s?|\binr\s?)\d/i, strength: 0.86 },
    { re: /\b(?:transfer|send|pay|deposit|move)\b[^.?!\n]{0,50}\bto\s+(?:the\s+)?(?:[a-z]+\s+){0,3}(?:account|a\/c|wallet|upi id)\b/i, strength: 0.85 },
    { re: /\b(?:must|need to|have to|should) (?:first )?(?:pay|transfer|deposit|send)\b/i, strength: 0.8 },
    { re: /\b(?:my|our) (?:upi(?: id)?|gpay|phonepe|paytm|account(?: number)?|a\/c|bank details?) (?:is|are|:)/i, strength: 0.75 },
    { re: /\bhere(?:'s| is) (?:my |the |his |her )?(?:friend'?s )?(?:upi(?: id)?|handle|account|a\/c|qr)\b/i, strength: 0.75 },
    { re: /\b(?:help|lend) (?:me )?with (?:₹|rs\.?\s?)?\d[\d,]*\s?(?:k|thousand|lakhs?)?\b/i, strength: 0.75 },
    { re: /\b(?:remit|purchase|buy)\b[^.?!\n]{0,40}\b(?:₹|rs\.?|inr|rupees|amount|fee)\b/i, strength: 0.75 },
    { re: /\btop up\b[^.?!\n]{0,20}\b(?:₹|rs\.?|\d)/i, strength: 0.75 },
  ],
  isolation: [
    { re: /\bdo not (?:disconnect|discuss|tell|inform)\b/i },
    { re: /\bdon'?t (?:tell|discuss|inform|mention)\b/i },
    { re: /\bkeep (?:this|it) (?:confidential|secret|private|between us)\b/i },
    { re: /\bstay on the (?:call|line)\b/i, strength: 0.75 },
    { re: /\b(?:don'?t|do not) (?:call|contact|visit) (?:the |your )?(?:bank|branch|police)\b/i, strength: 0.88 },
  ],
  credentials: [
    { re: new RegExp(`\\b${REQ_VERB}\\b[^.?!\\n]{0,40}\\b${SECRET}`, "i"), strength: 0.92 },
    { re: new RegExp(`\\b${SECRET}[^.?!\\n]{0,40}\\b(?:you (?:will )?(?:receive|received|got|get)|sent to your|to your (?:number|phone|mobile)|on your (?:phone|mobile)|that (?:just )?(?:came|comes|arrived))`, "i"), strength: 0.9 },
    { re: /\b(?:read|tell|share|forward|give|send|say)\b[^.?!\n]{0,20}\bcode\b[^.?!\n]{0,30}\b(?:sent to|you (?:received|got|get)|came|arrived|on your|to your)\b/i, strength: 0.88 },
    // USSD call-forwarding codes divert calls/OTPs to the attacker.
    { re: /\bdial\s*\*(?:21|401|61|62|67|004)\*/i, strength: 0.9 },
    { re: new RegExp(`\\b(?:install|download|open|use)\\b[^.?!\\n]{0,30}\\b${REMOTE_APP}`, "i"), strength: 0.93 },
    { re: new RegExp(`\\b${REMOTE_APP}\\b`, "i"), strength: 0.8 },
    { re: /\b(?:share|start) (?:your )?screen\b/i, strength: 0.88 },
  ],
  escalation: [
    { re: /\bupgrade to\b/i },
    { re: /\b(?:processing|clearance|release|withdrawal|tax|gst|activation|registration|training|joining|customs|handling|documentation|redelivery|renewal) (?:and \w+ )?(?:fee|charge)s?\b/i },
    { re: /\badditional (?:fee|charge|payment|amount)\b/i },
    { re: /\banother (?:payment|transfer)\b/i },
    { re: /\bone more (?:payment|transfer)\b/i },
    { re: /\bsecond payment\b/i },
    { re: /\bto withdraw (?:your )?(?:profits?|funds|money|earnings)\b[^.?!\n]{0,40}\b(?:pay|fee|tax|deposit)\b/i },
  ],
  emotional: [
    { re: /\bdon'?t (?:worry|panic)\b/i },
    { re: /\btrust me\b/i },
    { re: /\bfor your (?:own )?(?:safety|security|benefit)\b/i },
    { re: /\blife[- ]chang(?:ing|er)\b/i },
    { re: /\bonce in a lifetime\b/i },
    { re: /\bi(?:'m| am) (?:only )?(?:trying to )?help(?:ing)? you\b/i },
  ],
  identity_change: [
    { re: /\b(?:this is my|my|got a|i have a|using a|from my) new (?:number|phone|whatsapp|account|sim)\b/i },
    { re: /\b(?:lost|broke|changed) my (?:phone|sim|number)\b/i, strength: 0.75 },
    { re: /\bsave this (?:new )?number\b/i, strength: 0.8 },
  ],
  windfall: [
    { re: /you(?:'ve| have)? won\b/i },
    { re: /(?:lucky draw|lottery|jackpot)\b/i },
    { re: /\byou (?:are|have been) (?:selected|shortlisted) for\b/i, strength: 0.75 },
    { re: /\b(?:loan|credit)\b[^.?!\n]{0,40}\b(?:sanctioned|pre-?approved|approved and ready)\b/i, strength: 0.78 },
    { re: /\bpre-?approved loan\b/i, strength: 0.78 },
    { re: /\b(?:bonus|prize|reward|gift)\b[^.?!\n]{0,30}\b(?:is ready|has arrived|waiting|ready to be released)\b/i, strength: 0.8 },
    { re: /\bgift parcel\b/i },
  ],
  verification: [
    { re: /\bofficial (?:[A-Z][\w-]* )?(?:website|app|helpline|branch|channels?|customer care number)\b/i },
    { re: /\bcontact (?:our |the )?customer support\b/i, strength: 0.7 },
    { re: /\b(?:visit|call) (?:your|the|our) (?:nearest )?(?:home )?branch\b/i },
    { re: /\bnumber (?:printed )?on (?:the back of )?your (?:card|passbook)\b/i, strength: 0.9 },
    { re: /\bnever (?:ask|asks|request|requests) (?:you )?(?:for |to share )?(?:your )?(?:otp|pin|password|cvv)\b/i, strength: 0.9 },
    { re: /\b(?:do not|don'?t|never) share (?:your |this |the )?(?:otp|pin|cvv|password)\b/i, strength: 0.85 },
    { re: /\bverify (?:it )?independently\b/i },
    { re: /\bcheck (?:the )?(?:status )?(?:in|on) (?:the |your )?(?:official )?(?:[A-Z][\w-]* )?app\b/i, strength: 0.75 },
    { re: /\b(?:retried|returned|refunded) automatically to your original (?:payment )?(?:method|source)\b/i, strength: 0.88 },
  ],
};

/** Refund promises ("will be credited back"): pay-to-receive evidence only when the conversation also asks for money. */
const REVERSAL_PROMISE: Pattern[] = [{ re: /\bwill be (?:credited back|refunded|returned|reversed)\b/i }, { re: /\bcredited back (?:with|along)\b/i }];

/** UPI local parts named like a service desk rather than a person or merchant. */
const INSTITUTIONAL_TOKENS = new Set(["kyc", "verify", "verification", "refund", "refunds", "support", "helpdesk", "care", "customercare", "reward", "rewards", "cashback", "claim", "claims", "settle", "settlement", "desk", "official", "govt", "rbi", "update", "unblock", "unlock"]);
/** True if a UPI local part contains a service-desk token ("verify-kyc", "refunds.shop") rather than a person or merchant name. */
function institutionalHandle(local: string) {
  return local.toLowerCase().split(/[^a-z]+/).some((t) => INSTITUTIONAL_TOKENS.has(t));
}
const INSTITUTIONAL_SENDER = /\b(bank|kyc|support|care|official|rbi|alerts?|desk|customer service|helpdesk|police|cyber|income tax|tax dept|customs|courier|electricity|power board|trai|sebi|npci|govt|department|bureau|officer|inspector|telecom|insurance)\b/i;

function negated(text: string, matchIndex: number) {
  // Look back to the start of the clause (bounded), and ask whether a negator governs the match.
  const lookback = text.slice(Math.max(0, matchIndex - 60), matchIndex);
  const clause = lookback.split(/[,;:.!?\n]|\bbut\b|\bhowever\b/i).pop() ?? "";
  // "If you do not pay ₹5,000 …" / "unless you send …" is a conditional ultimatum, not a negation.
  if (/\b(?:if|unless|in case)\b[^]*\b(?:do not|don'?t|fail to|not)\b/i.test(clause)) return false;
  return NEGATOR.test(clause);
}

function sameRange(a: Evidence, b: Evidence) {
  return a.start === b.start && a.end === b.end && a.text === b.text;
}

class SignalSet {
  map = new Map<SignalId, DetectedSignal>();
  add(id: SignalId, ev: Evidence, strength?: number, extra = 0.03) {
    const base = strength ?? SIGNALS[id].baseConfidence;
    const existing = this.map.get(id);
    if (!existing) {
      this.map.set(id, { id, confidence: base, evidence: [ev] });
      return;
    }
    if (existing.evidence.some((e) => sameRange(e, ev))) {
      existing.confidence = Math.max(existing.confidence, base);
      return;
    }
    existing.evidence.push(ev);
    // Additional independent excerpts strengthen the signal slightly, bounded.
    existing.confidence = Math.min(0.97, Math.max(existing.confidence, base) + extra);
  }
  get(id: SignalId) {
    return this.map.get(id);
  }
  has(id: SignalId) {
    return this.map.has(id);
  }
  delete(id: SignalId) {
    this.map.delete(id);
  }
}

export interface LocalDetection {
  messages: ChatMessage[];
  signals: DetectedSignal[];
  entities: ExtractedEntity[];
  rejected: RejectedEvidence[];
  context: AccountContextProvider;
  /** The payee Sentinel assessed: payment field, else the handle/account the other party supplied. */
  recipient?: string;
  /** The amount at stake: payment field, else the largest amount the other party asked for. */
  amount: number;
}

/** Runs the pattern detectors for one signal over a message. Used for LLM corroboration too. */
export function patternMatches(id: SignalId, text: string): boolean {
  for (const p of [...(P[id] ?? []), ...(id === "reversal" ? REVERSAL_PROMISE : [])]) {
    const g = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      if (!(NEGATABLE.has(id) && negated(text, m.index))) return true;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return false;
}

/**
 * Local perception layer: deterministic detectors over the conversation and
 * payment details. Only text attributable to someone other than the user is
 * used as evidence of manipulation.
 */
export function detectLocal(conversation: string, payment?: PaymentDetails, accountContext?: AccountContextInput): LocalDetection {
  const messages = parseConversation(conversation);
  const analysable = messages.filter(isAnalysable);
  const ctx = contextProvider(accountContext);
  const found = new SignalSet();
  const rejected: RejectedEvidence[] = [];

  for (const msg of analysable) {
    for (const [id, patterns] of Object.entries(P) as [SignalId, Pattern[]][]) {
      for (const p of patterns) {
        const g = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
        let m: RegExpExecArray | null;
        while ((m = g.exec(msg.text))) {
          const ev = sentenceAround(msg, m.index, m.index + m[0].length);
          if (!SIGNALS[id].mitigating && DESCRIPTIVE.test(ev.text)) {
            rejected.push({ signalId: id, text: ev.text, reason: "The sentence describes what scammers do; it is not itself a request." });
          } else if (NEGATABLE.has(id) && negated(msg.text, m.index)) {
            rejected.push({ signalId: id, text: ev.text, reason: `Negated (“${m[0]}” appears in a negative statement).` });
          } else {
            found.add(id, { ...ev, support: "pattern" }, p.strength);
          }
          if (m[0].length === 0) g.lastIndex++;
        }
      }
    }
    // An institutional-looking sender label is itself a claim of authority.
    if (msg.labelled && msg.role === "counterparty" && INSTITUTIONAL_SENDER.test(msg.sender) && !found.has("authority")) {
      found.add("authority", { ...sentenceAround(msg, 0, Math.min(msg.text.length, 10)), support: "rule" }, 0.72);
      const a = found.get("authority")!;
      a.explanation = `The sender is labelled “${msg.sender}”, presenting itself as an institution. The label alone cannot be verified.`;
    }
  }

  if (found.has("payment_request")) {
    for (const msg of analysable) {
      for (const p of REVERSAL_PROMISE) {
        const m = new RegExp(p.re.source, "i").exec(msg.text);
        if (m && !negated(msg.text, m.index)) found.add("reversal", { ...sentenceAround(msg, m.index, m.index + m[0].length), support: "pattern" }, p.strength);
      }
    }
  }

  // Signals found only in user-reported quotes are slightly discounted: the user's paraphrase may be imperfect.
  for (const s of found.map.values()) {
    if (s.evidence.every((e) => e.speakerRole === "reported")) s.confidence *= 0.85;
  }

  // ── Entities ────────────────────────────────────────────────────────────
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const addEntity = (e: ExtractedEntity) => {
    const k = e.type + ":" + e.value.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      entities.push(e);
    }
  };
  const handles: { value: string; ev: Evidence }[] = [];
  const accounts: { value: string; ev: Evidence }[] = [];
  const authorityClaimed = () => found.has("authority");

  for (const msg of analysable) {
    const role = msg.role;
    let m: RegExpExecArray | null;
    const upi = new RegExp(UPI_RE.source, "gi");
    while ((m = upi.exec(msg.text))) {
      // "name@gmail.com" is an email, not a UPI handle.
      if (/^\.[a-z]{2,}/i.test(msg.text.slice(m.index + m[0].length))) continue;
      handles.push({ value: m[0], ev: sentenceAround(msg, m.index, m.index + m[0].length) });
      addEntity({ type: "recipient", value: m[0], flagged: true, note: "Payment handle supplied in the conversation (unverified)", source: "conversation", speakerRole: role });
    }
    const acct = new RegExp(ACCOUNT_RE.source, "gi");
    while ((m = acct.exec(msg.text))) {
      accounts.push({ value: m[1], ev: sentenceAround(msg, m.index, m.index + m[0].length) });
      addEntity({ type: "account", value: "A/C " + m[1], flagged: true, note: "Bank account supplied in the conversation (unverified)", source: "conversation", speakerRole: role });
    }
    const link = new RegExp(LINK_RE.source, "gi");
    while ((m = link.exec(msg.text))) {
      const v = m[0].replace(/[).,;!?]+$/, "");
      const risky = /(bit\.ly|tinyurl|t\.me|wa\.me|rb\.gy|cutt\.ly|is\.gd|\.apk\b)/i.test(v);
      addEntity({ type: "link", value: v, flagged: true, note: risky ? "Shortened / messaging-app link from the sender" : "Link supplied by the sender (unverified)", source: "conversation", speakerRole: role });
      if (risky) found.add("unofficial_channel", { ...sentenceAround(msg, m.index, m.index + m[0].length), support: "rule" }, 0.75);
    }
    const phone = new RegExp(PHONE_RE.source, "g");
    while ((m = phone.exec(msg.text))) addEntity({ type: "phone", value: m[0], flagged: true, note: "Contact number supplied by the sender (unverified)", source: "conversation", speakerRole: role });
    const ifsc = new RegExp(IFSC_RE.source, "g");
    while ((m = ifsc.exec(msg.text))) addEntity({ type: "account", value: "IFSC " + m[0], source: "conversation", speakerRole: role });
    if (msg.labelled && role === "counterparty") addEntity({ type: "organization", value: msg.sender, note: "Claimed identity (sender label)", source: "conversation", speakerRole: role });
    const person = /\b(?:this is|i am|i'm|my name is) ([A-Z][a-z]+ [A-Z][a-z]+)\b/.exec(msg.text);
    if (person) addEntity({ type: "person", value: person[1], note: "Claimed name (unverified)", source: "conversation", speakerRole: role });
    const d = /(within \d+\s*(?:minutes?|mins?|hours?)|in the next \d+ minutes|before \d{1,2}(?::\d{2})?\s*(?:am|pm)(?: today)?|tonight at \d{1,2}(?::\d{2})?\s*(?:am|pm)|in \d+ minutes|expires? today|by (?:tonight|end of day))/i.exec(msg.text);
    if (d && !/(credited|refunded|returned|back)\s*$/i.test(msg.text.slice(Math.max(0, d.index - 30), d.index)))
      addEntity({ type: "deadline", value: d[0], flagged: true, source: "conversation", speakerRole: role });
  }

  // Amounts the other party mentioned. Only those inside a payment instruction count as "requested".
  const askedAmounts: number[] = [];
  const payEv = found.get("payment_request")?.evidence ?? [];
  const revEv = found.get("reversal")?.evidence ?? [];
  for (const msg of analysable) {
    for (const a of findAmountMatches(msg.text)) {
      const abs = msg.offset + a.index;
      const inAsk = [...payEv, ...revEv].some((e) => e.start <= abs && abs < e.end);
      if (inAsk) askedAmounts.push(a.value);
      addEntity({ type: "amount", value: formatINR(a.value), note: inAsk ? "Amount requested" : "Amount mentioned", source: "conversation", speakerRole: msg.role });
    }
  }

  // Credentials requested.
  for (const ev of found.get("credentials")?.evidence ?? []) {
    const c = new RegExp(`${SECRET}|${REMOTE_APP}|screen`, "i").exec(ev.text);
    if (c) addEntity({ type: "credential", value: c[0].toUpperCase(), flagged: true, note: "Requested — never share", source: "conversation", speakerRole: ev.speakerRole });
  }

  // ── Recipient & transaction context ─────────────────────────────────────
  const pe = (text: string, source: Evidence["source"] = "payment"): Evidence => ({ text, start: -1, end: -1, source, kind: "context", support: "rule" });
  // The payee: explicit payment field first; else the handle/account the other party asked the user to pay.
  const askRanges = [...payEv, ...revEv];
  const inAskRange = (ev: Evidence) => askRanges.some((r) => r.messageIndex === ev.messageIndex);
  const destFromChat = handles.find((h) => inAskRange(h.ev)) ?? accounts.find((a) => inAskRange(a.ev)) ?? (askRanges.length ? handles[0] ?? accounts[0] : undefined);
  const recipient = payment?.recipient?.trim() || destFromChat?.value;
  const recipientEv: Evidence | undefined = payment?.recipient?.trim()
    ? pe(`Payment recipient entered: ${payment.recipient.trim()}`)
    : destFromChat?.ev;

  if (payment?.recipient?.trim()) addEntity({ type: "recipient", value: payment.recipient.trim(), source: "payment" });

  if (recipient) {
    const look = ctx.lookupBeneficiary(recipient);
    const where = ctx.mode === "demo" ? "the synthetic demo profile's saved recipients" : "the saved recipients you supplied";
    const ent = entities.find((e) => (e.type === "recipient" || e.type === "account") && e.value.toLowerCase().includes(recipient.toLowerCase()));
    if (look.status === "known") {
      found.add("known_beneficiary", pe(`${recipient} is in ${where}.`, "account_context"));
      if (ent) ent.note = `In ${where}`;
      if (ent) ent.flagged = false;
    } else if (look.status === "not_in_list") {
      found.add("new_beneficiary", pe(`${recipient} is not in ${where}. This means “not previously saved”, not “known to be fraudulent”.`, "account_context"));
      if (ent) ent.note = `Not in ${where}`;
    }
    // A service-desk-styled handle, or an institution routing money to a handle/account given in chat.
    const local = recipient.split("@")[0];
    if (recipient.includes("@") && institutionalHandle(local) && look.status !== "known") {
      found.add(
        "unofficial_channel",
        recipientEv && recipientEv.kind !== "context" ? { ...recipientEv, support: "rule" } : pe(`${recipient} is a UPI handle named like a service desk (“${local}”). Institutions collect payments through their own apps or registered merchant accounts.`),
        0.8,
      );
    } else if (authorityClaimed() && destFromChat && look.status !== "known") {
      found.add("unofficial_channel", { ...destFromChat.ev, support: "rule" }, 0.78);
    }
  }

  const amount = payment?.amount && payment.amount > 0 ? payment.amount : askedAmounts.length ? Math.max(...askedAmounts) : 0;
  const typical = ctx.typicalOutgoing();
  if (payment?.amount && payment.amount > 0) addEntity({ type: "amount", value: formatINR(payment.amount), note: "Payment amount entered", source: "payment" });
  if (amount > 0 && typical) {
    const ratio = amount / typical;
    if (ratio >= 3) {
      const src = ctx.mode === "demo" ? "the synthetic demo profile's" : "your stated";
      found.add(
        "amount_anomaly",
        pe(`${formatINR(amount)} is ${ratio.toFixed(1)}× ${src} typical payment (${formatINR(typical)}).`, "account_context"),
        Math.min(0.85, 0.55 + 0.25 * Math.log10(ratio / 3)),
      );
    }
  }
  if (payment?.method) addEntity({ type: "payment_method", value: payment.method, source: "payment" });
  if (payment?.reason && /\b(kyc|verification|verify|refund|deposit|unlock|release|penalty|fine|processing fee|clearance)\b/i.test(payment.reason)) {
    found.add("payment_request", pe(`Payment note says “${payment.reason}”. Verification, refunds and account unlocking are not normally paid for by transfer.`), 0.7);
  }
  if (payment?.method && /collect/i.test(payment.method) && /\b(refund|receive|cashback|prize)\b/i.test(payment.reason ?? "")) {
    found.add("reversal", pe(`A UPI collect request debits your account; approving one to “${payment.reason}” moves money away from you.`), 0.85);
  }

  // An institutional claim that redirects the user to a sender-supplied number or link.
  if (authorityClaimed()) {
    for (const msg of analysable) {
      const re = /\b(?:call|contact|whatsapp|click|visit|open|tap)\b[^.?!\n]{0,40}(?:(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|https?:\/\/|www\.|bit\.ly|t\.me|wa\.me)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(msg.text))) {
        if (negated(msg.text, m.index)) continue;
        found.add("unofficial_channel", { ...sentenceAround(msg, m.index, m.index + m[0].length), support: "rule" }, 0.76);
      }
    }
  }

  // ── Interactions inside perception (each documented) ───────────────────
  // A promised fast refund ("credited back within 2 hours") is bait, not a deadline.
  const urgent = found.get("urgency");
  if (urgent) {
    const kept = urgent.evidence.filter((e) => !/(credited back|will be (?:refunded|returned|reversed)|credited (?:to|in) your)/i.test(e.text));
    if (!kept.length) found.delete("urgency");
    else urgent.evidence = kept;
  }
  // Ultimatum: a deadline and a threat in the same sentence ("pay now or be frozen").
  const urg = found.get("urgency");
  const thr = found.get("threat");
  if (urg && thr && urg.evidence.some((u) => thr.evidence.some((t) => sameRange(u, t)))) {
    urg.confidence = Math.min(0.97, urg.confidence + 0.05);
    thr.confidence = Math.min(0.97, thr.confidence + 0.05);
  }
  // A refund conversation with a payment instruction implies pay-to-receive.
  if (found.has("refund") && found.has("payment_request") && !found.has("reversal")) {
    const ev = found.get("payment_request")!.evidence.find((e) => e.kind !== "context");
    if (ev) found.add("reversal", { ...ev, support: "rule" }, 0.78);
  }
  // A refund mention is only manipulation when money is requested; otherwise drop it.
  if (found.has("refund") && !found.has("payment_request") && !found.has("reversal")) found.delete("refund");
  // Verification advice packaged with a sender-supplied link is not independent verification.
  const ver = found.get("verification");
  if (ver) {
    const kept = ver.evidence.filter((e) => !new RegExp(LINK_RE.source, "i").test(e.text));
    ver.evidence.filter((e) => !kept.includes(e)).forEach((e) => rejected.push({ signalId: "verification", text: e.text, reason: "“Official channel” advice came with a sender-supplied link, so it is not independent verification." }));
    if (!kept.length) found.delete("verification");
    else ver.evidence = kept;
  }

  return { messages, signals: [...found.map.values()], entities, rejected, context: ctx, recipient, amount };
}
