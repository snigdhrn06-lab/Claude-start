import { NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai/provider";
import { analyzeLocal } from "@/lib/engine/analyze";
import type { ScanInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { input?: ScanInput; mode?: "auto" | "local" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const input = body.input;
  if (!input || typeof input.conversation !== "string" || (!input.conversation.trim() && !input.payment)) {
    return NextResponse.json({ error: "Provide a conversation or payment details." }, { status: 400 });
  }
  if (input.conversation.length > 20_000) {
    return NextResponse.json({ error: "Conversation is too long (20,000 characters max)." }, { status: 413 });
  }
  if (body.mode === "local") return NextResponse.json({ result: analyzeLocal(input) });
  const { result, notice } = await analyzeWithAI(input);
  return NextResponse.json({ result, notice });
}
