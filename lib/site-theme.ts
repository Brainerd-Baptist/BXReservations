// ─── Site background colors (Owner, Admin → Settings) ────────────────────────
// The grid dots/lines, the drifting "lamp" that lights them, and the soft
// background glows — one choice per theme (light and dark) for every visitor.
// Client-safe: the server writes themeCss() into <head>, and the Settings
// card uses the same function for a live preview.

export interface ThemeSide {
  /** grid dot/line color */
  grid: string;
  /** grid strength, percent (kept subtle: 3–25) */
  gridStrength: number;
  /** the main glow's color */
  glow: string;
  /** glow strength, percent of the default (0–150) */
  glowStrength: number;
  /** the warm gold glow at the top right */
  warmGlow: boolean;
  /** the navy glow at the bottom */
  navyGlow: boolean;
  /** what the lamp lights dots with: the grid color, brighter — or the glow color */
  lamp: "neutral" | "accent";
}
export interface SiteTheme { light: ThemeSide; dark: ThemeSide }

/** Recommended: neutral grid, one teal glow, the lamp as plain light. */
export const DEFAULT_THEME: SiteTheme = {
  light: { grid: "#2a2f3a", gridStrength: 12, glow: "#00abc9", glowStrength: 100, warmGlow: true, navyGlow: false, lamp: "neutral" },
  dark: { grid: "#c9ced6", gridStrength: 8, glow: "#0b9ab6", glowStrength: 100, warmGlow: false, navyGlow: false, lamp: "neutral" },
};

/** How the site looked before v1.60 — navy/teal everything. */
export const ORIGINAL_THEME: SiteTheme = {
  light: { grid: "#00205b", gridStrength: 12, glow: "#00abc9", glowStrength: 100, warmGlow: true, navyGlow: true, lamp: "accent" },
  dark: { grid: "#eef2f8", gridStrength: 7, glow: "#0b9ab6", glowStrength: 100, warmGlow: false, navyGlow: true, lamp: "accent" },
};

export const LOOK_PRESETS: { id: string; label: string; hint: string; theme: SiteTheme }[] = [
  { id: "neutral", label: "Neutral", hint: "Graphite / silver grid, one teal glow (recommended)", theme: DEFAULT_THEME },
  {
    id: "quiet", label: "Quiet", hint: "Neutral grid, glows turned way down",
    theme: {
      light: { ...DEFAULT_THEME.light, glowStrength: 45, warmGlow: false },
      dark: { ...DEFAULT_THEME.dark, glowStrength: 45 },
    },
  },
  { id: "original", label: "Original blue", hint: "Navy grid, teal lamp and glows", theme: ORIGINAL_THEME },
];

export const GRID_SWATCHES: Record<keyof SiteTheme, { label: string; hex: string }[]> = {
  light: [
    { label: "Graphite", hex: "#2a2f3a" }, { label: "Black", hex: "#000000" },
    { label: "Navy", hex: "#00205b" }, { label: "Teal", hex: "#00abc9" },
  ],
  dark: [
    { label: "Silver", hex: "#c9ced6" }, { label: "White", hex: "#ffffff" },
    { label: "Ice", hex: "#eef2f8" }, { label: "Teal", hex: "#3cc3dc" },
  ],
};
export const GLOW_SWATCHES: { label: string; hex: string }[] = [
  { label: "Teal", hex: "#00abc9" }, { label: "Deep teal", hex: "#0b9ab6" },
  { label: "Navy", hex: "#2b4fae" }, { label: "Gold", hex: "#e9c46a" }, { label: "Gray", hex: "#8a94a6" },
];

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
};
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : d);

function cleanSide(v: unknown, d: ThemeSide): ThemeSide {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    grid: hex(o.grid, d.grid),
    gridStrength: clamp(o.gridStrength, 3, 25, d.gridStrength),
    glow: hex(o.glow, d.glow),
    glowStrength: clamp(o.glowStrength, 0, 150, d.glowStrength),
    warmGlow: typeof o.warmGlow === "boolean" ? o.warmGlow : d.warmGlow,
    navyGlow: typeof o.navyGlow === "boolean" ? o.navyGlow : d.navyGlow,
    lamp: o.lamp === "accent" || o.lamp === "neutral" ? o.lamp : d.lamp,
  };
}

/** Anything saved or posted → a safe, complete theme (only hex colors and numbers survive). */
export function cleanTheme(v: unknown): SiteTheme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { light: cleanSide(o.light, DEFAULT_THEME.light), dark: cleanSide(o.dark, DEFAULT_THEME.dark) };
}

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${Math.max(0, Math.round(pct * 10) / 10)}%, transparent)`;

function sideVars(s: ThemeSide, dark: boolean): string {
  const g = s.glowStrength / 100;
  // Default glow strengths per theme (what 100% means)
  const base = dark ? { a: 15, b: 9, c: 13, lamp: 9 } : { a: 11, b: 12, c: 8, lamp: 6 };
  const lampColor = s.lamp === "accent" ? s.glow : s.grid;
  const lampDot = s.lamp === "accent" ? (dark ? 60 : 55) : (dark ? 55 : 42);
  const lampLine = s.lamp === "accent" ? (dark ? 24 : 22) : (dark ? 20 : 16);
  const neutralLampGlow = dark ? "#ffffff" : s.grid;
  return [
    `--bx-grid-ink:${s.grid}`,
    `--bx-grid-opacity:${s.gridStrength}%`,
    `--bx-glow-a:${mix(s.glow, base.a * g)}`,
    `--bx-glow-b:${s.warmGlow ? mix("#e9c46a", (dark ? 7 : base.b) * g) : "transparent"}`,
    `--bx-glow-c:${s.navyGlow ? mix(dark ? "#2b4fae" : "#00205b", base.c * g) : "transparent"}`,
    `--bx-lamp-glow:${s.lamp === "accent" ? mix(s.glow, base.lamp * g) : mix(neutralLampGlow, dark ? 5 : 3)}`,
    `--bx-lamp-dot:${mix(lampColor, lampDot)}`,
    `--bx-lamp-line:${mix(lampColor, lampLine)}`,
    `--bx-twinkle:${mix(lampColor, s.lamp === "accent" ? (dark ? 80 : 60) : (dark ? 70 : 50))}`,
    `--bx-twinkle-halo:${mix(lampColor, dark ? 16 : 12)}`,
  ].join(";");
}

/** CSS for both themes. Higher specificity than globals.css so it always wins. */
export function themeCss(t: SiteTheme): string {
  const c = cleanTheme(t);
  return `html:root[data-theme="brainerd"]{${sideVars(c.light, false)}}html:root[data-theme="glass-dark"]{${sideVars(c.dark, true)}}`;
}

export const sameTheme = (a: SiteTheme, b: SiteTheme) => JSON.stringify(cleanTheme(a)) === JSON.stringify(cleanTheme(b));
