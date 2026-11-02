/** JSON API helpers shared by all route handlers. */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

/** Turns a ZodError into { field: message } for form display. */
export function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a route handler with consistent error responses. Never leaks internal error details. */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message, fields: err.fields }, { status: err.status });
      if (err instanceof ZodError) return json({ error: "Please fix the highlighted fields.", fields: zodFields(err) }, { status: 400 });
      const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === "23505") return json({ error: "That value is already in use (for example, a duplicate slug)." }, { status: 409 });
      console.error("[api] unhandled error:", err);
      return json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}
