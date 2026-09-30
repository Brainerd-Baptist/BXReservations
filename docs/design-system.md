# BX Reservations — Surface & Ambient System (v1.38.0)

## The layer stack (every page)

```
<html>            theme base color / gradient (Midnight, Daylight)
  .bx-ambient     fixed, z-index -1, pointer-events none   ← app/components/ambient-background.tsx
    glows ×3      huge soft radial "aurora", 46–67s drift, transform-only
    .bx-amb-grid  dots/lines, vignette-masked, scrolls at 12% (parallax)
    .bx-amb-lamp  a soft light that lifts the grid it passes over; wanders,
                  and on mouse devices drifts lazily toward the cursor
    grain         static paper texture
  header          .bx-header — glass, firms up on scroll
  main            page content on glass surfaces
```

**Rule:** pages never paint an opaque full-page background (`bg-ink`, `background: var(--bx-ink)` on a
`min-h-screen` wrapper). That was the cause of dots showing on some pages and not others.

## Surfaces (use these, nothing else)

| Class | Use | Notes |
|---|---|---|
| `.bx-glass` | panels, cards | translucent + light frost |
| `.bx-glass-flat` | repeated rows, list items | same look, no blur (cheap on phones) |
| `.bx-glass-strong` | modals, drawers, sticky bars | ~90% + heavy frost |
| `.bx-well` | recessed area inside a surface | tabs track, info rows |
| `.bx-band` | full-bleed hero / section band | no card edges |
| `.bx-cta` | primary action | lit edge + brand glow |
| `.bx-eyebrow` | small caps section label | brass hairlines each side |
| `.bx-tone-{amber,indigo,orange,green,red,stone}` | status blocks | theme-aware |

Inline-style equivalents: `var(--bx-surface)`, `var(--bx-surface-strong)`, `var(--bx-surface-menu)`,
`var(--bx-well)`, `var(--bx-hairline)`, `var(--bx-highlight)`, `var(--tone-*-bg|fg|bd)`.

Menus nested inside the glass header use `--bx-surface-menu` (97%): a backdrop-filter inside another
backdrop-filter can't blur the page, so those menus must be near-opaque to stay legible.

## Overlays

Any fixed overlay (lightbox, modal, slide-over) renders through `<BodyPortal>`. Ancestors with
`backdrop-filter` or `transform` become the containing block for `position: fixed` and would trap the
overlay inside a card. Animation end states use `transform: none`, never `translateY(0)`, for the same reason.

## Type

One system. `font-sans` → Inter, `font-serif` → Cormorant Garamond, `font-mono` → system mono.
Cormorant only at display sizes (h1/h2 at `text-lg`+); small or uppercase headings render in Inter.

## Color in dark themes

Tailwind palette shades are remapped on dark themes (50–300 → translucent tints, 600–900 → light text),
so utilities like `bg-red-50 text-red-700` adapt automatically. Prefer `--tone-*` for new work.

## Accessibility & output

- `prefers-reduced-motion`: no drift, no lamp motion, no parallax.
- `prefers-reduced-transparency` / `prefers-contrast: more`: opaque surfaces, no blur, no lamp or glows.
- `forced-colors`: ambient hidden.
- Print: ambient hidden, surfaces white — agreements print clean.
- Dark themes set `color-scheme: dark` (native date pickers, scrollbars, selects).

## Appearance (v1.39.0)

Two themes and an automatic mode — **Light** (`data-theme="brainerd"`, default), **Dark**
(`data-theme="glass-dark"`, brand navy + teal) and **Auto** (follows the device, live). The chosen
value is stored in `localStorage` and in `bx_user_prefs.theme` (`brainerd` | `glass-dark` | `system`);
the account value is applied on sign-in so the choice follows people across devices. Retired theme ids
(Daylight, Classic, Harbor, Heather, Moss, Orbit) are migrated automatically: Daylight → Light, the rest → Dark.
`<html data-appearance>` holds the preference, `<html data-theme>` the resolved theme.

## v1.39.1 — softer glow, twinkling dots

Aurora glows, lamp glow and hero bloom were turned down ~35%. In exchange, six sparse "twinkle" layers
(`.bx-amb-twinkle--a…f`) make a few scattered grid dots gently light up and fade (9–19.5s cycles, co-prime
tile sizes so nothing pulses in unison). Dots only; off under reduced motion.

## v1.42.0 — contrast roles and shared components

**Contrast roles** (`globals.css`): brand teal `#00abc9` stays the fill; each job has its own token.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bx-action-bg` / `--bx-action-fg` | `#00abc9` / navy `#00205b` (5.7:1) | `#3cc3dc` / `#0a1020` (9:1) | filled buttons |
| `--bx-accent-text` | `#00748a` (4.8:1 on linen) | `#3cc3dc` | teal text & links |
| `--bx-slate` | `#5f6673` (5.1:1) | `#93a3ba` | muted text |
| `--bx-focus` | `#00748a` | `#6ad3e6` | focus rings |

`.bg-brass`, `.text-brass` and `.bg-brass.text-white` are remapped to these, so older markup is correct until it moves to the components.

**Components** (`app/components/ui/`): `Button` / `ButtonLink` (primary · secondary · danger · ghost; sm/md/lg; 44px targets on touch; `loading`), `Field` + `Input`/`Textarea`/`Select` (label, hint and error wired with ids and aria), `Tabs` (APG keyboard pattern), `StatusBadge`, `EmptyState`, plus `LoadError`. Route-level `app/error.tsx` and `app/not-found.tsx`. One `<main id="main-content">` with a "Skip to content" link.
