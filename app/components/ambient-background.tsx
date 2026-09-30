"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient background — the one layer stack every page sits on.
 *
 *   html background (theme base / gradient)
 *   └─ .bx-ambient (fixed, z-index -1, never intercepts input)
 *      ├─ three slow "aurora" glows        — CSS-animated, transform only
 *      ├─ .bx-amb-grid                      — dots/lines, vignette-masked, scroll parallax
 *      ├─ .bx-amb-lamp > .bx-amb-lamp-grid  — a soft light that lifts nearby dots/lines
 *      └─ .bx-amb-grain                     — static paper grain
 *
 * The lamp wanders on a slow Lissajous path and, on devices with a fine
 * pointer, drifts lazily toward the cursor. Everything moves with transforms
 * only (compositor work, no repaints). The loop pauses when the tab is hidden
 * and never starts under prefers-reduced-motion.
 */

const PERIOD = 28;        // grid cell, px — must match --bx-grid-size in globals.css
const PARALLAX = 0.12;    // grid scrolls at 12% of page speed → reads as depth
const EASE = 0.025;       // lamp follow easing per frame (lower = lazier)

export default function AmbientBackground() {
  const gridRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  const lampGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const lamp = lampRef.current;
    const lampGrid = lampGridRef.current;
    if (!grid || !lamp || !lampGrid) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let raf = 0;
    let running = false;
    let pointer: { x: number; y: number; t: number } | null = null;
    // Start exactly on the wander path so the first frames don't swoop.
    let x = window.innerWidth * 0.5;
    let y = window.innerHeight * (0.34 + 0.2 * Math.sin(1.1));
    const start = performance.now();

    const place = (lx: number, ly: number) => {
      // Parallax is motion too — honor reduced-motion by pinning the grid.
      const par = reduce.matches ? 0 : -((window.scrollY * PARALLAX) % PERIOD);
      grid.style.transform = `translate3d(0, ${par.toFixed(2)}px, 0)`;
      lamp.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      // Counter-translate the lamp's pattern so its dots stay locked to the base grid.
      lampGrid.style.transform = `translate3d(${(-lx).toFixed(1)}px, ${(par - ly).toFixed(1)}px, 0)`;
    };

    const frame = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = (now - start) / 1000;

      // Idle wander — two incommensurate periods so the path never visibly repeats.
      // ~30px/s at most on a laptop: noticed only when you look for it.
      let tx = w * (0.5 + 0.3 * Math.sin((t / 70) * Math.PI * 2));
      let ty = h * (0.34 + 0.2 * Math.sin((t / 53) * Math.PI * 2 + 1.1));

      // Cursor attraction fades out ~5s after the last move.
      if (pointer) {
        const age = (now - pointer.t) / 1000;
        const pull = Math.max(0, Math.min(1, 1.6 - age / 3));
        tx += (pointer.x - tx) * pull;
        ty += (pointer.y - ty) * pull;
        if (pull === 0) pointer = null;
      }

      x += (tx - x) * EASE;
      y += (ty - y) * EASE;
      place(x, y);
      raf = requestAnimationFrame(frame);
    };

    const startLoop = () => {
      if (running || reduce.matches || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointer = (e: PointerEvent) => {
      if (!finePointer.matches || e.pointerType !== "mouse") return;
      pointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onScroll = () => {
      if (!running) place(x, y); // keep parallax honest even when the loop is off
    };
    const onVisibility = () => (document.hidden ? stopLoop() : startLoop());
    const onReduceChange = () => (reduce.matches ? (stopLoop(), place(x, y)) : startLoop());

    place(x, y);
    startLoop();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener?.("change", onReduceChange);

    return () => {
      stopLoop();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener?.("change", onReduceChange);
    };
  }, []);

  return (
    <div className="bx-ambient" aria-hidden="true">
      <div className="bx-amb-glow bx-amb-glow--a" />
      <div className="bx-amb-glow bx-amb-glow--b" />
      <div className="bx-amb-glow bx-amb-glow--c" />
      <div ref={gridRef} className="bx-amb-grid" />
      <div ref={lampRef} className="bx-amb-lamp">
        <div ref={lampGridRef} className="bx-amb-lamp-grid" />
      </div>
      <div className="bx-amb-grain" />
    </div>
  );
}
