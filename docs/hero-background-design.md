# Hero Background Design — BX Reservations

**Last updated:** 2026-09-27  
**File changed:** `app/globals.css` → `.bx-bloom` class  
**Commit:** `40a49c5`

---

## What it is

The hero section background uses two layered effects that combine into a premium, textured feel:

1. **Diagonal gradient wash** — a very subtle teal tint from the top-left and a faint navy tint in the bottom-right. So gentle it reads as "depth" rather than color.
2. **Animated film grain** — an SVG fractalNoise texture that jumps through random positions at ~8fps, simulating classic film grain. Makes the page feel tactile and premium rather than flat/digital.

Both effects are CSS-only, zero JavaScript, and GPU-composited so performance is low.

---

## The CSS (in `app/globals.css`)

```css
/* Hero ambient treatment: slow diagonal gradient wash + animated film grain */
.bx-bloom {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bx-brass) 8%, transparent) 0%,
    transparent 45%,
    color-mix(in srgb, var(--bx-parchment) 4%, transparent) 100%
  );
  animation: bxWashDrift 20s ease-in-out infinite alternate;
}

.bx-bloom::before {
  /* Animated film grain — oversized so translation never shows edges */
  content: "";
  position: absolute;
  inset: -25%;
  width: 150%;
  height: 150%;
  background-image: url("data:image/svg+xml,...SVG noise filter...");
  background-size: 200px 200px;
  opacity: 0.038;
  animation: bxGrain 0.12s steps(1) infinite;
}

.bx-bloom::after {
  /* Counter-diagonal secondary wash for depth */
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    225deg,
    color-mix(in srgb, var(--bx-brass) 5%, transparent) 0%,
    transparent 55%
  );
  opacity: 0.7;
  animation: bxWashDrift 28s ease-in-out infinite alternate-reverse;
}

@keyframes bxGrain {
  0%  { transform: translate(0,    0); }
  10% { transform: translate(-5%,  -10%); }
  20% { transform: translate(10%,  5%); }
  30% { transform: translate(-7%,  12%); }
  40% { transform: translate(5%,   -8%); }
  50% { transform: translate(-10%, 6%); }
  60% { transform: translate(7%,   -5%); }
  70% { transform: translate(-4%,  10%); }
  80% { transform: translate(10%,  -7%); }
  90% { transform: translate(-8%,  4%); }
}

@keyframes bxWashDrift {
  from { opacity: 0.72; }
  to   { opacity: 1; }
}
```

---

## Tuning knobs

| What to change | Where | Effect |
|---|---|---|
| Grain visibility | `.bx-bloom::before` → `opacity: 0.038` | Higher = more visible texture. Try `0.05` for Android. |
| Teal wash intensity | `.bx-bloom` gradient → `8%` | Lower = subtler, higher = more color |
| Navy hint | `.bx-bloom` gradient → `4%` | Same — controls bottom-right corner tint |
| Grain speed | `bxGrain` → `0.12s` | Lower = faster/more chaotic, higher = slower |
| Wash breathing speed | `bxWashDrift` → `20s` / `28s` | Higher = slower, lazier pulse |

---

## Mobile behavior

- **Diagonal gradient** — renders perfectly on all devices.
- **Film grain** — renders on iOS Safari and modern Android Chrome. On older Android WebViews, the SVG filter may silently drop and only the gradient shows. Page still looks intentional — just less textured.
- **Performance** — lightweight. `steps(1)` means no interpolation; `transform` is GPU-composited.

---

## Where `.bx-bloom` is used

The class is applied in `app/page.tsx` (the public landing page hero):

```tsx
<section className="bg-ink-soft border-b border-parchment/10 relative overflow-hidden">
  <div className="bx-bloom" aria-hidden="true" />
  {/* hero content */}
</section>
```

Apply the same `relative overflow-hidden` + `<div className="bx-bloom" />` pattern to any other hero section you want the same treatment on.

---

## Options considered

| Option | Decision |
|---|---|
| Original subtle bloom (radial, 14%) | Too faint on white background |
| Enlarged bloom (radial, 28%) | Deployed briefly — felt overpowering |
| **Grain + diagonal (current)** | **Chosen — timeless, premium, not trendy** |
| Dot grid (Linear/Vercel style) | Trendy now, likely to date in 2-3 years |
| Line grid | More timeless than dots but still pattern-heavy |
| Multi-blob mesh (Loom/Craft style) | Good option, slightly more complex |
| Dark hero section | Strong, consider for a future redesign |

---

## Related files

- `app/globals.css` — all CSS custom properties and `.bx-bloom` definition
- `app/page.tsx` — public landing page (uses `.bx-bloom`)
- `app/components/header-shell.tsx` — fixed nav (height `3.5rem` / `h-14`)

---

## Background Options Sampler

An interactive visual preview of all 11 background options — using the actual BX brand colors — is available here:

**[→ Open Background Options Sampler](https://claude.ai/artifact/7QoTx5jcG1xEEieDPCQkv5)**

Open it in a browser to click through the options and pick a new direction. The options include:

| # | Name | Character |
|---|------|-----------|
| ① | Clean white | No treatment — flat baseline |
| ② | Subtle dot grid | Linear/Vercel style — trendy |
| ③ | Linen paper texture | Warm, organic grain |
| ④ | Blueprint lines | Technical, architectural |
| ⑤ | Radial gradient | Classic centered glow |
| ⑥ | Noise + radial glow | Textured glow |
| **⑦** | **Noise/grain texture** | **Film-grain (current component)** |
| **⑧** | **Diagonal gradient** | **Color wash (current component)** |
| ⑨ | Multi-blob mesh | Loom/Craft style — more complex |
| ⑩ | Dark hero | High-contrast section |
| ⑪ | Geometric diamond grid | Subtle structural pattern |

The current `.bx-bloom` implementation combines **⑦ + ⑧** with motion (the animated grain + drifting wash). To switch to a different option, open the sampler, click your pick, then ask Claude to implement whichever number you choose.
