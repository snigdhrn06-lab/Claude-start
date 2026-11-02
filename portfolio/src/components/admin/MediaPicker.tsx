"use client";
/** Modal for choosing (or uploading) files from the media library. */
import { Check, FileText, Loader2, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAdmin, type AdminMedia } from "./AdminProvider";

export function acceptAttr(accept: "image" | "document" | "any") {
  return accept === "image" ? "image/jpeg,image/png,image/webp,image/avif" : accept === "document" ? "application/pdf" : "image/jpeg,image/png,image/webp,image/avif,application/pdf";
}

export function MediaThumb({ m, className }: { m: AdminMedia | undefined; className?: string }) {
  if (!m) return <div className={cn("grid place-items-center bg-surface-2 text-[10px] text-dim", className)}>Missing</div>;
  if (m.kind === "document")
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-muted", className)}>
        <FileText className="h-6 w-6" aria-hidden />
      </div>
    );
  const small = m.variants[0]?.url ?? m.url;
  return <img src={small} alt={m.alt} className={cn("object-cover", className)} loading="lazy" />;
}

export function MediaPicker({ open, accept, multiple, onClose, onSelect }: { open: boolean; accept: "image" | "document" | "any"; multiple?: boolean; onClose: () => void; onSelect: (items: AdminMedia[]) => void }) {
  const { media } = useAdmin();
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setPicked([]);
      media.load();
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = useMemo(
    () => media.items.filter((m) => (accept === "any" || m.kind === accept) && (!q || m.filename.toLowerCase().includes(q.toLowerCase()) || m.alt.toLowerCase().includes(q.toLowerCase()))),
    [media.items, accept, q],
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added = await media.upload(Array.from(files));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (added.length && !multiple) {
      onSelect([added[0]!]);
      onClose();
    } else setPicked((p) => [...added.map((a) => a.id), ...p]);
  }

  function toggle(m: AdminMedia) {
    if (!multiple) {
      onSelect([m]);
      onClose();
      return;
    }
    setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]));
  }

  return (
    <dialog ref={ref} onCancel={(e) => (e.preventDefault(), onClose())} className="h-[min(88vh,48rem)] w-[min(96vw,64rem)] rounded-2xl border border-line/15 bg-surface p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line/10 p-4">
          <h2 className="mr-auto text-lg font-medium">{multiple ? "Choose files" : accept === "document" ? "Choose a document" : "Choose an image"}</h2>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
            <span className="sr-only">Search files</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-48 rounded-lg border border-line/15 bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
          </label>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} Upload
          </button>
          <input ref={fileRef} type="file" accept={acceptAttr(accept)} multiple={multiple} className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-line/15" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {media.loading && !media.loaded ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
            </p>
          ) : list.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-muted">
              <div>
                <p>No {accept === "any" ? "files" : accept === "image" ? "images" : "documents"} yet.</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 text-accent underline underline-offset-4">
                  Upload one
                </button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.map((m) => {
                const sel = picked.includes(m.id);
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => toggle(m)} className={cn("group relative block w-full overflow-hidden rounded-xl border text-left transition", sel ? "border-accent ring-2 ring-accent/40" : "border-line/10 hover:border-line/40")} aria-pressed={multiple ? sel : undefined}>
                      <MediaThumb m={m} className="aspect-square w-full" />
                      <span className="block truncate px-2 py-1.5 text-[11px] text-muted">{m.filename}</span>
                      {sel && (
                        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-ink">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {multiple && (
          <div className="flex items-center justify-end gap-2 border-t border-line/10 p-4">
            <span className="mr-auto text-sm text-muted">{picked.length} selected</span>
            <button type="button" onClick={onClose} className="rounded-lg border border-line/15 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={!picked.length}
              onClick={() => {
                onSelect(picked.map((id) => media.items.find((m) => m.id === id)!).filter(Boolean));
                onClose();
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              Add selected
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
