"use client";
/** Contact form inbox. */
import { Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import { PageHeader } from "./AdminShell";
import { ConfirmDialog } from "./ConfirmDialog";

type Msg = { id: string; name: string; email: string; subject: string; message: string; read: boolean; emailDelivered: boolean; createdAt: string };

export function MessagesInbox({ initial, emailConfigured }: { initial: Msg[]; emailConfigured: boolean }) {
  const { api, toast } = useAdmin();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Msg | null>(null);

  async function setRead(m: Msg, read: boolean) {
    const r = await api("PATCH", `/api/admin/messages/${m.id}`, { read });
    if (!r.ok) return toast(r.error, "error");
    setItems((xs) => xs.map((x) => (x.id === m.id ? { ...x, read } : x)));
    router.refresh();
  }
  async function remove() {
    if (!confirm) return;
    const r = await api("DELETE", `/api/admin/messages/${confirm.id}`);
    if (!r.ok) return toast(r.error, "error");
    setItems((xs) => xs.filter((x) => x.id !== confirm.id));
    setConfirm(null);
    toast("Message deleted");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Messages" description={emailConfigured ? "Messages from the contact form. Copies are also emailed to you via Resend." : "Messages from the contact form. Email forwarding isn't configured (set RESEND_API_KEY to receive copies by email), so check here."} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line/20 p-12 text-center text-muted">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-line/10 overflow-hidden rounded-2xl border border-line/10 bg-bg-2">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-white/[0.02]"
                aria-expanded={open === m.id}
                onClick={() => {
                  setOpen(open === m.id ? null : m.id);
                  if (!m.read) setRead(m, true);
                }}
              >
                {m.read ? <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-dim" aria-label="Read" /> : <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Unread" />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", !m.read && "font-semibold")}>
                    {m.name} <span className="font-normal text-muted">&lt;{m.email}&gt;</span>
                  </span>
                  <span className="block truncate text-xs text-muted">{m.subject || m.message}</span>
                </span>
                <span className="shrink-0 text-xs text-dim">{new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </button>
              {open === m.id && (
                <div className="border-t border-line/10 bg-bg px-4 py-5 sm:pl-11">
                  {m.subject && <p className="mb-2 text-sm font-medium">{m.subject}</p>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">{m.message}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "your message"}`)}`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-ink">
                      <Reply className="h-3.5 w-3.5" aria-hidden /> Reply by email
                    </a>
                    <button type="button" onClick={() => setRead(m, !m.read)} className="rounded-lg border border-line/15 px-3 py-2 text-xs">
                      Mark as {m.read ? "unread" : "read"}
                    </button>
                    <button type="button" onClick={() => setConfirm(m)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                    </button>
                    {m.emailDelivered && <span className="self-center text-[11px] text-dim">Emailed to you</span>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!confirm} title="Delete this message?" body="It will be permanently removed." onConfirm={remove} onCancel={() => setConfirm(null)} />
    </>
  );
}
