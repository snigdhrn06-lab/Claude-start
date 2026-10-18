"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { analyzeLocal } from "./engine/analyze";
import { SIGNALS } from "./engine/catalog";
import { HISTORY_SEEDS } from "./scenarios";
import type { AnalysisResult, ScanInput } from "./types";

export interface Contact {
  id: string;
  name: string;
  relation: string;
}

export type Verdict = "stop" | "verify" | "ok";
export interface CircleResponse {
  contactId: string;
  status: "sent" | "seen" | "replied";
  verdict?: Verdict;
  note?: string;
  at?: string;
}
export interface ReviewRequest {
  id: string;
  analysisId: string;
  createdAt: string;
  message: string;
  responses: CircleResponse[];
}

export interface AIStatus {
  checked: boolean;
  ai: boolean;
  model: string | null;
}

export interface ScanOutcome {
  result: AnalysisResult;
  notice?: string;
}

/**
 * What the user later says about an analysis. Stored only in this browser.
 * It is an unverified self-report: useful for product feedback, never treated
 * as ground truth for evaluation.
 */
export interface Feedback {
  useful?: boolean;
  outcome?: "was_scam" | "was_legitimate" | "unsure";
  at: string;
}

interface Store {
  history: AnalysisResult[];
  current: AnalysisResult;
  setCurrent: (id: string) => void;
  addResult: (r: AnalysisResult) => void;
  runScan: (input: ScanInput, opts?: { mode?: "auto" | "local" }) => Promise<ScanOutcome>;
  aiStatus: AIStatus;
  contacts: Contact[];
  addContact: (c: Omit<Contact, "id">) => void;
  removeContact: (id: string) => void;
  requests: ReviewRequest[];
  askCircle: (analysis: AnalysisResult, message: string) => ReviewRequest;
  clearHistory: () => void;
  feedback: Record<string, Feedback>;
  setFeedback: (analysisId: string, f: Omit<Feedback, "at">) => void;
}

const Ctx = createContext<Store | null>(null);

// v2: analysis records gained score traces, provenance and context. v1 records are not loaded.
const HISTORY_KEY = "sentinel.history.v2";
const CIRCLE_KEY = "sentinel.circle.v1";
const REQUESTS_KEY = "sentinel.requests.v2";
const FEEDBACK_KEY = "sentinel.feedback.v1";
/** User scans contain conversations; keep them on this device for at most 7 days. */
const RETENTION_MS = 7 * 24 * 3600 * 1000;

function seedHistory(): AnalysisResult[] {
  const now = new Date();
  return HISTORY_SEEDS.map((s) => {
    const d = new Date(now);
    d.setDate(d.getDate() - s.dayOffset);
    d.setHours(s.hour, 12, 0, 0);
    if (d > now) d.setTime(now.getTime() - (s.hour + 1) * 60_000);
    return analyzeLocal(
      { conversation: s.conversation, payment: s.payment, source: "scenario", title: s.title, accountContext: s.accountContext },
      { id: s.id, createdAt: d.toISOString() },
    );
  });
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: "c-mom", name: "Mom", relation: "Family" },
  { id: "c-rahul", name: "Rahul", relation: "Brother" },
  { id: "c-meera", name: "Meera Iyer", relation: "Financial Advisor" },
];

/**
 * Simulated reviewer replies (demo only — nothing is sent). They follow the
 * analysis that was shared rather than a fixed script, so a low-risk payment
 * gets a "looks fine" and a high-risk one a "stop".
 */
function simulatedReply(analysis: AnalysisResult): { verdict: Verdict; note: string } {
  const top = analysis.signals.find((s) => !SIGNALS[s.id].mitigating);
  const why = top ? ` The ${top.label.toLowerCase()} worries me.` : "";
  if (analysis.decision.action === "stop") return { verdict: "stop", note: `Please don't pay or share anything yet.${why} Let's verify it together first.` };
  if (analysis.decision.action === "verify_first") return { verdict: "verify", note: `Hold on until you've checked it independently.${why}` };
  if (analysis.decision.action === "proceed_with_care") return { verdict: "verify", note: "Probably fine, but a quick call to confirm wouldn't hurt." };
  return { verdict: "ok", note: "Looks fine to me." };
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep in memory */
  }
}

export function SentinelProvider({ children }: { children: React.ReactNode }) {
  const [seeds] = useState(seedHistory);
  const [userScans, setUserScans] = useState<AnalysisResult[]>([]);
  const [currentId, setCurrentId] = useState<string>("seed-kyc");
  const [aiStatus, setAiStatus] = useState<AIStatus>({ checked: false, ai: false, model: null });
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [feedback, setFeedbackState] = useState<Record<string, Feedback>>({});
  const loaded = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const h = read<AnalysisResult[]>(HISTORY_KEY);
    const cutoff = Date.now() - RETENTION_MS;
    if (h?.length) setUserScans(h.filter((x) => x.scoreTrace && Date.parse(x.createdAt) > cutoff));
    const f = read<Record<string, Feedback>>(FEEDBACK_KEY);
    if (f) setFeedbackState(f);
    const c = read<Contact[]>(CIRCLE_KEY);
    if (c?.length) setContacts(c);
    const r = read<ReviewRequest[]>(REQUESTS_KEY);
    if (r?.length) setRequests(r.map((req) => ({ ...req, responses: req.responses.filter((x) => x.status === "replied") })));
    loaded.current = true;
    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((s) => setAiStatus({ checked: true, ai: !!s.ai, model: s.model ?? null }))
      .catch(() => setAiStatus({ checked: true, ai: false, model: null }));
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (loaded.current) write(HISTORY_KEY, userScans.slice(0, 30));
  }, [userScans]);
  useEffect(() => {
    if (loaded.current) write(CIRCLE_KEY, contacts);
  }, [contacts]);
  useEffect(() => {
    if (loaded.current) write(REQUESTS_KEY, requests.slice(0, 20));
  }, [requests]);
  useEffect(() => {
    if (loaded.current) write(FEEDBACK_KEY, feedback);
  }, [feedback]);

  const history = useMemo(
    () => [...userScans, ...seeds].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [userScans, seeds],
  );
  const current = useMemo(() => history.find((h) => h.id === currentId) ?? seeds[0], [history, currentId, seeds]);

  const addResult = useCallback((r: AnalysisResult) => {
    setUserScans((prev) => [r, ...prev.filter((p) => p.id !== r.id)]);
    setCurrentId(r.id);
  }, []);

  const runScan = useCallback(
    async (input: ScanInput, opts?: { mode?: "auto" | "local" }): Promise<ScanOutcome> => {
      let outcome: ScanOutcome;
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input, mode: opts?.mode ?? "auto" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        outcome = { result: data.result, notice: data.notice };
      } catch (err) {
        if (err instanceof Error && /Provide a conversation|too long|too large|Invalid request|Too many/.test(err.message)) throw err;
        // Network or server failure: the engine also runs in the browser.
        outcome = { result: analyzeLocal(input), notice: "Server unreachable — analysed on-device." };
      }
      addResult(outcome.result);
      return outcome;
    },
    [addResult],
  );

  const addContact = useCallback((c: Omit<Contact, "id">) => {
    setContacts((prev) => [...prev, { ...c, id: `c-${Date.now().toString(36)}` }]);
  }, []);
  const removeContact = useCallback((id: string) => setContacts((prev) => prev.filter((c) => c.id !== id)), []);

  const askCircle = useCallback(
    (analysis: AnalysisResult, message: string) => {
      const req: ReviewRequest = {
        id: `r-${Date.now().toString(36)}`,
        analysisId: analysis.id,
        createdAt: new Date().toISOString(),
        message,
        responses: contacts.map((c) => ({ contactId: c.id, status: "sent" })),
      };
      setRequests((prev) => [req, ...prev]);
      // Simulated responses (demo only — nothing is actually sent).
      contacts.forEach((c, i) => {
        const seenAt = 900 + i * 700;
        const replyAt = 2600 + i * 1500;
        const reply = simulatedReply(analysis);
        const update = (patch: Partial<CircleResponse>) =>
          setRequests((prev) =>
            prev.map((r) =>
              r.id === req.id ? { ...r, responses: r.responses.map((x) => (x.contactId === c.id ? { ...x, ...patch } : x)) } : r,
            ),
          );
        timers.current.push(window.setTimeout(() => update({ status: "seen" }), seenAt));
        timers.current.push(
          window.setTimeout(() => update({ status: "replied", ...reply, at: new Date().toISOString() }), replyAt),
        );
      });
      return req;
    },
    [contacts],
  );

  const clearHistory = useCallback(() => {
    setUserScans([]);
    setRequests([]);
    setFeedbackState({});
    setCurrentId("seed-kyc");
  }, []);

  const setFeedback = useCallback((analysisId: string, f: Omit<Feedback, "at">) => {
    setFeedbackState((prev) => ({ ...prev, [analysisId]: { ...prev[analysisId], ...f, at: new Date().toISOString() } }));
  }, []);

  const value: Store = {
    history,
    current,
    setCurrent: setCurrentId,
    addResult,
    runScan,
    aiStatus,
    contacts,
    addContact,
    removeContact,
    requests,
    askCircle,
    clearHistory,
    feedback,
    setFeedback,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSentinel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSentinel must be used inside SentinelProvider");
  return ctx;
}
