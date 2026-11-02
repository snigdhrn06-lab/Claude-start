/** Public site shell: intro, navigation, footer, cursor, floating WhatsApp. */
import { headers } from "next/headers";
import { Cursor } from "@/components/site/Cursor";
import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { Footer } from "@/components/site/Footer";
import { Intro } from "@/components/site/Intro";
import { Nav } from "@/components/site/Nav";
import { SiteProvider } from "@/components/site/SiteProvider";
import { whatsappUrl } from "@/lib/contact";
import { getSiteData } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const data = await getSiteData();
  const s = data.settings;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const navItems = s.sections.filter((x) => x.visible).map((x) => ({ key: x.key, label: x.label }));
  const hasResume = !!(s.resumeMediaId && data.media[s.resumeMediaId]);
  const wa = whatsappUrl(s.whatsappNumber, s.whatsappMessage);

  return (
    <SiteProvider introEnabled={s.introEnabled}>
      {s.introEnabled && (
        <>
          {/* Decide before first paint whether to skip the intro (seen this session / reduced motion). */}
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `try{if(sessionStorage.getItem("srn-intro-seen")||matchMedia("(prefers-reduced-motion: reduce)").matches||location.hash||location.pathname!=="/")document.documentElement.dataset.intro="skip"}catch(e){}`,
            }}
          />
          <style>{`html[data-intro="skip"] .intro-overlay{display:none}`}</style>
          <Intro name={s.name} />
        </>
      )}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <div className="grain">
        <Nav name={s.name} shortName={s.shortName} items={navItems} resumeLabel={s.resumeLabel} hasResume={hasResume} />
        <main id="main">{children}</main>
        <Footer name={s.name} note={s.footerNote} items={navItems} social={data.socialLinks} hasResume={hasResume} />
      </div>
      {s.cursorEnabled && <Cursor />}
      {s.showFloatingWhatsapp && wa && <FloatingWhatsApp href={wa} />}
    </SiteProvider>
  );
}
