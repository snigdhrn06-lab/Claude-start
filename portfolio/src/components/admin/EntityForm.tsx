"use client";
/** Generic content editor generated from the registry config. */
import { ArrowLeft, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ENTITIES, type EntityKey, type Field } from "@/lib/content/registry";
import { useAdmin } from "./AdminProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { FieldInput, type RelationOptions, type Values } from "./fields";

function defaults(fields: Field[]): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.type === "boolean") v[f.name] = false;
    else if (f.type === "tags" || f.type === "list" || f.type === "gallery" || f.type === "repeater") v[f.name] = [];
    else if (f.type === "select") v[f.name] = f.options?.[0]?.value ?? "";
    else if (f.type === "status") v[f.name] = "draft";
    else if (f.type === "media" || f.type === "relation" || f.type === "number") v[f.name] = null;
    else v[f.name] = "";
  }
  return v;
}

export function EntityForm({ entity, initial, id, relations, publicPath }: { entity: EntityKey; initial: Values | null; id: string | null; relations: RelationOptions; publicPath: string | null }) {
  const cfg = ENTITIES[entity];
  const router = useRouter();
  const { api, toast } = useAdmin();
  const start = useMemo(() => ({ ...defaults(cfg.fields), ...(initial ?? {}) }), [cfg.fields, initial]);
  const [values, setValues] = useState<Values>(start);
  const [baseline, setBaseline] = useState<Values>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !saving) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const groups = useMemo(() => {
    const out: { name: string; fields: Field[] }[] = [];
    for (const f of cfg.fields) {
      const g = f.group ?? "Details";
      let bucket = out.find((x) => x.name === g);
      if (!bucket) out.push((bucket = { name: g, fields: [] }));
      bucket.fields.push(f);
    }
    return out;
  }, [cfg.fields]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    const r = id ? await api<{ item: Values }>("PUT", `/api/admin/${entity}/${id}`, values) : await api<{ item: Values }>("POST", `/api/admin/${entity}`, values);
    setSaving(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setFormError(r.error);
      toast(r.error, "error");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    toast(id ? "Saved. The public site is updated." : `${cfg.singular} created`);
    const merged = { ...values, ...r.data.item, gallery: values.gallery };
    setValues(merged);
    setBaseline(merged);
    if (!id) router.replace(`/admin/${entity}/${r.data.item.id}`);
    else router.refresh();
  }

  async function remove() {
    if (!id) return;
    setDeleting(true);
    const r = await api("DELETE", `/api/admin/${entity}/${id}`);
    setDeleting(false);
    if (!r.ok) return toast(r.error, "error");
    toast("Deleted");
    router.replace(`/admin/${entity}`);
    router.refresh();
  }

  const title = (values[cfg.titleField] as string) || (id ? "(untitled)" : `New ${cfg.singular.toLowerCase()}`);

  return (
    <form onSubmit={save} noValidate className="pb-28">
      <Link href={`/admin/${entity}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {cfg.label}
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-label text-dim">{id ? `Edit ${cfg.singular.toLowerCase()}` : `New ${cfg.singular.toLowerCase()}`}</p>
          <h1 className="mt-1 truncate font-display text-4xl">{title}</h1>
        </div>
        {publicPath && (
          <a href={publicPath} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-line/15 px-3 py-2 text-sm text-muted hover:text-fg">
            <ExternalLink className="h-4 w-4" aria-hidden /> {values.status === "published" ? "View on site" : "Preview draft"}
          </a>
        )}
      </div>

      {formError && (
        <div className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-[#ffd0d0]" role="alert">
          {formError}
          {Object.keys(errors).length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  {cfg.fields.find((f) => f.name === k.split(".")[0])?.label ?? k}: {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <fieldset key={g.name} className="rounded-2xl border border-line/10 bg-bg-2 p-5 sm:p-6">
            <legend className="sr-only">{g.name}</legend>
            <p className="mb-5 font-mono text-[11px] uppercase tracking-label text-dim">{g.name}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {g.fields.map((f) => (
                <FieldInput key={f.name} field={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} relations={relations} error={errors[f.name]} errors={errors} />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/10 bg-bg/90 backdrop-blur-xl lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <span className="mr-auto text-xs text-dim">{dirty ? "Unsaved changes" : id ? "All changes saved" : ""}</span>
          {id && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted hover:text-danger">
              <Trash2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent/90 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : id ? "Save changes" : `Create ${cfg.singular.toLowerCase()}`}
          </button>
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} title={`Delete "${title}"?`} body="This permanently removes it from the database and the public site." busy={deleting} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </form>
  );
}
