import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import SiteHeader from "./site-header";
import ScrollReveal from "./components/scroll-reveal";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
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
  maximumScale: 1,
  viewportFit: "cover",
};

const APP_VERSION = "1.0.47";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Blocking theme-init script — must run before first paint to prevent flash */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-component */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex flex-col min-h-screen">
        <SiteHeader />
        <main className="flex-1" style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}>{children}</main>
        <ScrollReveal />

        {/* Version footer */}
        <footer className="border-t py-3 px-4" style={{ borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-center text-xs font-mono" style={{ color: "color-mix(in srgb, var(--bx-slate) 60%, transparent)" }}>
            BX Reservations v{APP_VERSION}
          </p>
        </footer>
      </body>
    </html>
  );
}
