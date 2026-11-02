"use client";
/** Site settings editor: tabbed, driven by SETTINGS_TABS. Saves the whole settings document. */
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SETTINGS_TABS } from "@/lib/content/settings-fields";
import type { Field } from "@/lib/content/registry";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import { PageHeader } from "./AdminShell";
import { FieldInput, getPath, setPath, type Values } from "./fields";

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const { api, toast } = useAdmin();
  const [values, setValues] = useState<Values>(initial);
  const [baseline, setBaseline] = useState<Values>(initial);
  const [tab, setTab] = useState(SETTINGS_TABS[0]!.key);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (SETTINGS_TABS.some((t) => t.key === fromHash)) setTab(fromHash);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const current = SETTINGS_TABS.find((t) => t.key === tab)!;
  const groups = useMemo(() => {
    const out: { name: string; fields: Field[] }[] = [];
    for (const f of current.fields) {
      const g = f.group ?? "";
      let b = out.find((x) => x.name === g);
      if (!b) out.push((b = { name: g, fields: [] }));
      b.fields.push(f);
    }
    return out;
  }, [current]);

  const tabHasError = (key: string) => SETTINGS_TABS.find((t) => t.key === key)!.fields.some((f) => Object.keys(errors).some((e) => e === f.name || e.startsWith(f.name + ".")));

  async function save() {
    setSaving(true);
    setErrors({});
    const r = await api<{ settings: Values }>("PUT", "/api/admin/settings", values);
    setSaving(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      toast(r.error, "error");
      const firstTab = SETTINGS_TABS.find((t) => t.fields.some((f) => Object.keys(r.fields ?? {}).some((e) => e === f.name || e.startsWith(f.name + "."))));
      if (firstTab) setTab(firstTab.key);
      return;
    }
    setValues(r.data.settings);
    setBaseline(r.data.settings);
    toast("Settings saved. The public site is updated.");
    router.refresh();
  }

  return (
    <div className="pb-28">
      <PageHeader title="Profile & site" description="Everything that isn't a list item: your profile, hero, about story, photos, contact details, section order, SEO and appearance." />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line/10 bg-bg-2 p-1 no-scrollbar" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              history.replaceState(null, "", `#${t.key}`);
            }}
            className={cn("relative shrink-0 rounded-lg px-3.5 py-2 text-sm transition-colors", tab === t.key ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}
          >
            {t.label}
            {tabHasError(t.key) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" aria-label="has errors" />}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted">{current.description}</p>
      <div className="space-y-6" role="tabpanel">
        {groups.map((g) => (
          <fieldset key={g.name || "main"} className="rounded-2xl border border-line/10 bg-bg-2 p-5 sm:p-6">
            {g.name && <legend className="mb-5 font-mono text-[11px] uppercase tracking-label text-dim">{g.name}</legend>}
            <div className="grid gap-5 sm:grid-cols-2">
              {g.fields.map((f) => (
                <FieldInput key={f.name} field={f} value={getPath(values, f.name)} onChange={(v) => setValues((s) => setPath(s, f.name, v))} relations={{}} error={errors[f.name]} errors={errors} idPrefix="settings" />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/10 bg-bg/90 backdrop-blur-xl lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <span className="mr-auto text-xs text-dim">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
