import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { getCurrentSession } from "@/lib/auth/session";
import { adminCount } from "@/lib/ops/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/admin");
  const none = (await adminCount()) === 0;
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(60%_50%_at_50%_0%,rgb(var(--accent)/0.08),transparent)] px-4 py-10">
      <div className="flex w-full flex-col items-center gap-6">
        <Suspense>
          <LoginForm />
        </Suspense>
        {none && (
          <p className="max-w-sm rounded-xl border border-line/10 bg-bg-2 p-4 text-xs leading-relaxed text-muted">
            No admin account exists yet. Set <code className="text-fg">ADMIN_EMAIL</code> and <code className="text-fg">ADMIN_PASSWORD</code> (12+ characters) in the environment and restart the server, or run <code className="text-fg">npm run admin:create</code>.
          </p>
        )}
      </div>
    </main>
  );
}
