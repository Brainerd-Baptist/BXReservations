// Appearance for BX Reservations — two themes and an automatic mode.
//
//   Light  (data-theme="brainerd")   the church's brand colors; the default
//   Dark   (data-theme="glass-dark") deep navy with the brand teal
//   Auto   follows the device's light/dark setting, live
//
// The data-theme ids are kept from the old eight-theme system so CSS, the
// building map and saved preferences keep working. Retired themes are mapped
// to the closest survivor by normalizeAppearance().

export const THEMES = [
  {
    id: "brainerd",
    label: "Light",
    description: "Warm linen and the church's navy and teal. The default.",
    swatch: ["#F5F1EB", "#FEFCF8", "#00abc9", "#00205b"],
  },
  {
    id: "glass-dark",
    label: "Dark",
    description: "Deep navy glass with the brand teal — easy on the eyes at night.",
    swatch: ["#0a1020", "#142039", "#2ec4de", "#eef2f8"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Appearance = ThemeId | "system";

export const APPEARANCES: { id: Appearance; label: string; description: string }[] = [
  { id: "brainerd", label: "Light", description: THEMES[0].description },
  { id: "glass-dark", label: "Dark", description: THEMES[1].description },
  { id: "system", label: "Auto", description: "Matches your device — light by day, dark by night if your phone or computer is set that way." },
];

export const DEFAULT_THEME: ThemeId = "brainerd";
export const DEFAULT_APPEARANCE: Appearance = "brainerd";
export const THEME_STORAGE_KEY = "bx-reservations-theme";

/** Retired themes → the survivor that feels closest. */
const LEGACY: Record<string, Appearance> = {
  "glass-light": "brainerd",
  ledger: "glass-dark",
  harbor: "glass-dark",
  heather: "glass-dark",
  moss: "glass-dark",
  orbit: "glass-dark",
};

export function isValidTheme(id: string | null | undefined): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

/** Any stored value (current, legacy, or junk) → a valid appearance, or null. */
export function normalizeAppearance(v: string | null | undefined): Appearance | null {
  if (!v) return null;
  if (v === "system" || isValidTheme(v)) return v as Appearance;
  return LEGACY[v] ?? null;
}

export function resolveAppearance(a: Appearance): ThemeId {
  if (a !== "system") return a;
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "glass-dark" : "brainerd";
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null;

/** Apply + remember an appearance. "system" keeps tracking the OS setting live. */
export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolveAppearance(a));
  root.setAttribute("data-appearance", a);
  // Keep one long-lived MediaQueryList (shared with the init script); a
  // throwaway one can be garbage-collected and silently drop its listener.
  const w = window as Window & { __bxMQ?: MediaQueryList };
  const mq = (w.__bxMQ ??= window.matchMedia("(prefers-color-scheme: dark)"));
  if (systemListener) mq.removeEventListener("change", systemListener);
  systemListener = null;
  if (a === "system") {
    systemListener = (e) => root.setAttribute("data-theme", e.matches ? "glass-dark" : "brainerd");
    mq.addEventListener("change", systemListener);
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, a);
  } catch {}
}

/** Back-compat for callers that pass a concrete theme id. */
export function applyTheme(id: ThemeId) {
  applyAppearance(id);
}

/** What the page is currently set to (reads the attribute the init script wrote). */
export function currentAppearance(): Appearance {
  if (typeof document === "undefined") return DEFAULT_APPEARANCE;
  return normalizeAppearance(document.documentElement.getAttribute("data-appearance")) ?? DEFAULT_APPEARANCE;
}

// Blocking inline script — inlined into <head> before first paint to prevent a flash.
// Normalizes legacy ids, resolves "system", and keeps Auto live if the OS flips.
export const THEME_INIT_SCRIPT = `(function(){try{var L={"glass-light":"brainerd",ledger:"glass-dark",harbor:"glass-dark",heather:"glass-dark",moss:"glass-dark",orbit:"glass-dark"};var r=document.documentElement,a=localStorage.getItem("bx-reservations-theme");if(a&&L[a]){a=L[a];localStorage.setItem("bx-reservations-theme",a);}if(a!=="brainerd"&&a!=="glass-dark"&&a!=="system")a="brainerd";var m=window.__bxMQ=window.matchMedia("(prefers-color-scheme: dark)");r.setAttribute("data-appearance",a);r.setAttribute("data-theme",a==="system"?(m.matches?"glass-dark":"brainerd"):a);if(a==="system"&&m.addEventListener)m.addEventListener("change",function(e){if(r.getAttribute("data-appearance")==="system")r.setAttribute("data-theme",e.matches?"glass-dark":"brainerd");});var d=localStorage.getItem("bx-reservations-grid-dots");if(d===null||d==="on")r.setAttribute("data-grid-dots","on");var l=localStorage.getItem("bx-reservations-grid-lines");if(l==="on")r.setAttribute("data-grid-lines","on");}catch(e){}})();`;
