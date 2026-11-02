"use client";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn("grid h-9 w-9 place-items-center rounded-full border border-line/15 bg-bg/80 text-muted transition-colors hover:text-fg", className)}
      aria-label={copied ? "Email address copied" : "Copy email address"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this email address:", value);
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

type State = { status: "idle" | "sending" | "sent" | "error"; message?: string; fields?: Record<string, string> };

export function ContactForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? "Your message could not be sent. Please try email or WhatsApp instead.", fields: body.fields });
        return;
      }
      form.reset();
      setState({ status: "sent", message: body.message });
    } catch {
      setState({ status: "error", message: "Network error. Check your connection, or use email or WhatsApp instead." });
    }
  }

  if (state.status === "sent") {
    return (
      <div className="rounded-[1.5rem] border border-accent/40 bg-accent/[0.06] p-8" role="status">
        <Check className="h-8 w-8 text-accent" aria-hidden />
        <p className="display mt-4 text-3xl">Message received.</p>
        <p className="mt-3 text-muted">{state.message}</p>
        <button type="button" className="btn btn-ghost mt-6" onClick={() => setState({ status: "idle" })}>
          Send another
        </button>
      </div>
    );
  }

  const err = (f: string) => state.fields?.[f];
  const field = "mt-2 w-full rounded-xl border border-line/15 bg-bg/60 px-4 py-3 text-fg placeholder:text-dim outline-none transition-colors focus:border-accent focus-visible:outline-none";
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[1.5rem] border border-line/[0.09] bg-surface/50 p-6 md:p-8" aria-describedby="contact-form-note">
      <p className="label mb-6">Or send a message</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          Name
          <input name="name" required maxLength={120} autoComplete="name" className={field} aria-invalid={!!err("name")} aria-describedby={err("name") ? "e-name" : undefined} />
          {err("name") && <span id="e-name" className="mt-1 block text-xs text-danger">{err("name")}</span>}
        </label>
        <label className="block text-sm text-muted">
          Email
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={field} aria-invalid={!!err("email")} aria-describedby={err("email") ? "e-email" : undefined} />
          {err("email") && <span id="e-email" className="mt-1 block text-xs text-danger">{err("email")}</span>}
        </label>
      </div>
      <label className="mt-5 block text-sm text-muted">
        Subject <span className="text-dim">(optional)</span>
        <input name="subject" maxLength={200} className={field} />
      </label>
      <label className="mt-5 block text-sm text-muted">
        Message
        <textarea name="message" required minLength={10} maxLength={5000} rows={5} className={cn(field, "resize-y")} aria-invalid={!!err("message")} aria-describedby={err("message") ? "e-message" : undefined} />
        {err("message") && <span id="e-message" className="mt-1 block text-xs text-danger">{err("message")}</span>}
      </label>
      {/* Honeypot: hidden from people and assistive tech; bots fill it */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.status === "error" && (
        <p className="mt-5 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p id="contact-form-note" className="text-xs text-dim">
          Your message goes straight to my inbox.
        </p>
        <button type="submit" className="btn btn-primary" disabled={state.status === "sending"}>
          {state.status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {state.status === "sending" ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
