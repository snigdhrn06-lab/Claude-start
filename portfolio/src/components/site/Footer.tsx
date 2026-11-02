import Link from "next/link";
import { SocialIcon } from "@/components/shared/icons";
import type { NavItem } from "./Nav";

export function Footer({ name, note, items, social, hasResume }: { name: string; note: string; items: NavItem[]; social: { id: string; label: string; url: string; icon: string }[]; hasResume: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-line/[0.07] pb-10 pt-16">
      <div className="container">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Link href="/" className="display block text-[clamp(3rem,9vw,7.5rem)] leading-none text-fg/90 transition-colors hover:text-accent">
              {name}
            </Link>
            {note && <p className="mt-6 max-w-md text-sm leading-relaxed text-dim">{note}</p>}
          </div>
          <nav aria-label="Footer" className="md:col-span-3">
            <p className="label mb-4">Index</p>
            <ul className="space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.key}>
                  <Link href={`/#${i.key}`} className="text-muted transition-colors hover:text-fg">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="md:col-span-3">
            <p className="label mb-4">Elsewhere</p>
            <ul className="space-y-2 text-sm">
              {social.map((s) => (
                <li key={s.id}>
                  <a href={s.url} className="inline-flex items-center gap-2 text-muted transition-colors hover:text-fg" {...(s.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <SocialIcon name={s.icon} className="h-3.5 w-3.5" /> {s.label}
                  </a>
                </li>
              ))}
              {hasResume && <li>
                <a href="/resume" target="_blank" rel="noopener" className="text-muted transition-colors hover:text-fg">
                  Résumé (PDF)
                </a>
              </li>}
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-line/[0.07] pt-6 text-xs text-dim sm:flex-row sm:items-center">
          <p>
            © {year} {name}. All rights reserved.
          </p>
          <a href="#top" className="label hover:text-fg">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
