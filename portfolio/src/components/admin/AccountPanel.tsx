"use client";
/** Change password and sign out other sessions. */
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "./AdminProvider";
import { PageHeader } from "./AdminShell";
import { inputCls } from "./fields";

export function AccountPanel() {
  const { api, toast, email } = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) return setErrors({ repeat: "Passwords don't match" });
    setBusy(true);
    setErrors({});
    const r = await api("POST", "/api/admin/account/password", { current, next });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast(r.error, "error");
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    toast("Password changed. Other sessions were signed out.");
  }

  async function signOutOthers() {
    const r = await api("DELETE", "/api/admin/account/sessions");
    toast(r.ok ? "Signed out of all other devices" : r.error, r.ok ? "success" : "error");
  }

  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${email}.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={change} className="space-y-4 rounded-2xl border border-line/10 bg-bg-2 p-6" noValidate>
          <h2 className="text-lg font-medium">Change password</h2>
          {[
            { id: "current", label: "Current password", v: current, set: setCurrent, ac: "current-password" },
            { id: "next", label: "New password (12+ characters)", v: next, set: setNext, ac: "new-password" },
            { id: "repeat", label: "Repeat new password", v: repeat, set: setRepeat, ac: "new-password" },
          ].map((f) => (
            <label key={f.id} className="block text-sm">
              <span className="mb-1.5 block text-fg/90">{f.label}</span>
              <input type="password" autoComplete={f.ac} value={f.v} onChange={(e) => f.set(e.target.value)} className={inputCls} aria-invalid={!!errors[f.id]} />
              {errors[f.id] && <span className="mt-1 block text-xs text-danger">{errors[f.id]}</span>}
            </label>
          ))}
          <button type="submit" disabled={busy || !current || !next} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
          </button>
        </form>
        <div className="space-y-4 rounded-2xl border border-line/10 bg-bg-2 p-6">
          <h2 className="text-lg font-medium">Sessions</h2>
          <p className="text-sm text-muted">Sessions last 7 days. If you signed in on a shared device, sign out everywhere else.</p>
          <button type="button" onClick={signOutOthers} className="rounded-lg border border-line/15 px-4 py-2.5 text-sm hover:border-line/40">
            Sign out all other sessions
          </button>
          <div className="border-t border-line/10 pt-4 text-xs leading-relaxed text-dim">
            Forgot your password? Set <code className="text-muted">ADMIN_EMAIL</code>, <code className="text-muted">ADMIN_PASSWORD</code> and <code className="text-muted">ADMIN_RESET_PASSWORD=true</code> in the hosting environment and restart, then remove them. See the handbook, section F.
          </div>
        </div>
      </div>
    </>
  );
}
