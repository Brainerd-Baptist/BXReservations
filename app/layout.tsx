import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import SiteHeader from "./site-header";
import ScrollReveal from "./components/scroll-reveal";
import AmbientBackground from "./components/ambient-background";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";
import { getSiteLook } from "@/lib/site-look";
import { themeCss } from "@/lib/site-theme";
import { ToastProvider } from "./components/Toast";
import SiteMetrics from "./components/site-metrics";

// Inter is a variable font: one file covers every weight (C2 font trim).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BX Community Center — Reservations | Brainerd Baptist",
  description:
    "Reserve the BX Community Center rooms for your event. Check availability and submit a request online.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: people must be able to pinch-zoom (WCAG 1.4.4).
  viewportFit: "cover",
};

const APP_VERSION = "1.60.0";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Background grid is one site-wide choice (Owner, Admin → Settings)
  const look = await getSiteLook();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable}`}
      data-grid-dots={look.gridDots ? "on" : undefined}
      data-grid-lines={look.gridLines ? "on" : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking theme-init script — must run before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Background colors (Owner, Admin → Settings) — only hex colors and numbers reach here */}
        <style id="bx-look" dangerouslySetInnerHTML={{ __html: themeCss(look.theme) }} />
      </head>
      <body className="flex flex-col min-h-screen">
        <a href="#main-content" className="bx-skip">Skip to content</a>
        <AmbientBackground />
        <ToastProvider>
          <SiteHeader />
          {/* The page's one main region; the skip link lands here */}
          <main id="main-content" tabIndex={-1} className="flex-1 isolate outline-none" style={{ paddingTop: "var(--bx-header-h)" }}>{children}</main>
          <ScrollReveal />
        </ToastProvider>

        {/* Version footer */}
        <footer className="border-t py-3 px-4" style={{ borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-center text-xs" style={{ color: "var(--bx-slate)" }}>
            <a href="/privacy" className="underline underline-offset-2 inline-block py-2 px-1.5">Privacy</a>
            <span aria-hidden="true"> · </span>
            <a href="/terms" className="underline underline-offset-2 inline-block py-2 px-1.5">Terms</a>
            <span aria-hidden="true"> · </span>
            <span className="font-mono" style={{ color: "color-mix(in srgb, var(--bx-slate) 60%, transparent)" }}>BX Reservations v{APP_VERSION}</span>
          </p>
        </footer>
        <SiteMetrics />
      </body>
    </html>
  );
}
