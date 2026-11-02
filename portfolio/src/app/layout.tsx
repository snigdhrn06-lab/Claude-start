import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { getSettingsSafe, resolveSiteUrl } from "@/lib/site";
import { stripEmphasis } from "@/lib/utils";
import "./globals.css";

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettingsSafe();
  const title = s.seoTitle || s.name;
  const description = s.seoDescription || stripEmphasis(s.heroIntro);
  return {
    metadataBase: new URL(resolveSiteUrl(s)),
    title: { default: title, template: `%s | ${s.name}` },
    description,
    applicationName: s.name,
    authors: [{ name: s.name }],
    creator: s.name,
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: s.name, title, description, locale: "en_IN" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#08090a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettingsSafe();
  return (
    <html
      lang="en"
      data-accent={s.accent}
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
