/** Admin dashboard: real counts from the database, recent changes and shortcuts. No invented analytics. */
import { count, desc, eq, sql } from "drizzle-orm";
import { ArrowRight, Award, BookOpen, Briefcase, FolderKanban, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/AdminShell";
import { getDb, schema } from "@/lib/db/client";

export const metadata = { title: "Dashboard" };

async function tally(table: typeof schema.projects | typeof schema.achievements | typeof schema.research | typeof schema.experience | typeof schema.education) {
  const rows = await getDb()
    .select({ status: table.status, n: count() })
    .from(table)
    .groupBy(table.status);
  const pub = Number(rows.find((r) => r.status === "published")?.n ?? 0);
  const draft = Number(rows.find((r) => r.status === "draft")?.n ?? 0);
  return { pub, draft };
}

const ACTION_LABEL: Record<string, string> = { created: "Created", updated: "Updated", deleted: "Deleted", published: "Published", unpublished: "Unpublished", reordered: "Reordered", uploaded: "Uploaded" };

export default async function Dashboard() {
  const db = getDb();
  const [projects, achievements, research, experience, education, activity, unread, drafts] = await Promise.all([
    tally(schema.projects),
    tally(schema.achievements),
    tally(schema.research),
    tally(schema.experience),
    tally(schema.education),
    db.select().from(schema.activityLog).orderBy(desc(schema.activityLog.createdAt)).limit(12),
    db.select({ n: count() }).from(schema.contactMessages).where(eq(schema.contactMessages.read, false)),
    db.execute<{ entity: string; id: string; title: string }>(sql`
      select 'projects' as entity, id::text, title from projects where status = 'draft'
      union all select 'research', id::text, title from research where status = 'draft'
      union all select 'achievements', id::text, event from achievements where status = 'draft'
      union all select 'experience', id::text, role from experience where status = 'draft'
      limit 10`),
  ]);

  const cards = [
    { label: "Projects", href: "/admin/projects", icon: FolderKanban, ...projects },
    { label: "Achievements", href: "/admin/achievements", icon: Award, ...achievements },
    { label: "Research", href: "/admin/research", icon: BookOpen, ...research },
    { label: "Experience & education", href: "/admin/experience", icon: Briefcase, pub: experience.pub + education.pub, draft: experience.draft + education.draft },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of your site's content. Every number here comes straight from the database." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="group rounded-2xl border border-line/10 bg-bg-2 p-5 transition-colors hover:border-accent/40">
            <c.icon className="h-5 w-5 text-accent" aria-hidden />
            <p className="mt-4 font-display text-5xl leading-none">{c.pub}</p>
            <p className="mt-2 text-sm text-fg/90">{c.label} published</p>
            <p className="mt-1 text-xs text-dim">{c.draft} draft{c.draft === 1 ? "" : "s"}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-line/10 bg-bg-2 p-5 lg:col-span-2" aria-labelledby="recent">
          <h2 id="recent" className="mb-4 font-mono text-[11px] uppercase tracking-label text-dim">
            Recent changes
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">No changes yet. Edits you make here will be listed.</p>
          ) : (
            <ul className="divide-y divide-line/10">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-label text-accent">{ACTION_LABEL[a.action] ?? a.action}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {a.label} <span className="text-dim">· {a.entity}</span>
                  </span>
                  <span className="shrink-0 text-xs text-dim">{a.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-line/10 bg-bg-2 p-5" aria-labelledby="quick">
            <h2 id="quick" className="mb-4 font-mono text-[11px] uppercase tracking-label text-dim">
              Quick add
            </h2>
            <div className="grid gap-2">
              {[
                ["projects", "Project"],
                ["achievements", "Achievement"],
                ["research", "Research item"],
                ["experience", "Experience"],
              ].map(([k, l]) => (
                <Link key={k} href={`/admin/${k}/new`} className="flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2.5 text-sm hover:border-accent/40">
                  <Plus className="h-4 w-4 text-accent" aria-hidden /> {l}
                </Link>
              ))}
              <Link href="/admin/settings" className="flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2.5 text-sm hover:border-accent/40">
                <ArrowRight className="h-4 w-4 text-accent" aria-hidden /> Edit profile & hero
              </Link>
            </div>
          </section>
          <Link href="/admin/messages" className="flex items-center gap-3 rounded-2xl border border-line/10 bg-bg-2 p-5 hover:border-accent/40">
            <Inbox className="h-5 w-5 text-accent" aria-hidden />
            <span className="flex-1 text-sm">Unread messages</span>
            <span className="font-display text-3xl">{Number(unread[0]?.n ?? 0)}</span>
          </Link>
          {drafts.rows.length > 0 && (
            <section className="rounded-2xl border border-line/10 bg-bg-2 p-5" aria-labelledby="drafts">
              <h2 id="drafts" className="mb-3 font-mono text-[11px] uppercase tracking-label text-dim">
                Drafts waiting
              </h2>
              <ul className="space-y-1.5 text-sm">
                {drafts.rows.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/${d.entity}/${d.id}`} className="text-muted hover:text-fg">
                      {d.title} <span className="text-dim">· {d.entity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
