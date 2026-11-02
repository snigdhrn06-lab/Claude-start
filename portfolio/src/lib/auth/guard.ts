/**
 * Authorization guard for admin route handlers.
 * Every admin API route calls requireAdmin(); mutations also verify origin + CSRF token.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";
import { isSameOrigin } from "./request";
import { getCurrentSession, type AdminSession } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function requireAdmin(request: Request): Promise<AdminSession> {
  const session = await getCurrentSession();
  if (!session) throw new ApiError(401, "Not signed in");
  if (!SAFE_METHODS.has(request.method)) {
    if (!isSameOrigin(request.headers)) throw new ApiError(403, "Cross-origin request blocked");
    const token = request.headers.get("x-csrf-token") ?? "";
    if (!token || !tokensMatch(token, session.csrfToken)) throw new ApiError(403, "Invalid or missing CSRF token");
  }
  return session;
}
