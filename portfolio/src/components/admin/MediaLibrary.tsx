"use client";
/** Media library page: upload (button or drag & drop), alt text, usage, copy link, delete. */
import { Check, Copy, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAdmin, type AdminMedia } from "./AdminProvider";
import { PageHeader } from "./AdminShell";
import { ConfirmDialog } from "./ConfirmDialog";
import { acceptAttr, MediaThumb } from "./MediaPicker";

function fmt(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AltEditor({ m }: { m: AdminMedia }) {
  const { api, toast, media } = useAdmin();
  const [alt, setAlt] = useState(m.alt);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  async function save() {
    if (alt === m.alt) return;
    setState("saving");
    const r = await api("PATCH", `/api/admin/media/${m.id}`, { alt });
    if (!r.ok) {
      toast(r.error, "error");
      setState("idle");
      return;
    }
    media.patch(m.id, { alt });
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }
  return (
    <label className="block">
      <span className="sr-only">Alt text for {m.filename}</span>
      <div className="relative">
        <input value={alt} onChange={(e) => setAlt(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), e.preventDefault())} placeholder={m.kind === "image" ? "Describe the image (alt text)" : "Description"} className="w-full rounded-md border border-line/10 bg-bg px-2 py-1.5 pr-7 text-xs outline-none focus:border-accent" />
        {state !== "idle" && <span className="absolute right-2 top-1/2 -translate-y-1/2">{state === "saving" ? <Loader2 className="h-3 w-3 animate-spin text-dim" /> : <Check className="h-3 w-3 text-accent" />}</span>}
      </div>
    </label>
  );
}

export function MediaLibrary() {
  const { media, api, toast } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<"all" | "image" | "document">("all");
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<AdminMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    media.load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    setUploading(true);
    await media.upload(Array.from(files));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    const r = await api("DELETE", `/api/admin/media/${confirm.id}`);
    setBusy(false);
    if (!r.ok) return toast(r.error, "error");
    media.remove(confirm.id);
    toast("File deleted");
    setConfirm(null);
  }

  const items = media.items.filter((m) => filter === "all" || m.kind === filter);

  return (
    <div
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
    >
      <PageHeader
        title="Media"
        description="Photos, screenshots, certificates and PDFs. Images are optimised into responsive WebP sizes automatically, and GPS and camera metadata is stripped."
        actions={
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} Upload files
          </button>
        }
      />
      <input ref={fileRef} type="file" multiple accept={acceptAttr("any")} className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className={cn("mb-6 rounded-2xl border border-dashed p-6 text-center text-sm transition-colors", drag ? "border-accent bg-accent/5 text-fg" : "border-line/20 text-muted")}>
        Drag &amp; drop files here. JPEG, PNG, WebP or AVIF up to 12 MB; PDF up to 20 MB.
      </div>
      <div className="mb-4 inline-flex rounded-lg border border-line/15 p-1" role="group" aria-label="Filter">
        {(["all", "image", "document"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-xs capitalize", filter === f ? "bg-white/10 text-fg" : "text-muted")}>
            {f === "all" ? "All" : f === "image" ? "Images" : "Documents"}
          </button>
        ))}
      </div>
      {media.loading && !media.loaded ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-line/10 p-10 text-center text-sm text-muted">No files yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-line/10 bg-bg-2">
              <a href={m.url} target="_blank" rel="noopener" className="block" aria-label={`Open ${m.filename}`}>
                {m.kind === "image" ? <MediaThumb m={m} className="aspect-[4/3] w-full" /> : <div className="grid aspect-[4/3] place-items-center bg-surface-2 text-muted"><FileText className="h-10 w-10" aria-hidden /></div>}
              </a>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm" title={m.filename}>
                  {m.filename}
                </p>
                <p className="text-[11px] text-dim">
                  {m.kind === "image" && m.width ? `${m.width}×${m.height} · ` : ""}
                  {fmt(m.size)} · {new Date(m.createdAt).toLocaleDateString("en-IN")}
                </p>
                <AltEditor m={m} />
                {m.usage.length > 0 ? (
                  <p className="truncate text-[11px] text-accent/90" title={m.usage.join("\n")}>
                    Used in: {m.usage.join(", ")}
                  </p>
                ) : (
                  <p className="text-[11px] text-dim">Not used anywhere</p>
                )}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(new URL(m.url, location.origin).toString()).catch(() => {});
                      setCopied(m.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-fg"
                    aria-label="Copy link"
                  >
                    {copied === m.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => setConfirm(m)} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-danger" aria-label={`Delete ${m.filename}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Delete ${confirm?.filename}?`}
        body={
          confirm?.usage.length ? (
            <>
              This file is in use and will disappear from: <strong className="text-fg">{confirm.usage.join(", ")}</strong>. This can&apos;t be undone.
            </>
          ) : (
            "This permanently deletes the file. This can't be undone."
          )
        }
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
