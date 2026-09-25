// Theme system for BX Reservations — mirrors BrainerdHQ/Personnel exactly.
// Ordering rule: Brainerd · Midnight · Daylight first, then alphabetical.

export const THEMES = [
  {
    id: "brainerd",
    label: "Brainerd",
    description: "Light, built from the church's own brand colors. The default.",
    swatch: ["#f4f7fa", "#ffffff", "#00abc9", "#00205b"],
    quick: true,
  },
  {
    id: "glass-dark",
    label: "Midnight",
    description: "Frosted, translucent panels over a dark gradient.",
    swatch: ["#0c1018", "#1e293b", "#38bdf8", "#f1f5f9"],
    quick: true,
  },
  {
    id: "glass-light",
    label: "Daylight",
    description: "Frosted white glass over a soft brand-tinted gradient.",
    swatch: ["#eef2f7", "#ffffff", "#00abc9", "#1e293b"],
    quick: true,
  },
  {
    id: "ledger",
    label: "Classic",
    description: "Ink & gold — a refined dark theme.",
    swatch: ["#282a2d", "#313438", "#e5a00d", "#ededeb"],
  },
  {
    id: "harbor",
    label: "Harbor",
    description: "Deep teal-navy — corporate/nautical.",
    swatch: ["#0c1218", "#16202a", "#5a8c96", "#e8eef0"],
  },
  {
    id: "heather",
    label: "Heather",
    description: "Muted plum and lavender — soft, not bright pink.",
    swatch: ["#181420", "#241d2e", "#a67ca0", "#f0ecf4"],
  },
  {
    id: "moss",
    label: "Moss",
    description: "Muted forest green with warm cream text — earthy, not neon.",
    swatch: ["#10160f", "#1b2419", "#8a9a5b", "#f0ece1"],
  },
  {
    id: "orbit",
    label: "Orbit",
    description: "Black and silver — a sleek, cold instrument-panel feel.",
    swatch: ["#0a0c10", "#181b21", "#7a8a9c", "#e2e6ec"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "brainerd";
export const THEME_STORAGE_KEY = "bx-reservations-theme";

export function isValidTheme(id: string | null): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined" || !isValidTheme(id)) return;
  document.documentElement.setAttribute("data-theme", id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {}
}

// Blocking inline script — inlined into <head> before first paint to prevent flash.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("bx-reservations-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
