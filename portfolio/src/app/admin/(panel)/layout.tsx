/** Protected admin area. Every page below this layout requires a valid server-side session. */
import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AdminProvider } from "@/components/admin/AdminProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCurrentSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/admin/login");
  const [unread] = await getDb().select({ n: count() }).from(schema.contactMessages).where(eq(schema.contactMessages.read, false));
  return (
    <AdminProvider csrf={session.csrfToken} email={session.email}>
      <AdminShell unread={Number(unread?.n ?? 0)}>{children}</AdminShell>
    </AdminProvider>
  );
}
