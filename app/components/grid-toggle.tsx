"use client";

import { useEffect, useState } from "react";
import { useToast } from "./Toast";

function setAttr(name: string, on: boolean) {
  if (on) document.documentElement.setAttribute(name, "on");
  else document.documentElement.removeAttribute(name);
}

function Switch({ label, hint, on, busy, onToggle }: { label: string; hint: string; on: boolean; busy: boolean; onToggle: () => void }) {
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

/**
 * Admin → Settings → Site background (Owner only). One choice for every
 * visitor; renders nothing for other roles.
 */
export default function GridToggle() {
  const { toast } = useToast();
  const [look, setLook] = useState<{ gridDots: boolean; gridLines: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/site-look").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setLook(d); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!look) return null;

  async function save(patch: Partial<typeof look>) {
    const next = { ...look!, ...patch };
    setLook(next);
    setAttr("data-grid-dots", next.gridDots);
    setAttr("data-grid-lines", next.gridLines);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/site-look", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn't save");
      toast("Saved for everyone.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl bx-glass p-5 mb-4 space-y-4" aria-label="Site background">
      <div>
        <p className="font-semibold text-parchment">Site background <span className="text-xs font-normal text-slate">· Owner only</span></p>
        <p className="text-sm text-slate mt-1">The animated grid behind every page, for every visitor.</p>
      </div>
      <Switch label="Background dots" hint="Subtle twinkling dot grid." on={look.gridDots} busy={busy} onToggle={() => save({ gridDots: !look.gridDots })} />
      <Switch label="Background lines" hint="Faint line grid." on={look.gridLines} busy={busy} onToggle={() => save({ gridLines: !look.gridLines })} />
    </section>
  );
}
