/** Admin sign-in: rate-limited, constant-time, creates a server-side session. */
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { clearEvents, countRecent, LIMITS, recordEvent } from "@/lib/auth/rate-limit";
import { clientIp, hashIdentifier, isSameOrigin } from "@/lib/auth/request";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { findAdminByEmail } from "@/lib/ops/admin";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

export const POST = handle(async (request: Request) => {
  if (!isSameOrigin(request.headers)) throw new ApiError(403, "Cross-origin request blocked");
  const { email, password } = bodySchema.parse(await readJson(request));
  const ipKey = hashIdentifier(clientIp(request.headers));
  const emailKey = hashIdentifier(email.toLowerCase());

  const [ipFails, emailFails] = await Promise.all([
    countRecent("login-ip", ipKey, LIMITS.loginIp.windowMs),
    countRecent("login-email", emailKey, LIMITS.loginEmail.windowMs),
  ]);
  if (ipFails >= LIMITS.loginIp.max || emailFails >= LIMITS.loginEmail.max) {
    throw new ApiError(429, "Too many failed attempts. Wait 15 minutes and try again.");
  }

  const admin = email ? await findAdminByEmail(email) : null;
  // Always run one scrypt verification so response time doesn't reveal whether the email exists.
  const ok = admin ? await verifyPassword(password, admin.passwordHash) : (await verifyPassword(password, await getDummyHash()), false);
  if (!admin || !ok) {
    await Promise.all([recordEvent("login-ip", ipKey), recordEvent("login-email", emailKey)]);
    throw new ApiError(401, "Incorrect email or password.");
  }

  await Promise.all([clearEvents("login-ip", ipKey), clearEvents("login-email", emailKey)]);
  const { token, expiresAt } = await createSession(admin.id, request.headers.get("user-agent"));
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return json({ ok: true });
});
