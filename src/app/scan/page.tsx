"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ClipboardPaste, CreditCard, FileImage, ImageUp, Loader2, ScanLine, ShieldOff, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { DemoScenarioSelector } from "@/components/DemoScenarioSelector";
import { IMAGE_STEPS, ScanProgress, TEXT_STEPS } from "@/components/ScanProgress";
import { ErrorState, PageHeader, cn } from "@/components/ui";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import { parseSvgScreenshot, readFile } from "@/lib/screenshot";
import { useSentinel } from "@/lib/store";
import type { AnalysisResult, PaymentDetails, ScanInput } from "@/lib/types";

type Tab = "text" | "image" | "payment";
type Phase = "input" | "scanning" | "error";

const TABS: { id: Tab; label: string; icon: typeof ClipboardPaste }[] = [
  { id: "text", label: "Paste conversation", icon: ClipboardPaste },
  { id: "image", label: "Upload screenshot", icon: ImageUp },
  { id: "payment", label: "Payment details", icon: CreditCard },
];

const EMPTY_PAYMENT: PaymentDetails = { recipient: "", amount: 0, method: "UPI", reason: "" };

export default function ScanPage() {
  const router = useRouter();
  const { runScan } = useSentinel();
  const [tab, setTab] = useState<Tab>("text");
  const [conversation, setConversation] = useState("");
  const [payment, setPayment] = useState<PaymentDetails>(EMPTY_PAYMENT);
  const [scenarioId, setScenarioId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("input");
  const [steps, setSteps] = useState(TEXT_STEPS);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [scanInputText, setScanInputText] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [image, setImage] = useState<{ name: string; url: string; file?: File } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastInput = useRef<ScanInput | null>(null);

  const loadScenario = (s: Scenario) => {
    setScenarioId(s.id);
    setConversation(s.conversation);
    setPayment(s.payment);
    if (tab === "image") setTab("text");
  };

  const start = useCallback(
    async (input: ScanInput, stepList = TEXT_STEPS, textForLog?: string) => {
      lastInput.current = input;
      setError(null);
      setResult(null);
      setSteps(stepList);
      setScanInputText(textForLog ?? input.conversation);
      setPhase("scanning");
      try {
        const out = await runScan(input);
        setNotice(out.notice);
        setResult(out.result);
      } catch (e) {
        setPhase("error");
        setError({ title: "Analysis failed", message: (e as Error).message });
      }
    },
    [runScan],
  );

  const scanText = () => {
    const hasPayment = payment.recipient.trim() && payment.amount > 0;
    if (!conversation.trim() && !hasPayment) {
      setError({ title: "Nothing to analyse", message: "Paste a conversation, upload a screenshot, or enter payment details." });
      return;
    }
    const sc = SCENARIOS.find((s) => s.id === scenarioId && s.conversation === conversation);
    start({
      conversation,
      payment: hasPayment ? payment : undefined,
      source: tab === "payment" ? "payment" : sc ? "scenario" : "text",
      scenarioId: sc?.id,
      title: sc?.short,
    });
  };

  const handleFile = async (file: File) => {
    setImageError(null);
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) {
      setImageError("Unsupported file. Use PNG, JPG, WEBP or SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image is larger than 5 MB.");
      return;
    }
    const url = await readFile(file, "dataUrl");
    setImage({ name: file.name, url, file });
  };

  const scanImage = async () => {
    if (!image) return;
    setImageError(null);
    setSteps(IMAGE_STEPS);
    setResult(null);
    setScanInputText("");
    setPhase("scanning");
    try {
      let text: string | null = null;
      if (image.url.startsWith("data:image/svg+xml")) {
        const raw = image.file ? await readFile(image.file, "text") : await (await fetch(image.url)).text();
        text = parseSvgScreenshot(raw);
      } else {
        const res = await fetch("/api/ocr", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: image.url }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || "Text extraction failed.");
        text = data.text;
      }
      if (!text) throw new Error("No conversation text could be found in this image.");
      setConversation(text);
      await start({ conversation: text, source: "image", imageName: image.name }, IMAGE_STEPS, text);
    } catch (e) {
      setPhase("input");
      setImageError((e as Error).message);
    }
  };

  const loadSampleImage = async (id: string) => {
    const res = await fetch(`/samples/${id}.svg`);
    const blob = await res.blob();
    const file = new File([blob], `${id}-screenshot.svg`, { type: "image/svg+xml" });
    await handleFile(file);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Live scan"
        title="Understand the decision before you make it."
        description="Give Sentinel the conversation behind a payment. It extracts manipulation signals, reconstructs the attack and scores the risk — before any money moves."
      />

      <AnimatePresence mode="wait">
        {phase === "scanning" ? (
          <motion.div key="scan" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-4xl">
            <ScanProgress
              steps={steps}
              result={result}
              input={scanInputText || "…"}
              onComplete={() => router.push("/analysis")}
            />
            {notice && <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-wider text-caution">{notice}</p>}
          </motion.div>
        ) : (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-white/[0.07] bg-ink-900 p-1" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[13px] transition-colors",
                      tab === t.id ? "text-fg" : "text-fg-dim hover:text-fg-muted",
                    )}
                  >
                    {tab === t.id && <motion.span layoutId="scan-tab" className="absolute inset-0 rounded-md bg-white/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <t.icon className="relative h-3.5 w-3.5" />
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>

              {tab === "text" && (
                <div className="panel p-4">
                  <label htmlFor="conv" className="label mb-2 block">
                    Conversation
                  </label>
                  <textarea
                    id="conv"
                    value={conversation}
                    onChange={(e) => {
                      setConversation(e.target.value);
                      setScenarioId(undefined);
                    }}
                    rows={12}
                    placeholder={"Paste the messages here. One per line works best:\n\nSecureBank Alerts: Your KYC expires today…\nYou: Is this genuine?"}
                    className="input min-h-[260px] resize-y font-mono text-[12.5px] leading-relaxed"
                  />
                  <p className="mt-2 text-[11.5px] text-fg-dim">Tip: prefix lines with the sender name (e.g. “Bank: …”, “You: …”) so Sentinel can separate who said what.</p>
                </div>
              )}

              {tab === "image" && (
                <div className="panel p-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                    onClick={() => fileRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                    className={cn(
                      "group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed p-6 text-center transition",
                      dragging ? "border-risk/60 bg-risk/[0.05]" : "border-white/[0.12] hover:border-white/25 hover:bg-white/[0.015]",
                    )}
                  >
                    <div className="bg-grid-fine absolute inset-0 opacity-40 mask-radial" />
                    {image ? (
                      <div className="relative flex w-full flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt="Uploaded screenshot preview" className="max-h-56 rounded-md border border-white/10 object-contain" />
                        <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
                          <FileImage className="h-3.5 w-3.5" /> {image.name}
                          <button
                            aria-label="Remove image"
                            className="rounded p-0.5 text-fg-dim hover:text-fg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImage(null);
                              setImageError(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition group-hover:scale-105">
                          <Upload className="h-5 w-5 text-fg-muted" />
                        </div>
                        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.08em]">Drop a conversation here</div>
                        <div className="mt-1 text-[13px] text-fg-dim">or click to choose a screenshot · PNG, JPG, WEBP, SVG · 5 MB</div>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="label mr-1">Sample screenshots</span>
                    {SCENARIOS.map((s) => (
                      <button key={s.id} onClick={() => loadSampleImage(s.id)} className="chip cursor-pointer normal-case tracking-normal hover:border-white/20 hover:text-fg">
                        <FileImage className="h-3 w-3" /> {s.short}
                      </button>
                    ))}
                  </div>
                  {imageError && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-caution/25 bg-caution/[0.06] px-3 py-2 text-[12.5px] text-caution" role="alert">
                      <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {imageError}{" "}
                        <button className="underline underline-offset-2" onClick={() => setTab("text")}>
                          Paste text instead
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {tab === "payment" && (
                <div className="panel grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="p-rec" className="label mb-1.5 block">
                      Recipient
                    </label>
                    <input id="p-rec" className="input font-mono" placeholder="name@upi or account" value={payment.recipient} onChange={(e) => setPayment({ ...payment, recipient: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="p-amt" className="label mb-1.5 block">
                      Amount (₹)
                    </label>
                    <input
                      id="p-amt"
                      inputMode="numeric"
                      className="input num font-mono"
                      placeholder="18,500"
                      value={payment.amount ? payment.amount.toLocaleString("en-IN") : ""}
                      onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                    />
                  </div>
                  <div>
                    <label htmlFor="p-method" className="label mb-1.5 block">
                      Payment method
                    </label>
                    <select id="p-method" className="input" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                      {["UPI", "UPI collect request", "IMPS / NEFT", "Card", "Wallet"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="p-reason" className="label mb-1.5 block">
                      Reason for payment
                    </label>
                    <input id="p-reason" className="input" placeholder="e.g. KYC verification" value={payment.reason} onChange={(e) => setPayment({ ...payment, reason: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="p-conv" className="label mb-1.5 block">
                      Conversation (optional)
                    </label>
                    <textarea id="p-conv" rows={5} className="input resize-y font-mono text-[12.5px]" placeholder="Paste what the sender said…" value={conversation} onChange={(e) => setConversation(e.target.value)} />
                  </div>
                  <p className="text-[11.5px] text-fg-dim sm:col-span-2">Sentinel never asks for passwords, OTPs, PINs or CVVs. Don&apos;t enter them anywhere in this demo.</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {tab === "image" ? (
                  <button className="btn-primary h-11 px-6" onClick={scanImage} disabled={!image}>
                    <ScanLine className="h-4 w-4" /> Scan screenshot
                  </button>
                ) : (
                  <button className="btn-primary h-11 px-6" onClick={scanText}>
                    <ScanLine className="h-4 w-4" /> Run Sentinel analysis
                  </button>
                )}
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-dim">Demo environment — no real transactions</span>
              </div>
              {error && (
                <div className="mt-4">
                  <ErrorState
                    title={error.title}
                    message={error.message}
                    onRetry={lastInput.current && phase === "error" ? () => start(lastInput.current!) : undefined}
                  />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="label mb-3">Or use a demo scenario</div>
              <DemoScenarioSelector layout="stack" selectedId={scenarioId} onSelect={loadScenario} />
              <p className="mt-3 text-[11.5px] leading-relaxed text-fg-dim">All scenarios are synthetic. Names, handles and account numbers are fictional.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {phase === "scanning" && !result && steps === IMAGE_STEPS && !scanInputText && (
        <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[11px] text-fg-dim">
          <Loader2 className="h-3 w-3 animate-spin" /> Extracting text from image…
        </div>
      )}
    </div>
  );
}
