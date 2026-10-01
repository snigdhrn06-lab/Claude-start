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
  | "verification";

export type SignalCategory = "language" | "transaction" | "context" | "behavioral";
export type Dimension = "transaction" | "recipient" | "context" | "pressure";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Evidence {
  /** Exact excerpt from the conversation. */
  text: string;
  /** Character offsets into ScanInput.conversation; -1 when evidence came from payment fields. */
  start: number;
  end: number;
  source: "conversation" | "payment";
}

export interface RiskSignal {
  id: SignalId;
  label: string;
  category: SignalCategory;
  dimension: Dimension;
  severity: Severity;
  /** 0–100 */
  confidence: number;
  explanation: string;
  evidence: Evidence[];
  /** Mitigating signals lower risk (e.g. an independent verification path). */
  mitigating?: boolean;
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
  flagged?: boolean;
  note?: string;
}

export type AttackStage =
  | "actor"
  | "pretext"
  | "urgency"
  | "leverage"
  | "ask"
  | "destination"
  | "impact";

export interface AttackNode {
  id: string;
  stage: AttackStage;
  label: string;
  sublabel: string;
  signalIds: SignalId[];
  evidence: Evidence[];
  details?: { label: string; value: string }[];
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
}

export interface PaymentDetails {
  recipient: string;
  amount: number;
  method: string;
  reason: string;
}

export interface ScanInput {
  conversation: string;
  payment?: PaymentDetails;
  source: "text" | "image" | "payment" | "scenario";
  imageName?: string;
  scenarioId?: string;
  title?: string;
}

export type Classification =
  | "Authority Impersonation"
  | "Investment Fraud"
  | "Refund Scam"
  | "Credential Phishing"
  | "Unverified Beneficiary"
  | "Pressure-Driven Payment"
  | "Low Risk";

export interface AnalysisResult {
  id: string;
  createdAt: string;
  title: string;
  input: ScanInput;
  riskScore: number;
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
  /** Transparent breakdown of how the score was assembled. */
  scoreBreakdown: { label: string; value: number }[];
}

export interface ChatMessage {
  sender: string;
  text: string;
  /** offset of `text` within the raw conversation string */
  offset: number;
  self: boolean;
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
