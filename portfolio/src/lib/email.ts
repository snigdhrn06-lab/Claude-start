/**
 * Optional email delivery for contact messages via Resend (https://resend.com).
 * Without RESEND_API_KEY this is a no-op and returns false; messages are still stored in the inbox.
 */
export async function sendContactEmail(msg: { name: string; email: string; subject: string; message: string; to: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !from || !msg.to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        reply_to: msg.email,
        subject: `Portfolio message${msg.subject ? `: ${msg.subject}` : ""} — ${msg.name}`,
        text: `From: ${msg.name} <${msg.email}>\n\n${msg.message}\n\n(Also saved in Admin → Messages.)`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn("[email] Resend responded", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.warn("[email] delivery failed:", (err as Error).message);
    return false;
  }
}
