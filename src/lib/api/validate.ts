import { z } from "zod/v4";
import type { ScanInput } from "../types";

/** Input limits. Requests beyond these are rejected before any analysis or provider call. */
export const LIMITS = {
  conversationChars: 20_000,
  fieldChars: 200,
  maxAmount: 10_000_000_000,
  maxBeneficiaries: 200,
  /** Rough upper bound for the JSON body of /api/analyze. */
  analyzeBodyBytes: 64 * 1024,
  /** 5 MB image as base64 ≈ 6.7 MB, plus JSON overhead. */
  ocrBodyBytes: 7 * 1024 * 1024,
};

const str = (max: number) => z.string().max(max);

const PaymentSchema = z.object({
  recipient: str(LIMITS.fieldChars),
  amount: z.number().finite().min(0).max(LIMITS.maxAmount),
  method: str(LIMITS.fieldChars),
  reason: str(LIMITS.fieldChars),
});

const ContextSchema = z.object({
  mode: z.enum(["none", "demo", "user"]),
  knownBeneficiaries: z.array(str(LIMITS.fieldChars)).max(LIMITS.maxBeneficiaries).optional(),
  typicalOutgoing: z.number().finite().min(0).max(LIMITS.maxAmount).optional(),
});

export const ScanInputSchema = z.object({
  conversation: z.string().max(LIMITS.conversationChars, `Conversation is too long (${LIMITS.conversationChars.toLocaleString("en-IN")} characters max).`),
  payment: PaymentSchema.optional(),
  source: z.enum(["text", "image", "payment", "scenario"]).default("text"),
  imageName: str(LIMITS.fieldChars).optional(),
  scenarioId: str(64).optional(),
  title: str(LIMITS.fieldChars).optional(),
  accountContext: ContextSchema.optional(),
});

export const AnalyzeBodySchema = z.object({
  input: ScanInputSchema,
  mode: z.enum(["auto", "local"]).optional(),
});

export type ParsedBody = { ok: true; input: ScanInput; mode: "auto" | "local" } | { ok: false; status: number; error: string };

/** Validates an /api/analyze body. Error messages never echo the submitted content. */
export function parseAnalyzeBody(raw: unknown): ParsedBody {
  const r = AnalyzeBodySchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const tooLong = issue?.code === "too_big" && issue.path.join(".") === "input.conversation";
    return { ok: false, status: tooLong ? 413 : 400, error: tooLong ? issue.message : `Invalid request: ${issue?.path.join(".") || "body"} is not valid.` };
  }
  const input = r.data.input as ScanInput;
  const hasPayment = !!input.payment && (input.payment.amount > 0 || !!input.payment.recipient.trim());
  if (!input.conversation.trim() && !hasPayment) return { ok: false, status: 400, error: "Provide a conversation or payment details." };
  return { ok: true, input, mode: r.data.mode ?? "auto" };
}

/** Reads a JSON body with a byte limit (Content-Length is checked first, then the actual size). */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413, error: "Request body is too large." };
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, status: 413, error: "Request body is too large." };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}
