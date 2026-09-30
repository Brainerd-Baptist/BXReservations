"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Phase 6: real-visitor page speed (Speed Insights) and page views (Web Analytics).
// Both are cookie-free. Tokens never leave the browser: query strings are dropped
// and the private id/token part of a path is replaced with a placeholder.
function scrub(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname
      .replace(/^\/agree\/[^/]+/, "/agree/[token]")
      .replace(/^\/reservations\/[^/]+/, "/reservations/[id]")
      .replace(/^\/admin\/bx-reservations\/(users|organizations)\/[^/]+/, "/admin/bx-reservations/$1/[id]");
    return u.toString();
  } catch {
    return url;
  }
}

export default function SiteMetrics() {
  return (
    <>
      <Analytics beforeSend={(e: BeforeSendEvent) => ({ ...e, url: scrub(e.url) })} />
      <SpeedInsights beforeSend={(e) => ({ ...e, url: scrub(e.url) })} />
    </>
  );
}
