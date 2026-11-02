"use client";
/**
 * Admin client context: CSRF-aware API client, toast notifications, and a shared media library cache.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { PublicMedia } from "@/lib/media-url";

export type AdminMedia = PublicMedia & { createdAt: string; usage: string[] };
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string>; status: number };
type Toast = { id: number; message: string; kind: "success" | "error" | "info" };

type Ctx = {
  email: string;
  api: <T = unknown>(method: string, url: string, body?: unknown) => Promise<ApiResult<T>>;
  toast: (message: string, kind?: Toast["kind"]) => void;
  media: { items: AdminMedia[]; loaded: boolean; loading: boolean; load: (force?: boolean) => Promise<void>; upload: (files: File[]) => Promise<AdminMedia[]>; remove: (id: string) => void; patch: (id: string, p: Partial<AdminMedia>) => void };
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ csrf, email, children }: { csrf: string; email: string; children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [items, setItems] = useState<AdminMedia[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef<Promise<void> | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);

  const api = useCallback(
    async <T,>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> => {
      try {
        const isForm = typeof FormData !== "undefined" && body instanceof FormData;
        const res = await fetch(url, {
          method,
          headers: { "x-csrf-token": csrf, ...(body && !isForm ? { "content-type": "application/json" } : {}) },
          body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
          credentials: "same-origin",
        });
        if (res.status === 401) {
          window.location.href = "/admin/login?expired=1";
          return { ok: false, error: "Your session has expired.", status: 401 };
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})`, fields: data.fields, status: res.status };
        return { ok: true, data: data as T };
      } catch {
        return { ok: false, error: "Network error. Check your connection and try again.", status: 0 };
      }
    },
    [csrf],
  );

  const load = useCallback(
    async (force = false) => {
      if (loaded && !force) return;
      if (loadingRef.current) return loadingRef.current;
      setLoading(true);
      loadingRef.current = (async () => {
        const r = await api<{ items: AdminMedia[] }>("GET", "/api/admin/media");
        if (r.ok) {
          setItems(r.data.items);
          setLoaded(true);
        } else toast(r.error, "error");
        setLoading(false);
        loadingRef.current = null;
      })();
      return loadingRef.current;
    },
    [api, loaded, toast],
  );

  const upload = useCallback(
    async (files: File[]) => {
      const out: AdminMedia[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api<{ items: AdminMedia[] }>("POST", "/api/admin/media", fd);
        if (r.ok) out.push(...r.data.items);
        else toast(`${file.name}: ${r.error}`, "error");
      }
      if (out.length) {
        setItems((prev) => [...out, ...prev]);
        toast(out.length === 1 ? "File uploaded" : `${out.length} files uploaded`);
      }
      return out;
    },
    [api, toast],
  );

  const value = useMemo<Ctx>(
    () => ({
      email,
      api,
      toast,
      media: {
        items,
        loaded,
        loading,
        load,
        upload,
        remove: (id) => setItems((p) => p.filter((m) => m.id !== id)),
        patch: (id, patch) => setItems((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m))),
      },
    }),
    [email, api, toast, items, loaded, loading, load, upload],
  );

  return (
    <AdminCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,24rem)] flex-col gap-2" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${
              t.kind === "error" ? "border-danger/40 bg-[#2a1414]/95 text-[#ffd0d0]" : t.kind === "info" ? "border-line/15 bg-surface-2/95 text-fg" : "border-accent/40 bg-[#171d0c]/95 text-fg"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AdminCtx.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
