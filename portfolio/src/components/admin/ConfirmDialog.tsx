"use client";
/** Accessible confirmation dialog built on the native <dialog> element. */
import { useEffect, useRef } from "react";

export function ConfirmDialog({ open, title, body, confirmLabel = "Delete", danger = true, busy, onConfirm, onCancel }: { open: boolean; title: string; body?: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => (e.preventDefault(), onCancel())} className="w-[min(92vw,28rem)] rounded-2xl border border-line/15 bg-surface p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <h2 className="text-lg font-medium">{title}</h2>
        {body && <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-line/15 px-4 py-2 text-sm hover:border-line/40">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${danger ? "bg-danger text-black hover:bg-danger/90" : "bg-accent text-accent-ink hover:bg-accent/90"}`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
