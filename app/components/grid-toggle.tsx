"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";
import { Button } from "./ui/button";
import {
  DEFAULT_THEME, GLOW_SWATCHES, GRID_SWATCHES, LOOK_PRESETS, cleanTheme, sameTheme, themeCss,
  type SiteTheme, type ThemeSide,
} from "@/lib/site-theme";

function setAttr(name: string, on: boolean) {
  if (on) document.documentElement.setAttribute(name, "on");
  else document.documentElement.removeAttribute(name);
}

/** Paint a theme on this page right now (the same CSS the server writes). */
function paint(t: SiteTheme) {
  let el = document.getElementById("bx-look") as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = "bx-look"; document.head.appendChild(el); }
  el.textContent = themeCss(t);
}

function Switch({ label, hint, on, busy, onToggle }: { label: string; hint: string; on: boolean; busy?: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-parchment">{label}</p>
        <p className="text-xs text-slate">{hint}</p>
      </div>
      <button
        type="button" role="switch" aria-label={label} aria-checked={on} onClick={onToggle} disabled={busy}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        style={{ background: on ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 20%, transparent)", opacity: busy ? 0.6 : 1 }}
      >
        <span className="inline-block h-4 w-4 rounded-full transition-transform"
          style={{ background: on ? "var(--bx-action-fg)" : "var(--bx-parchment)", transform: on ? "translateX(1.375rem)" : "translateX(0.25rem)" }} />
      </button>
    </div>
  );
}

function ColorRow({ label, value, swatches, onChange }: {
  label: string; value: string; swatches: { label: string; hex: string }[]; onChange: (hex: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-parchment mb-1.5">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((s) => (
          <button key={s.hex} type="button" onClick={() => onChange(s.hex)} aria-pressed={value === s.hex} title={s.label}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs text-parchment"
            style={{ borderColor: value === s.hex ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 18%, transparent)", boxShadow: value === s.hex ? "0 0 0 1px var(--bx-action-bg)" : undefined }}>
            <span className="inline-block h-4 w-4 rounded-full border" style={{ background: s.hex, borderColor: "color-mix(in srgb, var(--bx-parchment) 25%, transparent)" }} />
            {s.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-slate">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: custom color`}
            className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
          Custom <span className="tabular uppercase">{value}</span>
        </label>
      </div>
    </div>
  );
}

function Slider({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-medium text-parchment"><span>{label}</span><span className="tabular text-slate">{value}%</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-1 accent-[var(--bx-action-bg)]" />
      <span className="block text-xs text-slate">{hint}</span>
    </label>
  );
}

/**
 * Admin → Settings → Site background (Owner only). One choice for every
 * visitor: grid on/off, and the colors of the grid, lamp and glows for the
 * light and dark themes, with a live preview on this page.
 */
export default function GridToggle() {
  const { toast } = useToast();
  const [look, setLook] = useState<{ gridDots: boolean; gridLines: boolean; theme: SiteTheme } | null>(null);
  const [draft, setDraft] = useState<SiteTheme | null>(null);
  const [side, setSide] = useState<keyof SiteTheme>("light");
  const [busy, setBusy] = useState(false);
  const savedRef = useRef<SiteTheme | null>(null);
  const themeAttrRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    themeAttrRef.current = document.documentElement.getAttribute("data-theme");
    fetch("/api/admin/site-look").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live || !d) return;
      setSide(themeAttrRef.current === "glass-dark" ? "dark" : "light");
      const theme = cleanTheme(d.theme);
      savedRef.current = theme;
      setLook({ gridDots: !!d.gridDots, gridLines: !!d.gridLines, theme });
      setDraft(theme);
    }).catch(() => {});
    return () => {
      live = false;
      // Leaving Settings: show the saved look in the visitor's own theme again
      if (savedRef.current) paint(savedRef.current);
      if (themeAttrRef.current) document.documentElement.setAttribute("data-theme", themeAttrRef.current);
    };
  }, []);
  if (!look || !draft) return null;

  const cur = draft[side];
  const dirty = !sameTheme(draft, look.theme);

  function preview(next: SiteTheme, nextSide = side) {
    setDraft(next);
    paint(next);
    document.documentElement.setAttribute("data-theme", nextSide === "dark" ? "glass-dark" : "brainerd");
  }
  const setCur = (patch: Partial<ThemeSide>) => preview({ ...draft, [side]: { ...cur, ...patch } });
  const pickSide = (s: keyof SiteTheme) => { setSide(s); preview(draft, s); };

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/site-look", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "Couldn't save");
      toast(ok, "success");
      return d as { theme?: unknown };
    } catch (e) {
      toast((e as Error).message, "error");
      return null;
    } finally { setBusy(false); }
  }

  async function saveGrid(patch: { gridDots?: boolean; gridLines?: boolean }) {
    const next = { ...look!, ...patch };
    setLook(next);
    setAttr("data-grid-dots", next.gridDots);
    setAttr("data-grid-lines", next.gridLines);
    await post(patch, "Saved for everyone.");
  }

  async function saveColors() {
    const d = await post({ theme: draft }, "Background colors saved for everyone.");
    if (d) {
      const theme = cleanTheme(draft);
      savedRef.current = theme;
      setLook({ ...look!, theme });
      setDraft(theme);
      paint(theme);
    }
  }

  function cancel() { preview(look!.theme); }

  return (
    <section className="rounded-2xl bx-glass p-5 mb-4 space-y-5" aria-label="Site background">
      <div>
        <p className="font-semibold text-parchment">Site background <span className="text-xs font-normal text-slate">· Owner only</span></p>
        <p className="text-sm text-slate mt-1">The animated grid and glows behind every page, for every visitor.</p>
      </div>
      <Switch label="Background dots" hint="Subtle twinkling dot grid." on={look.gridDots} busy={busy} onToggle={() => saveGrid({ gridDots: !look.gridDots })} />
      <Switch label="Background lines" hint="Faint line grid." on={look.gridLines} busy={busy} onToggle={() => saveGrid({ gridLines: !look.gridLines })} />

      <div className="border-t pt-5 space-y-5" style={{ borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <div>
          <p className="text-sm font-semibold text-parchment">Colors</p>
          <p className="text-xs text-slate">Changes preview on this page as you go. Nothing changes for visitors until you save.</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-1.5">Start from</p>
          <div className="flex flex-wrap gap-2">
            {LOOK_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => preview(p.theme)} title={p.hint}
                aria-pressed={sameTheme(draft, p.theme)}
                className="flex-1 min-w-[10rem] rounded-xl border px-3 py-2 text-left text-sm text-parchment"
                style={{ borderColor: sameTheme(draft, p.theme) ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 18%, transparent)" }}>
                <span className="font-medium">{p.label}</span>
                <span className="block text-xs text-slate">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="tablist" aria-label="Theme to edit" className="inline-flex rounded-xl p-1 bx-well">
          {(["light", "dark"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => pickSide(s)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium"
              style={side === s ? { background: "var(--bx-action-bg)", color: "var(--bx-action-fg)" } : { color: "var(--bx-parchment)" }}>
              {s === "light" ? "Light theme" : "Dark theme"}
            </button>
          ))}
        </div>

        <div className="space-y-5" role="tabpanel">
          <ColorRow label="Grid dots & lines" value={cur.grid} swatches={GRID_SWATCHES[side]} onChange={(grid) => setCur({ grid })} />
          <Slider label="Grid strength" hint="Kept subtle so it never competes with text." value={cur.gridStrength} min={3} max={25} onChange={(gridStrength) => setCur({ gridStrength })} />

          <div>
            <p className="text-sm font-medium text-parchment mb-1.5">The moving light lights dots in…</p>
            <div className="flex flex-wrap gap-2">
              {([["neutral", "The grid color, brighter"], ["accent", "The glow color"]] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={cur.lamp === v} onClick={() => setCur({ lamp: v })}
                  className="rounded-full border px-3 py-1.5 text-xs text-parchment"
                  style={{ borderColor: cur.lamp === v ? "var(--bx-action-bg)" : "color-mix(in srgb, var(--bx-parchment) 18%, transparent)", boxShadow: cur.lamp === v ? "0 0 0 1px var(--bx-action-bg)" : undefined }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <ColorRow label="Main glow" value={cur.glow} swatches={GLOW_SWATCHES} onChange={(glow) => setCur({ glow })} />
          <Slider label="Glow strength" hint="0% turns the glows off; 100% is the standard look." value={cur.glowStrength} min={0} max={150} onChange={(glowStrength) => setCur({ glowStrength })} />
          <Switch label="Warm gold glow" hint="A soft gold glow at the top right." on={cur.warmGlow} onToggle={() => setCur({ warmGlow: !cur.warmGlow })} />
          <Switch label="Navy glow" hint="A deep navy glow along the bottom." on={cur.navyGlow} onToggle={() => setCur({ navyGlow: !cur.navyGlow })} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={saveColors} disabled={!dirty} loading={busy}>Save for everyone</Button>
          <Button size="sm" variant="secondary" onClick={cancel} disabled={!dirty || busy}>Cancel changes</Button>
          <Button size="sm" variant="ghost" onClick={() => preview(DEFAULT_THEME)} disabled={busy || sameTheme(draft, DEFAULT_THEME)}>Reset to recommended</Button>
        </div>
      </div>
    </section>
  );
}
