"use client";
/**
 * Field components for the admin editors. FieldInput renders any registry Field by type.
 * Values are read/written by (possibly dotted) path on a plain object.
 */
import { ArrowDown, ArrowUp, Eye, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/shared/Markdown";
import type { Field } from "@/lib/content/registry";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import { MediaPicker, MediaThumb } from "./MediaPicker";

export type Values = Record<string, unknown>;
export type RelationOptions = Record<string, { value: string; label: string }[]>;

export function getPath(obj: Values, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Values)[k] : undefined), obj);
}
export function setPath(obj: Values, path: string, value: unknown): Values {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head!]: value };
  return { ...obj, [head!]: setPath(((obj[head!] as Values) ?? {}) as Values, rest.join("."), value) };
}

export const inputCls = "w-full rounded-lg border border-line/15 bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-dim focus:border-accent aria-[invalid=true]:border-danger";

function Label({ field, id }: { field: Field; id: string }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg/90">
      {field.label}
      {field.required && <span className="ml-0.5 text-accent">*</span>}
    </label>
  );
}

export function FieldShell({ field, id, error, children, labelFor = true }: { field: Field; id: string; error?: string; children: React.ReactNode; labelFor?: boolean }) {
  return (
    <div className={cn(field.half ? "sm:col-span-1" : "sm:col-span-2")}>
      {field.type !== "boolean" && (labelFor ? <Label field={field} id={id} /> : <p className="mb-1.5 block text-sm font-medium text-fg/90">{field.label}</p>)}
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : field.help ? (
        <p className="mt-1.5 text-xs leading-relaxed text-dim">{field.help}</p>
      ) : null}
    </div>
  );
}

function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-fg/90">
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-white/15")}>
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[1.375rem]" : "translate-x-0.5")} />
      </button>
      {label}
    </label>
  );
}

function TagsInput({ value, onChange, id, placeholder }: { value: string[]; onChange: (v: string[]) => void; id: string; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  return (
    <div className={cn(inputCls, "flex min-h-[2.75rem] flex-wrap items-center gap-1.5 py-1.5")}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-2 py-1 text-xs">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-dim hover:text-fg">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-dim"
      />
    </div>
  );
}

function MediaInput({ value, onChange, accept }: { value: string | null; onChange: (v: string | null) => void; accept: "image" | "document" | "any" }) {
  const { media } = useAdmin();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (value) media.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const m = value ? media.items.find((x) => x.id === value) : undefined;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line/15 bg-bg p-3">
      {value ? (media.loaded ? <MediaThumb m={m} className="h-20 w-20 shrink-0 rounded-md" /> : <div className="h-20 w-20 shrink-0 animate-pulse rounded-md bg-surface-2" />) : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-dashed border-line/20 text-dim"><ImagePlus className="h-5 w-5" aria-hidden /></div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{value ? m?.filename ?? (media.loaded ? "File not found" : "Loading…") : "No file selected"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-line/15 px-3 py-1.5 text-xs hover:border-line/40">
            {value ? "Replace" : "Choose or upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-danger">
              Remove
            </button>
          )}
        </div>
      </div>
      <MediaPicker open={open} accept={accept} onClose={() => setOpen(false)} onSelect={(items) => onChange(items[0]?.id ?? null)} />
    </div>
  );
}

type GalleryItem = { mediaId: string; caption: string };
function GalleryInput({ value, onChange }: { value: GalleryItem[]; onChange: (v: GalleryItem[]) => void }) {
  const { media } = useAdmin();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (value.length) media.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (i: number, d: number) => {
    const next = [...value];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((g, i) => (
        <div key={g.mediaId} className="flex items-center gap-3 rounded-lg border border-line/15 bg-bg p-2">
          {media.loaded ? <MediaThumb m={media.items.find((m) => m.id === g.mediaId)} className="h-16 w-24 shrink-0 rounded-md" /> : <div className="h-16 w-24 shrink-0 animate-pulse rounded-md bg-surface-2" />}
          <input value={g.caption} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} placeholder="Caption: what does this image show?" className={cn(inputCls, "flex-1")} aria-label={`Caption for image ${i + 1}`} />
          <div className="flex shrink-0 gap-1">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-md border border-line/15 disabled:opacity-30" aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line/15 disabled:opacity-30" aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-md border border-line/15 hover:text-danger" aria-label="Remove image">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-line/25 px-4 py-2.5 text-sm text-muted hover:border-accent hover:text-fg">
        <Plus className="h-4 w-4" aria-hidden /> Add images
      </button>
      <MediaPicker
        open={open}
        accept="image"
        multiple
        onClose={() => setOpen(false)}
        onSelect={(items) => onChange([...value, ...items.filter((m) => !value.some((g) => g.mediaId === m.id)).map((m) => ({ mediaId: m.id, caption: "" }))])}
      />
    </div>
  );
}

function RepeaterInput({ field, value, onChange, relations, errors, path }: { field: Field; value: Values[]; onChange: (v: Values[]) => void; relations: RelationOptions; errors: Record<string, string>; path: string }) {
  const sub = field.fields ?? [];
  const blank = () => Object.fromEntries(sub.map((f) => [f.name, f.type === "boolean" ? true : ""]));
  const move = (i: number, d: number) => {
    const next = [...value];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {value.map((row, i) => (
        <div key={i} className="rounded-xl border border-line/15 bg-bg/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-label text-dim">{field.fixed && typeof row.key === "string" ? row.key : `#${i + 1}`}</span>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-7 place-items-center rounded-md border border-line/15 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line/15 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              {!field.fixed && (
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-md border border-line/15 hover:text-danger" aria-label="Remove row">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {sub.map((f) => (
              <FieldInput key={f.name} field={{ ...f, half: f.type !== "textarea" }} value={row[f.name]} onChange={(v) => onChange(value.map((r, j) => (j === i ? { ...r, [f.name]: v } : r)))} relations={relations} error={errors[`${path}.${i}.${f.name}`]} idPrefix={`${path}-${i}`} errors={errors} />
            ))}
          </div>
        </div>
      ))}
      {!field.fixed && (
        <button type="button" onClick={() => onChange([...value, blank()])} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-line/25 px-4 py-2.5 text-sm text-muted hover:border-accent hover:text-fg">
          <Plus className="h-4 w-4" aria-hidden /> Add {field.label.toLowerCase().replace(/s$/, "")}
        </button>
      )}
    </div>
  );
}

function MarkdownInput({ id, value, onChange, rows, invalid }: { id: string; value: string; onChange: (v: string) => void; rows?: number; invalid?: boolean }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line/15">
      <div className="flex items-center justify-between border-b border-line/10 bg-white/[0.02] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-label text-dim">Markdown · **bold** · - list · [link](https://…)</span>
        <button type="button" onClick={() => setPreview((p) => !p)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg" aria-pressed={preview}>
          {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[8rem] bg-bg p-4">{value.trim() ? <Markdown className="!text-sm">{value}</Markdown> : <p className="text-sm text-dim">Nothing to preview.</p>}</div>
      ) : (
        <textarea id={id} value={value} rows={rows ?? 6} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} className="block w-full resize-y bg-bg px-3 py-2.5 font-mono text-[13px] leading-relaxed text-fg outline-none" />
      )}
    </div>
  );
}

export function FieldInput({ field, value, onChange, relations, error, idPrefix = "f", errors = {} }: { field: Field; value: unknown; onChange: (v: unknown) => void; relations: RelationOptions; error?: string; idPrefix?: string; errors?: Record<string, string> }) {
  const id = `${idPrefix}-${field.name.replace(/\./g, "-")}`;
  const aria = { "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-err` : undefined };
  const str = (value as string | null | undefined) ?? "";

  switch (field.type) {
    case "boolean":
      return (
        <FieldShell field={field} id={id} error={error}>
          <Switch id={id} checked={!!value} onChange={onChange} label={field.label} />
        </FieldShell>
      );
    case "textarea":
      return (
        <FieldShell field={field} id={id} error={error}>
          <textarea id={id} value={str} rows={field.rows ?? 3} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "resize-y leading-relaxed")} {...aria} />
        </FieldShell>
      );
    case "markdown":
      return (
        <FieldShell field={field} id={id} error={error}>
          <MarkdownInput id={id} value={str} onChange={onChange} rows={field.rows} invalid={!!error} />
        </FieldShell>
      );
    case "number":
      return (
        <FieldShell field={field} id={id} error={error}>
          <input id={id} type="number" inputMode="numeric" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={inputCls} {...aria} />
        </FieldShell>
      );
    case "select":
      return (
        <FieldShell field={field} id={id} error={error}>
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={inputCls} {...aria}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "relation":
      return (
        <FieldShell field={field} id={id} error={error}>
          <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={inputCls} {...aria}>
            <option value="">None</option>
            {(relations[field.relation!] ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "status":
      return (
        <FieldShell field={field} id={id} error={error} labelFor={false}>
          <div role="radiogroup" aria-label={field.label} className="inline-flex rounded-lg border border-line/15 p-1">
            {(["draft", "published"] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)} className={cn("rounded-md px-4 py-1.5 text-sm capitalize transition-colors", value === s ? (s === "published" ? "bg-accent text-accent-ink" : "bg-white/10 text-fg") : "text-muted hover:text-fg")}>
                {s}
              </button>
            ))}
          </div>
        </FieldShell>
      );
    case "tags":
      return (
        <FieldShell field={field} id={id} error={error}>
          <TagsInput id={id} value={(value as string[]) ?? []} onChange={onChange} placeholder={field.placeholder} />
        </FieldShell>
      );
    case "list":
      return (
        <FieldShell field={field} id={id} error={error}>
          <textarea
            id={id}
            value={((value as string[]) ?? []).join("\n")}
            rows={Math.max(3, ((value as string[]) ?? []).length + 1)}
            onChange={(e) => onChange(e.target.value.split("\n"))}
            onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            className={cn(inputCls, "resize-y leading-relaxed")}
            {...aria}
          />
        </FieldShell>
      );
    case "media":
      return (
        <FieldShell field={field} id={id} error={error} labelFor={false}>
          <MediaInput value={(value as string | null) ?? null} onChange={onChange} accept={field.accept ?? "image"} />
        </FieldShell>
      );
    case "gallery":
      return (
        <FieldShell field={field} id={id} error={error} labelFor={false}>
          <GalleryInput value={(value as GalleryItem[]) ?? []} onChange={onChange} />
        </FieldShell>
      );
    case "repeater":
      return (
        <FieldShell field={field} id={id} error={error} labelFor={false}>
          <RepeaterInput field={field} value={(value as Values[]) ?? []} onChange={onChange} relations={relations} errors={errors} path={field.name} />
        </FieldShell>
      );
    case "color":
      return (
        <FieldShell field={field} id={id} error={error}>
          <div className="flex gap-2">
            <input type="color" aria-label={`${field.label} picker`} value={/^#[0-9a-f]{6}$/i.test(str) ? str : "#c8f560"} onChange={(e) => onChange(e.target.value)} className="h-[2.75rem] w-12 shrink-0 cursor-pointer rounded-lg border border-line/15 bg-bg p-1" />
            <input id={id} value={str} placeholder="#C8F560 (optional)" onChange={(e) => onChange(e.target.value)} className={inputCls} {...aria} />
          </div>
        </FieldShell>
      );
    case "slug":
    case "url":
    case "text":
    default:
      return (
        <FieldShell field={field} id={id} error={error}>
          <input id={id} type={field.type === "url" ? "url" : "text"} value={str} placeholder={field.placeholder ?? (field.type === "url" ? "https://…" : field.type === "slug" ? "auto-generated-from-title" : undefined)} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, field.type === "slug" && "font-mono")} {...aria} />
        </FieldShell>
      );
  }
}
