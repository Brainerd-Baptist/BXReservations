import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import SiteHeader from "./site-header";
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
};

const APP_VERSION = "0.7.0";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex flex-col min-h-screen bg-gray-50">
        <SiteHeader />
        <main className="flex-1">{children}</main>

        {/* Version footer */}
        <footer className="border-t border-gray-100 bg-white py-3 px-4">
          <p className="text-center text-xs text-gray-300 font-mono">
            BX Reservations v{APP_VERSION}
          </p>
        </footer>
      </body>
    </html>
  );
}
