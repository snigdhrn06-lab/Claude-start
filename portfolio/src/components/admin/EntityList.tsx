"use client";
/** Generic content list: search, status filter, reorder, quick publish/unpublish, delete. */
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ENTITIES, type EntityKey } from "@/lib/content/registry";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import { PageHeader } from "./AdminShell";
import { ConfirmDialog } from "./ConfirmDialog";

export type ListRow = { id: string; title: string; subtitle: string; status: string; featured: boolean; updatedAt: string; publicPath: string | null };

export function EntityList({ entity, initialRows }: { entity: EntityKey; initialRows: ListRow[] }) {
  const cfg = ENTITIES[entity];
  const router = useRouter();
  const { api, toast } = useAdmin();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [confirm, setConfirm] = useState<ListRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => rows.filter((r) => (status === "all" || r.status === status) && (!q || `${r.title} ${r.subtitle}`.toLowerCase().includes(q.toLowerCase()))),
    [rows, q, status],
  );
  const canReorder = !q && status === "all";

  async function move(i: number, d: number) {
    const next = [...rows];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    setRows(next);
    const r = await api("POST", `/api/admin/${entity}/reorder`, { ids: next.map((x) => x.id) });
    if (!r.ok) {
      toast(r.error, "error");
      setRows(rows);
    } else router.refresh();
  }

  async function togglePublish(row: ListRow) {
    const got = await api<{ item: Record<string, unknown> }>("GET", `/api/admin/${entity}/${row.id}`);
    if (!got.ok) return toast(got.error, "error");
    const nextStatus = row.status === "published" ? "draft" : "published";
    const r = await api("PUT", `/api/admin/${entity}/${row.id}`, { ...got.data.item, status: nextStatus });
    if (!r.ok) return toast(r.error, "error");
    setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, status: nextStatus } : x)));
    toast(nextStatus === "published" ? "Published. It's live on the site now." : "Moved to drafts. It's hidden from the site.");
    router.refresh();
  }

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    const r = await api("DELETE", `/api/admin/${entity}/${confirm.id}`);
    setBusy(false);
    if (!r.ok) return toast(r.error, "error");
    setRows((rs) => rs.filter((x) => x.id !== confirm.id));
    toast(`Deleted "${confirm.title}"`);
    setConfirm(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={cfg.label}
        description={cfg.description}
        actions={
          <Link href={`/admin/${entity}/new`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent/90">
            <Plus className="h-4 w-4" aria-hidden /> New {cfg.singular.toLowerCase()}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Search {cfg.label}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cfg.label.toLowerCase()}…`} className="w-full rounded-lg border border-line/15 bg-bg-2 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" />
        </label>
        <div className="inline-flex rounded-lg border border-line/15 p-1" role="group" aria-label="Filter by status">
          {(["all", "published", "draft"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s} className={cn("rounded-md px-3 py-1.5 text-xs capitalize", status === s ? "bg-white/10 text-fg" : "text-muted hover:text-fg")}>
              {s === "all" ? `All (${rows.length})` : `${s} (${rows.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line/20 p-12 text-center">
          <p className="text-muted">No {cfg.label.toLowerCase()} yet.</p>
          <Link href={`/admin/${entity}/new`} className="mt-4 inline-flex items-center gap-2 text-sm text-accent underline underline-offset-4">
            <Plus className="h-4 w-4" aria-hidden /> Create the first one
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-line/10 p-8 text-center text-sm text-muted">Nothing matches your filters.</p>
      ) : (
        <ul className="divide-y divide-line/10 overflow-hidden rounded-2xl border border-line/10 bg-bg-2">
          {filtered.map((r) => {
            const i = rows.findIndex((x) => x.id === r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                {canReorder && (
                  <div className="flex shrink-0 flex-col">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-0.5 text-dim hover:text-fg disabled:opacity-20" aria-label={`Move ${r.title} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="p-0.5 text-dim hover:text-fg disabled:opacity-20" aria-label={`Move ${r.title} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <Link href={`/admin/${entity}/${r.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                    {r.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" aria-label="Featured" />}
                    <span className="truncate">{r.title || "(untitled)"}</span>
                  </p>
                  {r.subtitle && <p className="truncate text-xs text-muted">{r.subtitle}</p>}
                </Link>
                <button
                  type="button"
                  onClick={() => togglePublish(r)}
                  className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-label transition-colors", r.status === "published" ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-white/[0.06] text-muted hover:bg-white/10")}
                  title={r.status === "published" ? "Click to unpublish" : "Click to publish"}
                >
                  {r.status}
                </button>
                <span className="hidden w-24 shrink-0 text-right text-xs text-dim md:block">{new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <div className="flex shrink-0 items-center gap-1">
                  {r.publicPath && (
                    <a href={r.publicPath} target="_blank" rel="noopener" className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-fg" aria-label={r.status === "published" ? "View on site" : "Preview draft"} title={r.status === "published" ? "View on site" : "Preview draft"}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Link href={`/admin/${entity}/${r.id}`} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-fg" aria-label={`Edit ${r.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button type="button" onClick={() => setConfirm(r)} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-danger" aria-label={`Delete ${r.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!canReorder && rows.length > 1 && <p className="mt-3 text-xs text-dim">Clear the search and filter to reorder.</p>}

      <ConfirmDialog
        open={!!confirm}
        title={`Delete "${confirm?.title}"?`}
        body="This permanently removes it from the database and the public site. This can't be undone."
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
