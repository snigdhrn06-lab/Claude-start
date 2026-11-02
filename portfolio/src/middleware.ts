/**
 * Security headers + a per-request nonce-based Content-Security-Policy.
 * Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
 * (Authentication is enforced server-side in the admin layout and every admin API route,
 * not here — middleware is only defence in depth.)
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const https = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "media-src 'self' https:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!dev && https) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  if (request.nextUrl.pathname.startsWith("/admin")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  // Skip static assets and media files (they set their own headers).
  matcher: [{ source: "/((?!_next/static|_next/image|media/|favicon.ico|icon.svg).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
