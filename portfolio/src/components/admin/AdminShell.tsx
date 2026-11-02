"use client";
/** Admin layout chrome: sidebar navigation (drawer on mobile), account menu and sign-out. */
import {
  Award,
  BookOpen,
  Briefcase,
  ExternalLink,
  FileStack,
  FolderKanban,
  GraduationCap,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Settings2,
  Shapes,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";

const NAV = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Content",
    items: [
      { href: "/admin/settings", label: "Profile & site", icon: Settings2 },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
      { href: "/admin/research", label: "Research", icon: BookOpen },
      { href: "/admin/achievements", label: "Achievements", icon: Award },
      { href: "/admin/experience", label: "Experience", icon: Briefcase },
      { href: "/admin/education", label: "Education", icon: GraduationCap },
      { href: "/admin/skills", label: "Skills", icon: Sparkles },
      { href: "/admin/skill-categories", label: "Skill categories", icon: Shapes },
      { href: "/admin/social-links", label: "Social links", icon: Link2 },
      { href: "/admin/resources", label: "Resources", icon: FileStack },
    ],
  },
  {
    group: "Library",
    items: [
      { href: "/admin/media", label: "Media", icon: ImageIcon },
      { href: "/admin/messages", label: "Messages", icon: Inbox },
      { href: "/admin/account", label: "Account", icon: UserCog },
    ],
  },
];

export function AdminShell({ children, unread }: { children: React.ReactNode; unread: number }) {
  const pathname = usePathname();
  const { api, email, toast } = useAdmin();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    const r = await api("POST", "/api/admin/auth/logout");
    if (r.ok) window.location.href = "/admin/login";
    else toast(r.error, "error");
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-mono text-[10px] font-semibold text-accent-ink">CMS</span>
          <span className="text-sm font-medium">Portfolio admin</span>
        </Link>
        <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((g) => (
          <div key={g.group} className="mt-4">
            <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-label text-dim">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", isActive(it.href) ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg")}
                    aria-current={isActive(it.href) ? "page" : undefined}
                  >
                    <it.icon className={cn("h-4 w-4", isActive(it.href) && "text-accent")} aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    {it.href === "/admin/messages" && unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">{unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/10 p-3">
        <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/[0.04] hover:text-fg">
          <ExternalLink className="h-4 w-4" aria-hidden /> View public site
        </a>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
          <span className="truncate text-xs text-dim" title={email}>
            {email}
          </span>
          <button type="button" onClick={signOut} className="flex shrink-0 items-center gap-1.5 text-xs text-muted hover:text-fg">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line/10 bg-bg-2 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line/10 bg-bg-2">{nav}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/10 bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-line/15" aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">Portfolio admin</span>
          <span className="w-9" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl leading-tight">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
