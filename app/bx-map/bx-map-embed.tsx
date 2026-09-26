"use client";

// BX Building Map — React host for the generated map page (map-bundle.ts).
// The map is a self-contained page (window.BXMap) built outside this repo;
// this component only mounts it, feeds it an event layer and relays saves.
// Do not restyle the map's own classes here — theme it through the CSS
// tokens on `.app` (see the website handoff doc in Brainerd HQ).

import { useEffect, useRef } from "react";
import type { EventLayer, EventMapChange } from "@/lib/event-map";
import { THEMES } from "@/lib/theme";
import { MAP_CSS, MAP_FONTS_URL, MAP_HTML, MAP_JS } from "./map-bundle";

interface BxMapApi {
  select: (id: string, zoom?: boolean) => void;
  setLevel: (level: "lower" | "upper", quiet?: boolean) => void;
  fitLevel: () => void;
  setEvent: (layer: EventLayer | null) => void;
  getEvent: () => EventLayer | null;
  onChange: (fn: ((change: EventMapChange) => unknown) | null) => void;
  setDay: (i: number) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    BXMap?: {
      mount: (
        el: HTMLElement,
        opts?: {
          event?: EventLayer | null;
          onChange?: (change: EventMapChange) => unknown;
          hash?: boolean;
          actions?: { label: string; href: string }[];
        }
      ) => BxMapApi;
    };
    BXMAP_MANUAL_MOUNT?: boolean;
  }
}

const STYLE_ID = "bx-map-style";

/** The map keys its dark palette off a `dark` class; derive it from the site theme's background swatch. */
function themeIsDark(id: string | null): boolean {
  const t = THEMES.find((x) => x.id === id);
  const hex = (t?.swatch[0] ?? "#ffffff").replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}
const SCRIPT_ID = "bx-map-script";

function ensureRuntime(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.BXMap?.mount) return Promise.resolve();
  window.BXMAP_MANUAL_MOUNT = true; // the bundle would otherwise mount the first #app it finds
  return new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      // an inline script has already run by the time we see it
      if (window.BXMap?.mount) resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.textContent = MAP_JS;
    document.body.appendChild(s); // inline scripts execute synchronously on append
    resolve();
  });
}

export interface BxMapEmbedProps {
  /** Event layer to mount with (null = plain building map). */
  event?: EventLayer | null;
  /** Called for every autosaved change; return/throw a promise to drive the Saved / Not saved state. */
  onChange?: (change: EventMapChange) => Promise<unknown> | unknown;
  /** Keep the room id in the URL hash (default true). */
  hash?: boolean;
  /** Links shown in the welcome panel when no event is loaded (e.g. "Plan an event"). */
  actions?: { label: string; href: string }[];
  /** Height of the map area. The map needs a definite height. */
  height?: string;
  className?: string;
}

export default function BxMapEmbed({ event = null, onChange, hash = true, actions, height = "calc(100dvh - 56px)", className }: BxMapEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<BxMapApi | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    ensureRuntime().then(() => {
      if (cancelled || !hostRef.current || !window.BXMap) return;
      const app = hostRef.current.querySelector<HTMLElement>(".app");
      if (!app) return;
      apiRef.current = window.BXMap.mount(app, {
        event,
        hash,
        actions,
        onChange: (change) => onChangeRef.current?.(change),
      });
    });
    return () => {
      cancelled = true;
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // mount once; `event` updates are pushed through setEvent below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.setEvent(event);
  }, [event]);

  // follow the site theme: toggle the map's `dark` hook on the host wrapper
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => host.classList.toggle("dark", themeIsDark(document.documentElement.getAttribute("data-theme")));
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={MAP_FONTS_URL} />
      <style id={STYLE_ID} dangerouslySetInnerHTML={{ __html: MAP_CSS }} />
      <div
        ref={hostRef}
        className={className}
        style={{ height, overflow: "hidden" }}
        // The map's own markup; React never re-renders inside it.
        dangerouslySetInnerHTML={{ __html: MAP_HTML }}
        suppressHydrationWarning
      />
    </>
  );
}
