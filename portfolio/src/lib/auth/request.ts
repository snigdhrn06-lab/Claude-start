/** Small helpers for reading trusted request metadata. */
import { createHash } from "node:crypto";

/**
 * Client IP. Render (and most proxies) put the real client first in X-Forwarded-For.
 * Used only for rate limiting, and stored hashed.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`${process.env.APP_SECRET ?? "portfolio"}:${value}`).digest("hex").slice(0, 32);
}

/**
 * Same-origin check for state-changing requests (defence in depth on top of SameSite cookies + CSRF token).
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // non-browser clients; the CSRF token check still applies
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
