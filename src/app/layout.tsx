import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/AppShell";
import { SentinelProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel — The AI Financial Decision Firewall",
  description: "Sentinel detects the manipulation behind suspicious payments — before money leaves your account.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#050607",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="noise min-h-screen bg-ink-950 font-sans">
        <SentinelProvider>
          <AppShell>{children}</AppShell>
        </SentinelProvider>
      </body>
    </html>
  );
}
