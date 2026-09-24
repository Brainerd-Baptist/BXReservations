import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

// Version info — package version is baked in at build time.
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is set automatically by Vercel on every deploy.
const APP_VERSION = "0.2.0";
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>

        {/* Version footer */}
        <footer className="border-t border-gray-100 bg-white py-3 px-4">
          <p className="text-center text-xs text-gray-300 font-mono">
            BX Reservations v{APP_VERSION}
            {COMMIT_SHA && (
              <span className="ml-2 opacity-60">· {COMMIT_SHA}</span>
            )}
          </p>
        </footer>
      </body>
    </html>
  );
}
