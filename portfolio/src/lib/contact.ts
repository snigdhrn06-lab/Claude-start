/** Contact link builders (pure functions, usable on server and client). */

/** https://wa.me/<digits>?text=<url-encoded message> — the official click-to-chat format. */
export function whatsappUrl(number: string, message?: string) {
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function mailtoUrl(email: string, subject?: string) {
  if (!email) return null;
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

export function telUrl(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}
