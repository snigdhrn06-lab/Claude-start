"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, Clock, Hand, Plus, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AnalysisPicker } from "@/components/AnalysisPicker";
import { PageHeader, SectionLabel, TimeLabel, cn, riskTone } from "@/components/ui";
import { formatINR } from "@/lib/engine/parse";
import { amountAtStake } from "@/lib/engine/narrative";
import { useSentinel, type CircleResponse, type Contact, type ReviewRequest } from "@/lib/store";

const VERDICT = {
  stop: { label: "Don't pay", cls: "border-risk/30 bg-risk/10 text-risk-soft", icon: Hand },
  verify: { label: "Verify first", cls: "border-caution/30 bg-caution/10 text-caution", icon: ShieldCheck },
  ok: { label: "Looks fine", cls: "border-safe/30 bg-safe/10 text-safe", icon: Check },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ResponseRow({ contact, response }: { contact?: Contact; response: CircleResponse }) {
  const v = response.verdict ? VERDICT[response.verdict] : null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-fg-muted">{initials(contact?.name ?? "?")}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium">{contact?.name ?? "Removed contact"}</span>
          <span className="text-[11.5px] text-fg-dim">{contact?.relation}</span>
          <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-fg-dim">
            {response.status === "sent" && (
              <>
                <Check className="h-3 w-3" /> Sent
              </>
            )}
            {response.status === "seen" && (
              <>
                <CheckCheck className="h-3 w-3 text-info" /> Seen · typing…
              </>
            )}
            {response.status === "replied" && (
              <>
                <CheckCheck className="h-3 w-3 text-info" /> Replied
              </>
            )}
          </span>
        </div>
        <AnimatePresence>
          {v && response.note && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5">
              <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider", v.cls)}>
                <v.icon className="h-3 w-3" /> {v.label}
              </span>
              <p className="mt-1.5 rounded-md rounded-tl-sm border border-white/[0.06] bg-ink-750 px-3 py-2 text-[13px] leading-relaxed text-fg/90">{response.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RequestCard({ req }: { req: ReviewRequest }) {
  const { contacts, history } = useSentinel();
  const analysis = history.find((h) => h.id === req.analysisId);
  const replied = req.responses.filter((r) => r.status === "replied");
  const stops = replied.filter((r) => r.verdict !== "ok").length;
  const complete = replied.length === req.responses.length && req.responses.length > 0;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        {analysis && <span className={cn("num font-mono text-sm font-semibold", riskTone(analysis.riskScore).text)}>{analysis.riskScore}</span>}
        <span className="text-[13px] font-medium">{analysis?.title ?? "Review request"}</span>
        <span className="ml-auto font-mono text-[10.5px] text-fg-dim">
          <TimeLabel iso={req.createdAt} mode="relative" />
        </span>
      </div>
      <div className="px-4 pt-3">
        <p className="rounded-md border border-info/20 bg-info/[0.06] px-3 py-2 text-[13px] leading-relaxed text-fg/90">{req.message}</p>
      </div>
      <div className="divide-y divide-white/[0.05] px-4">
        {req.responses.map((r) => (
          <ResponseRow key={r.contactId} response={r} contact={contacts.find((c) => c.id === r.contactId)} />
        ))}
      </div>
      <AnimatePresence>
        {complete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={cn("border-t px-4 py-3 text-[13px] font-medium", stops ? "border-risk/25 bg-risk/[0.06] text-risk-soft" : "border-safe/25 bg-safe/[0.06] text-safe")}
          >
            {stops ? `${stops} of ${req.responses.length} reviewers advise you not to pay. Payment stays on hold.` : "Your circle sees no problem with this payment."}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CirclePage() {
  const { contacts, addContact, removeContact, requests, askCircle, current } = useSentinel();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const amt = amountAtStake(current.input.conversation, current.input.payment);
  const defaultMsg = `Sentinel detected a high-risk financial request (${current.riskScore}/100 — ${current.classification}). Can you review this before I proceed${amt ? ` with ${formatINR(amt)}` : ""}?`;
  const [message, setMessage] = useState(defaultMsg);
  useEffect(() => setMessage(defaultMsg), [defaultMsg]);

  return (
    <div>
      <PageHeader
        eyebrow="Sentinel circle"
        title="A second opinion before money moves."
        description="Scammers isolate. Sentinel does the opposite: high-risk payments can be routed to people you trust. Requests and replies here are simulated — nothing is sent."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Your circle</SectionLabel>
            <ul className="panel divide-y divide-white/[0.05]">
              <AnimatePresence initial={false}>
                {contacts.map((c) => (
                  <motion.li key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] font-mono text-[12px] text-fg-muted">{initials(c.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{c.name}</div>
                      <div className="text-[12px] text-fg-dim">{c.relation}</div>
                    </div>
                    <button aria-label={`Remove ${c.name}`} onClick={() => removeContact(c.id)} className="rounded p-1.5 text-fg-faint opacity-0 transition hover:text-risk-soft group-hover:opacity-100 focus:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {!contacts.length && <li className="px-4 py-6 text-center text-[13px] text-fg-dim">No trusted contacts yet.</li>}
            </ul>
          </div>
          <form
            className="panel flex flex-col gap-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              addContact({ name: name.trim(), relation: relation.trim() || "Trusted contact" });
              setName("");
              setRelation("");
            }}
          >
            <div className="label mb-1 flex items-center gap-1.5">
              <UserRound className="h-3 w-3" /> Add trusted contact
            </div>
            <input aria-label="Name" className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input aria-label="Relationship" className="input" placeholder="Relationship (e.g. Sister, Advisor)" value={relation} onChange={(e) => setRelation(e.target.value)} />
            <button className="btn-ghost mt-1" disabled={!name.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add to circle
            </button>
          </form>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="label">Ask your Sentinel circle</div>
              <AnalysisPicker />
            </div>
            <textarea aria-label="Review request message" rows={3} className="input resize-none text-[13px] leading-relaxed" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="btn-primary" disabled={!contacts.length || !message.trim()} onClick={() => askCircle(current, message)}>
                <Send className="h-3.5 w-3.5" /> Request review from {contacts.length} {contacts.length === 1 ? "person" : "people"}
              </button>
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-fg-dim">
                <Clock className="h-3 w-3" /> Simulated replies
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {requests.map((r) => (
              <RequestCard key={r.id} req={r} />
            ))}
            {!requests.length && (
              <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center">
                <ShieldCheck className="h-7 w-7 text-fg-dim" />
                <div className="text-sm font-medium">No review requests yet</div>
                <p className="max-w-sm text-[13px] text-fg-muted">When Sentinel holds a payment, one tap sends the evidence to your circle. Try it with the current analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
