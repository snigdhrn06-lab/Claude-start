/**
 * Public contact form endpoint.
 * Every valid message is stored in the admin inbox (Admin → Messages). If RESEND_API_KEY is
 * configured it is also emailed. Protected by validation, a honeypot and per-IP rate limiting.
 */
import { eq } from "drizzle-orm";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { clientIp, hashIdentifier, isSameOrigin } from "@/lib/auth/request";
import { countRecent, LIMITS, recordEvent } from "@/lib/auth/rate-limit";
import { contactMessageSchema } from "@/lib/content/schemas";
import { getSiteData } from "@/lib/content/queries";
import { getDb, schema } from "@/lib/db/client";
import { sendContactEmail } from "@/lib/email";

export const runtime = "nodejs";

export const POST = handle(async (request: Request) => {
  if (!isSameOrigin(request.headers)) throw new ApiError(403, "Cross-origin request blocked");
  const settings = (await getSiteData()).settings;
  if (!settings.contactFormEnabled) throw new ApiError(404, "The contact form is turned off.");

  const ipKey = hashIdentifier(clientIp(request.headers));
  if ((await countRecent("contact", ipKey, LIMITS.contact.windowMs)) >= LIMITS.contact.max) {
    throw new ApiError(429, "You've sent several messages recently. Please try again later, or use email or WhatsApp.");
  }

  const input = contactMessageSchema.parse(await readJson(request));
  await recordEvent("contact", ipKey);
  if (input.website) return json({ ok: true, message: "Thanks, your message has been received." }); // honeypot: pretend success to bots

  const [row] = await getDb()
    .insert(schema.contactMessages)
    .values({ name: input.name, email: input.email, subject: input.subject, message: input.message })
    .returning({ id: schema.contactMessages.id });

  const delivered = await sendContactEmail({ ...input, to: process.env.CONTACT_TO_EMAIL || settings.email });
  if (delivered) await getDb().update(schema.contactMessages).set({ emailDelivered: true }).where(eq(schema.contactMessages.id, row!.id));

  return json({ ok: true, message: `Thanks, ${input.name.split(" ")[0]}. Your message is in ${settings.name.split(" ")[0]}'s inbox. Expect a reply at ${input.email}.` });
});
