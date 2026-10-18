// Core domain model for Sentinel. Every screen consumes these structures —
// never free-form model text.

export type SignalId =
  | "urgency"
  | "threat"
  | "authority"
  | "guarantee"
  | "scarcity"
  | "social_proof"
  | "refund"
  | "reversal"
  | "payment_request"
  | "isolation"
  | "credentials"
  | "escalation"
  | "emotional"
  | "new_beneficiary"
  | "unofficial_channel"
  | "amount_anomaly"
  | "verification"
  | "known_beneficiary"
  | "identity_change"
  | "windfall";

export type SignalCategory = "language" | "transaction" | "context" | "behavioral";
export type Dimension = "transaction" | "recipient" | "context" | "pressure";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/** Who authored a message, as far as the parser can tell. */
export type SpeakerRole =
  /** The other party (the person asking for money / sending the message). */
  | "counterparty"
  /** The person using Sentinel. */
  | "user"
  /** Text the user quoted from someone else ("they said: '...'"). */
  | "reported"
  /** No sender label — attribution cannot be established. */
  | "unknown";

/** How the evidence relates to the input. */
export type EvidenceKind =
  /** A verbatim excerpt of the conversation. */
  | "quote"
  /** A statement derived from payment fields or account context, not a quote. */
  | "context";

/** How confidently the evidence can be attributed to a speaker. */
export type Attribution = "attributed" | "reported" | "uncertain";

export interface Evidence {
  /** Exact excerpt from the conversation (kind = quote) or a derived statement (kind = context). */
  text: string;
  /** Character offsets into ScanInput.conversation; -1 when evidence is not a quote. */
  start: number;
  end: number;
  source: "conversation" | "payment" | "account_context";
  kind?: EvidenceKind;
  /** Index into the parsed message list (quotes only). */
  messageIndex?: number;
  speaker?: string;
  speakerRole?: SpeakerRole;
  attribution?: Attribution;
  /**
   * Whether an independent local pattern for this signal also matches the excerpt.
   * "model-only" means only the LLM asserted the signal for this text.
   */
  support?: "pattern" | "model-only" | "rule";
}

export interface RiskSignal {
  id: SignalId;
  label: string;
  category: SignalCategory;
  dimension: Dimension;
  severity: Severity;
  /**
   * 0–100. Strength of the evidence that this signal is present in the text.
   * NOT a probability of fraud.
   */
  confidence: number;
  explanation: string;
  evidence: Evidence[];
  /** Mitigating signals lower risk (e.g. an independent verification path). */
  mitigating?: boolean;
  /** Observed in counterparty text, inferred from context, or uncertain attribution. */
  basis: "observed" | "context" | "uncertain";
}

export type EntityType =
  | "organization"
  | "person"
  | "amount"
  | "recipient"
  | "account"
  | "payment_method"
  | "deadline"
  | "link"
  | "phone"
  | "credential";

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  /** Warrants attention (e.g. a link or handle supplied by the sender). Never means "known fraudulent". */
  flagged?: boolean;
  note?: string;
  /** Where the value was found. Entities that cannot be grounded are dropped. */
  source?: "conversation" | "payment" | "account_context";
  /** Who mentioned it, when it came from the conversation. */
  speakerRole?: SpeakerRole;
}

export type AttackStage = "actor" | "pretext" | "urgency" | "leverage" | "ask" | "destination" | "impact";

export interface AttackNode {
  id: string;
  stage: AttackStage;
  label: string;
  sublabel: string;
  signalIds: SignalId[];
  evidence: Evidence[];
  details?: { label: string; value: string }[];
  /**
   * observed: supported by quoted counterparty text.
   * inferred: derived from context or payment fields.
   * hypothetical: a possible consequence, not something that happened.
   */
  status: "observed" | "inferred" | "hypothetical";
}

export interface PathNode {
  id: string;
  label: string;
  description: string;
  tone: "neutral" | "risk" | "critical" | "safe";
  children?: PathNode[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  detail: string;
  priority: "now" | "before-paying" | "after";
  /** Signals that triggered this recommendation (empty = general guidance). */
  because?: SignalId[];
}

export interface PaymentDetails {
  recipient: string;
  amount: number;
  method: string;
  reason: string;
}

/**
 * Account context the user supplies (or the demo profile). Sentinel never
 * fabricates this: without it, beneficiary and amount history are "unknown".
 */
export interface AccountContextInput {
  mode: "none" | "demo" | "user";
  knownBeneficiaries?: string[];
  typicalOutgoing?: number;
}

export interface ScanInput {
  conversation: string;
  payment?: PaymentDetails;
  source: "text" | "image" | "payment" | "scenario";
  imageName?: string;
  scenarioId?: string;
  title?: string;
  accountContext?: AccountContextInput;
}

export type Classification =
  | "Authority Impersonation"
  | "Investment Fraud"
  | "Refund Scam"
  | "Credential Phishing"
  | "Unverified Beneficiary"
  | "Pressure-Driven Payment"
  | "Insufficient Evidence"
  | "Low Risk";

export type RiskBand = "low" | "caution" | "elevated" | "high";

/** Recommendation tier. Distinct from the band so that policy rules can be explained. */
export type DecisionAction = "proceed" | "proceed_with_care" | "verify_first" | "stop";

/** One additive term in the score, in log-odds points. Sums exactly to the final logit. */
export interface ScoreTerm {
  kind: "baseline" | "dimension" | "interaction" | "gate" | "mitigation" | "floor";
  label: string;
  /** Contribution in log-odds points (can be negative). */
  points: number;
  detail: string;
  signalIds: SignalId[];
}

export interface ScoreTrace {
  terms: ScoreTerm[];
  /** Sum of all term points before any floor rule. */
  logit: number;
  /** 100·sigmoid(logit), before floors. */
  rawScore: number;
  /** Final score after floor rules. */
  score: number;
  floorApplied?: { rule: string; floor: number };
}

export interface DecisionStep {
  question: string;
  answer: string;
  /** Pointers to the evidence the answer relies on. */
  evidence?: Evidence[];
}

export interface Decision {
  action: DecisionAction;
  band: RiskBand;
  /** One sentence the user can act on. */
  summary: string;
  /** Structured workflow: request → concerns → missing info → verification → before authorising. */
  workflow: DecisionStep[];
  /** Explicit statements of what Sentinel cannot know from this input. */
  uncertainties: string[];
  insufficientEvidence: boolean;
}

export interface ContextSummary {
  mode: AccountContextInput["mode"];
  label: string;
  /** Plain statement of what the context can and cannot tell us. */
  description: string;
  recipientStatus: "known" | "not_in_list" | "unknown" | "not_applicable";
  typicalOutgoing: number | null;
}

export interface ParseSummary {
  format: "labelled" | "unlabelled" | "mixed" | "empty";
  messageCount: number;
  counterpartyMessages: number;
  userMessages: number;
  warnings: string[];
}

export interface RejectedEvidence {
  signalId?: SignalId;
  entity?: string;
  text: string;
  reason: string;
}

export interface Provenance {
  engineVersion: string;
  policyVersion: string;
  catalogVersion: string;
  perception: "local" | "llm";
  model?: string;
  /** FNV-1a hash of the normalised input. Identical input → identical hash. */
  inputHash: string;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  title: string;
  input: ScanInput;
  /** 0–100 risk score. A ranking of concern, not a calibrated probability of fraud. */
  riskScore: number;
  band: RiskBand;
  classification: Classification;
  headline: string;
  signals: RiskSignal[];
  extractedEntities: ExtractedEntity[];
  attackChain: AttackNode[];
  hypotheticalNextSteps: PathNode;
  recommendedActions: RecommendedAction[];
  transactionRisk: number;
  recipientRisk: number;
  contextRisk: number;
  pressureRisk: number;
  explanation: string;
  engine: "llm" | "local";
  model?: string;
  /** Legacy flat breakdown (label/value) derived from scoreTrace. */
  scoreBreakdown: { label: string; value: number }[];
  scoreTrace: ScoreTrace;
  decision: Decision;
  context: ContextSummary;
  parse: ParseSummary;
  rejectedEvidence: RejectedEvidence[];
  provenance: Provenance;
}

export interface ChatMessage {
  index: number;
  sender: string;
  text: string;
  /** offset of `text` within the raw conversation string */
  offset: number;
  self: boolean;
  role: SpeakerRole;
  /** How the speaker was established. */
  labelled: boolean;
  /** Index of an earlier identical message from the same sender. */
  duplicateOf?: number;
  /** For role "reported": index of the user message that quoted this text. */
  quotedIn?: number;
}

/** Signals an LLM (or the local detector) perceives before deterministic scoring. */
export interface PerceivedSignal {
  id: SignalId;
  confidence: number;
  explanation?: string;
  quotes: string[];
}

export interface Perception {
  signals: PerceivedSignal[];
  entities: ExtractedEntity[];
  explanation?: string;
  classification?: Classification;
}
