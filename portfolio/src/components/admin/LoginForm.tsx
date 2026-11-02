"use client";
import { Loader2, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("expired") ? "Your session expired. Please sign in again." : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Sign-in failed.");
        setBusy(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  const input = "mt-1.5 w-full rounded-lg border border-line/15 bg-bg px-3 py-3 text-sm outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line/10 bg-bg-2 p-8 shadow-2xl">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-ink">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-4xl">Admin sign-in</h1>
      <p className="mt-2 text-sm text-muted">Manage the content of your portfolio.</p>
      <label className="mt-8 block text-sm text-fg/90">
        Email
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      <label className="mt-4 block text-sm text-fg/90">
        Password
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </label>
      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-[#ffd0d0]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-medium text-accent-ink hover:bg-accent/90 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
