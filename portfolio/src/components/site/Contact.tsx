/** Contact: direct actions (WhatsApp, email, LinkedIn, phone, résumé) and a validated message form. */
import { ArrowDownToLine, ArrowUpRight, Linkedin, Mail, Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SocialIcon, WhatsAppIcon } from "@/components/shared/icons";
import { mailtoUrl, telUrl, whatsappUrl } from "@/lib/contact";
import type { SiteSettings } from "@/lib/content/settings";
import { ContactForm, CopyButton } from "./ContactClient";
import { SectionHeader } from "./SectionHeader";

export function Contact({ index, s, hasResume, social }: { index: number; s: SiteSettings; hasResume: boolean; social: { id: string; label: string; url: string; icon: string }[] }) {
  const copy = s.sectionCopy.contact;
  const wa = whatsappUrl(s.whatsappNumber, s.whatsappMessage);
  const mail = mailtoUrl(s.email, `Hello ${s.name.split(" ")[0]}`);
  const tel = telUrl(s.phone);
  const extraSocial = social.filter((l) => l.icon !== "linkedin" && l.icon !== "mail");

  const rows: { key: string; label: string; value: string; href: string; icon: React.ReactNode; external?: boolean; copy?: string }[] = [];
  if (wa) rows.push({ key: "wa", label: "WhatsApp", value: s.phone || `+${s.whatsappNumber}`, href: wa, icon: <WhatsAppIcon className="h-5 w-5" />, external: true });
  if (mail) rows.push({ key: "mail", label: "Email", value: s.email, href: mail, icon: <Mail className="h-5 w-5" strokeWidth={1.6} />, copy: s.email });
  if (s.linkedinUrl) rows.push({ key: "li", label: "LinkedIn", value: "View profile", href: s.linkedinUrl, icon: <Linkedin className="h-5 w-5" strokeWidth={1.6} />, external: true });
  if (tel) rows.push({ key: "tel", label: "Phone", value: s.phone, href: tel, icon: <Phone className="h-5 w-5" strokeWidth={1.6} /> });
  if (hasResume) rows.push({ key: "cv", label: s.resumeLabel || "Résumé", value: "Download PDF", href: "/resume", icon: <ArrowDownToLine className="h-5 w-5" strokeWidth={1.6} />, external: true });

  return (
    <section id="contact" className="relative overflow-hidden border-t border-line/[0.06] py-24 md:py-36">
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-accent/[0.06] blur-[120px]" aria-hidden />
      <div className="container relative">
        <SectionHeader index={index} eyebrow={copy.eyebrow || "Contact"} title={copy.title} intro={copy.intro} />
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <ul className="border-t border-line/[0.08] lg:col-span-6">
            {rows.map((r, i) => (
              <Reveal as="li" key={r.key} delay={i * 0.05} className="group relative border-b border-line/[0.08]">
                <a
                  href={r.href}
                  {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="relative z-10 flex items-center gap-5 py-6 pr-14 transition-colors duration-500 group-hover:text-accent-ink"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line/15 transition-colors duration-500 group-hover:border-accent-ink/30">{r.icon}</span>
                  <span className="min-w-0">
                    <span className="label block transition-colors duration-500 group-hover:text-accent-ink/70">{r.label}</span>
                    <span className="mt-1 block truncate text-lg md:text-xl">{r.value}</span>
                  </span>
                  <ArrowUpRight className="absolute right-4 h-5 w-5 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden />
                </a>
                <span className="absolute inset-0 origin-bottom scale-y-0 bg-accent transition-transform duration-500 ease-expo group-hover:scale-y-100" aria-hidden />
                {r.copy && <CopyButton value={r.copy} className="absolute right-14 top-1/2 z-20 -translate-y-1/2" />}
              </Reveal>
            ))}
            {extraSocial.length > 0 && (
              <li className="flex flex-wrap gap-3 pt-6">
                {extraSocial.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-2 !text-xs">
                    <SocialIcon name={l.icon} className="h-3.5 w-3.5" /> {l.label}
                  </a>
                ))}
              </li>
            )}
          </ul>
          {s.contactFormEnabled && (
            <div className="lg:col-span-5 lg:col-start-8">
              <Reveal>
                <ContactForm />
              </Reveal>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
