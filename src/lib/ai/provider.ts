import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { SIGNAL_IDS, SIGNALS } from "../engine/catalog";
import { analyzeLocal, buildResult } from "../engine/analyze";
import { detectLocal, type DetectedSignal } from "../engine/detect";
import { locateQuote } from "../engine/parse";
import type { AnalysisResult, EntityType, ExtractedEntity, ScanInput, SignalId } from "../types";

/**
 * AI abstraction layer.
 *
 * The LLM is used for *perception* only: it reads the conversation and reports
 * which manipulation signals are present, quoting the exact text. Every quote
 * is grounded back into the conversation (unlocatable quotes are discarded),
 * then the same deterministic engine used offline computes scores, the attack
 * chain and recommendations. Without an API key — or on any failure — the
 * local perception layer takes over.
 */

export const DEFAULT_MODEL = "claude-opus-5-5";

export function aiConfig() {
  const key = process.env.ANTHROPIC_API_KEY;
  const disabled = process.env.SENTINEL_AI_MODE === "local";
  return {
    enabled: !!key && !disabled,
    model: process.env.SENTINEL_MODEL || DEFAULT_MODEL,
  };
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

const ENTITY_TYPES: [EntityType, ...EntityType[]] = [
  "organization",
  "person",
  "amount",
  "recipient",
  "account",
  "payment_method",
  "deadline",
  "link",
  "phone",
  "credential",
];

const PerceptionSchema = z.object({
  signals: z.array(
    z.object({
      id: z.enum(SIGNAL_IDS as [SignalId, ...SignalId[]]),
      confidence: z.number().describe("0-100"),
      explanation: z.string().describe("One plain-English sentence, specific to this conversation."),
      quotes: z.array(z.string()).describe("Exact substrings copied verbatim from the conversation."),
    }),
  ),
  entities: z.array(
    z.object({
      type: z.enum(ENTITY_TYPES),
      value: z.string(),
      flagged: z.boolean(),
    }),
  ),
  explanation: z.string().describe("2-3 sentence summary of how the manipulation works, plain English."),
});

const SYSTEM = `You are the perception layer of Sentinel, a financial decision firewall for Indian retail banking customers.
You read a conversation (and optional payment details) that preceded a payment and identify manipulation signals.
Only report a signal when the conversation supports it. Quote exact text from the conversation as evidence — quotes must be verbatim substrings.
Ignore lines from "You" except as context. Messages from the user's side are not manipulation.
Signal catalogue (id — meaning):
${SIGNAL_IDS.map((id) => `- ${id} — ${SIGNALS[id].label}: ${SIGNALS[id].explanation}`).join("\n")}
"verification" is a mitigating signal: report it when the sender points the user to official, independently verifiable channels.
Confidence reflects how clearly the text supports the signal (50 = ambiguous, 95 = explicit).`;

function grounded(input: ScanInput, perceived: z.infer<typeof PerceptionSchema>["signals"]): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  for (const s of perceived) {
    if (!SIGNALS[s.id]) continue;
    const evidence = s.quotes.map((q) => locateQuote(input.conversation, q)).filter((e): e is NonNullable<typeof e> => !!e);
    if (!evidence.length) continue; // no grounding → discard (prevents hallucinated signals)
    const prev = out.find((o) => o.id === s.id);
    if (prev) {
      prev.evidence.push(...evidence);
      continue;
    }
    out.push({
      id: s.id,
      confidence: Math.max(0.3, Math.min(0.98, s.confidence / 100)),
      evidence,
      explanation: s.explanation,
    });
  }
  return out;
}

/** Account-history signals the model cannot know: always come from the ledger rules. */
const LEDGER_SIGNALS: SignalId[] = ["new_beneficiary", "amount_anomaly", "unofficial_channel"];

export async function analyzeWithAI(input: ScanInput): Promise<{ result: AnalysisResult; notice?: string }> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { result: analyzeLocal(input) };
  try {
    const payment = input.payment
      ? `\n\nPayment details entered by the user:\nRecipient: ${input.payment.recipient}\nAmount: ₹${input.payment.amount}\nMethod: ${input.payment.method}\nReason: ${input.payment.reason}`
      : "";
    const response = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(PerceptionSchema), effort: "low" },
      messages: [{ role: "user", content: `Conversation:\n<conversation>\n${input.conversation}\n</conversation>${payment}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { result: analyzeLocal(input), notice: "Model declined or returned no structured output — local engine used." };
    }
    const p = response.parsed_output;
    const local = detectLocal(input.conversation, input.payment);
    const signals = grounded(input, p.signals).filter((s) => !LEDGER_SIGNALS.includes(s.id));
    for (const ls of local.signals) if (LEDGER_SIGNALS.includes(ls.id)) signals.push(ls);
    const entities: ExtractedEntity[] = p.entities.length ? p.entities.map((e) => ({ ...e })) : local.entities;
    // Keep ledger notes (e.g. "Never paid before") from the local layer.
    for (const e of local.entities) if (e.type === "recipient" && !entities.some((x) => x.value === e.value)) entities.push(e);
    return { result: buildResult(input, signals, entities, { engine: "llm", model: cfg.model, explanation: p.explanation }) };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `${err.status ?? ""} ${err.name}` : (err as Error).message;
    console.warn("[sentinel] AI analysis failed, falling back to local engine:", msg);
    return { result: analyzeLocal(input), notice: "AI provider unavailable — local engine used." };
  }
}

const OCR_PROMPT = `Transcribe this chat/SMS screenshot into plain text, one message per line, formatted exactly as "Sender: message".
Use "You" for messages sent by the phone's owner (usually right-aligned bubbles). Preserve amounts, UPI IDs, links and numbers exactly.
Output only the transcript.`;

export async function ocrWithAI(dataUrl: string): Promise<string | null> {
  const cfg = aiConfig();
  if (!cfg.enabled) return null;
  const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const response = await getClient().messages.create({
    model: cfg.model,
    max_tokens: 4000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: m[1] as "image/png", data: m[2] } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text || null;
}
