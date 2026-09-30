# BX Reservations Theme and Experience Audit

Date: September 29, 2026

## Assessment and Scope

The application has a useful design foundation, but the current source does not support a premium experience for every user. Shared palettes, font loading, image optimization, loading skeletons, status explanations, and reduced-motion rules are good investments. Readability, keyboard access, mobile fit, failure recovery, and saved preferences need attention before adding more visual effects or palettes.

Reviewed the source of all 20 page routes, their layouts, shared theme and navigation components, page client components, generated map CSS/runtime, and selected API contracts that explain page behavior. This is a source review, not a complete security audit or a production browser certification. The separate `bx-reservations-eventmap` checkout was not the target.

Verification:

- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: failed with 19 errors and 29 warnings across the repository. Some errors are lint policy/configuration problems rather than demonstrated runtime bugs.
- Calculated relative-luminance contrast for all eight theme palettes.
- Reproduced date-only parsing problems using `TZ=America/New_York`.
- Attempted local rendering. Turbopack could not run because the native Next.js SWC package was missing. Webpack started but requests returned HTTP 500 because `lightningcss.darwin-arm64.node` was missing. Browser automation also failed. No successful screenshots, authenticated walkthrough, production build, or performance measurements were obtained. These local dependency failures do not prove the deployed site is broken.
- No application code was edited. Pre-existing changes in `app/globals.css` and the debug API route were preserved. The temporary review server was stopped.

## Findings

P1 means a major workflow or access problem; P2 means an important usability or consistency defect. Findings below are established by source inspection unless a reproduction is noted.

### F01 - P1: Booking submission failures are invisible

[reserve-client.tsx:883](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reserve/reserve-client.tsx:883) accepts `submitError` in `ReviewStep` but never renders it. [The submit handler:1367](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reserve/reserve-client.tsx:1367) sets it on API and network failures. The button becomes usable again without explaining the failure.

Render a persistent, announced error beside submission, preserve the entered data, and make retry clear. Add a targeted check that a rejected request actually produces a visible message.

### F02 - P1: The closed navigation drawer remains keyboard-accessible

[nav-sidebar.tsx:307](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/nav-sidebar.tsx:307) keeps a modal dialog and its links mounted while closed, hiding them with opacity and pointer-events. Neither property removes links from tab order or the accessibility tree. There is no `inert`/hidden state, focus trap, initial focus, or focus restoration. The open drawer also leaves background controls keyboard-accessible.

Use a shared accessible dialog/drawer primitive. Remove the closed panel from keyboard and assistive-technology navigation, constrain focus while open, and return focus to the trigger when it closes. Room lightboxes, password-reset overlays, organization forms, discount dialogs, and user-management dialogs need the same treatment.

### F03 - P1: Text contrast fails across the theme system

[globals.css:26](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/globals.css:26) defines accent colors that many buttons pair with white text. For example, [the home CTA:69](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/page.tsx:69) does this. Every palette's white-on-accent pair falls below 4.5:1 for normal text. Brainerd and Daylight accent links also fail on light surfaces. Orbit muted body text fails on its raised surface.

Create independent semantic tokens for accent text, filled action background, text on action, muted text, and focus indicators. A brand swatch should not have to serve every role. Keep compliant fixed foreground/background badge pairs where they work; hardcoded colors are problematic when only one side changes with the theme.

| Theme | White on accent | Accent on raised surface | Muted on raised surface |
| --- | ---: | ---: | ---: |
| Brainerd | 2.74:1 | 2.74:1 | 4.83:1 |
| Classic | 2.24:1 | 5.58:1 | 4.93:1 |
| Midnight | 2.14:1 | 6.83:1 | 5.71:1 |
| Daylight | 2.74:1 | 2.67:1 | 4.64:1 |
| Harbor | 3.73:1 | 4.42:1 | 6.36:1 |
| Heather | 3.49:1 | 4.66:1 | 5.79:1 |
| Moss | 3.06:1 | 5.22:1 | 5.56:1 |
| Orbit | 3.53:1 | 4.88:1 | 3.94:1 |

These are base solid-color calculations, not a complete rendered contrast audit. Opacity, tinted surfaces, hover states, and toast colors require additional checks.

### F04 - P1: Organization discount dialog is almost unreadable in Brainerd

[org-detail-client.tsx:148](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/organizations/[id]/org-detail-client.tsx:148) fixes the dialog background at `#1a1a22`, while its heading uses `var(--bx-parchment)`. In Brainerd that becomes navy `#00205b`, producing approximately 1.12:1 contrast. The input borders are also permanently white/translucent despite light theme surfaces.

Use theme surface/border tokens throughout the dialog and verify both light themes and every dark palette.

### F05 - P1: Reservation agreement and insurance cards lack their data

[page.tsx:104](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/[id]/page.tsx:104) does not select `coi_accepted_at`. [The render call:168](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/[id]/page.tsx:168) never supplies `view.agreement`, although [the signature card:603](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/[id]/page.tsx:603) depends on it.

Consequently, the agreement cards cannot appear through this page's current data path. Insurance acceptance is also unavailable to the UI, so its verified state cannot appear and a pending-documents reservation can offer an upload despite an accepted COI. Load the required fields and agreement record, and verify each workflow state with representative data.

### F06 - P1: Documents and request lists can crash on API errors

[documents/page.tsx:90](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/documents/page.tsx:90) parses JSON without checking HTTP status or payload shape, storing error objects as arrays. The subsequent `payments.reduce` / `cois.filter` calls can throw. The API does return `{ error }` on failed requests. [The admin request loader:371](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/page.tsx:371) similarly stores the JSON directly before calling `requests.filter`.

Check `response.ok`, validate the expected array, and render an error with retry. Users and reservation lists also convert some failures into empty results; distinguish unavailable data from zero records.

### F07 - P2: Account theme preference does not control the page

[profile-menu.tsx:51](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/profile-menu.tsx:51) initializes from the saved account theme, then replaces its state with the DOM theme. [theme-grid.tsx:33](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/theme-grid.tsx:33) does the same. The initialization script only reads browser storage; neither component applies the saved account theme on login/mount.

The account page promises that the preference applies on every device, but a fresh device renders the default theme even when an account preference exists. The profile menu and account grid also maintain separate state, so changing one can leave the other selection stale. Theme and grid saves ignore returned database errors. Storage reads in theme state initializers are unguarded.

Use one preference owner with a clear account/local/default precedence, synchronized consumers, guarded storage access, and honest save failure feedback. Validate stored IDs in the initialization script and handle the deliberate pre-hydration HTML attribute changes.

### F08 - P2: Mobile layouts have concrete minimum-width conflicts

[organizations-client.tsx:186](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/organizations/organizations-client.tsx:186) uses a minimum 320px grid column plus 64px horizontal padding. At a 375px viewport the grid needs at least 384px. [Its search field:162](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/organizations/organizations-client.tsx:162) fixes width at 260px, exceeding the 256px inner width at a 320px viewport. Organization detail grids similarly combine 260/280px minima with 64px padding.

[The event-map toolbar:36](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/[id]/event-map/page.tsx:36) places numerous nonshrinking actions in one row with no wrapping. Staff have even more actions. Map height subtracts 56px while the root adds the header's safe-area inset, making viewport fit inconsistent on inset devices. Global horizontal overflow hiding can conceal the affected controls.

Use bounded grid minima such as `min(100%, ...)`, responsive padding, flexible search widths, compact toolbar menus, and one shared header-height token including safe-area insets. Verify 320, 375, 390, 768, and desktop widths with long names and staff actions.

### F09 - P2: Date parsing misrepresents reservations

[ReservationsPage:63](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/page.tsx:63) compares the first payload day parsed as a UTC date with the current instant. This moves today's events to Past too early and moves ongoing multi-day events after their first day. It also includes excluded payload days and omits newer cancellation variants from the closed-state check.

[ReservationList:61](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reservations/ReservationList.tsx:61) formats date-only strings with `new Date(ymd)`. Reproduction in America/New_York: `2026-10-21` displays as October 20. The detail page already uses a safer local-date helper.

Centralize venue-calendar dates, included-day ranges, and terminal statuses. Use the last included event date for ongoing/upcoming classification and avoid interpreting calendar dates as UTC instants.

### F10 - P2: The map can disagree with a selected light theme

[bx-map-embed.tsx:122](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/bx-map/bx-map-embed.tsx:122) toggles only the `dark` class. [Generated MAP_CSS:5](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/bx-map/map-bundle.ts:5) has an OS-dark rule targeting `:root:not([data-theme="light"]) .app`. BX light themes use `brainerd` and `glass-light`, so this rule still applies on OS-dark devices. The bundle provides a `.light .app.app` override, but the host never sets `.light`.

Explicitly set both light and dark host states, respecting the selected site theme. The map currently supports two palettes and uses separate fonts; broader palette integration is a design decision after the override bug is resolved. Generated-map changes should be made in its source generator when available and regenerated.

### F11 - P2: Form names, focus, and magnification are incomplete

[Reserve Field:1297](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reserve/reserve-client.tsx:1297), [login labels:297](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/login/page.tsx:297), profile fields, agreement fields, and many staff fields use sibling labels without `htmlFor`/input IDs. Background and notification switches have checked state but no accessible name. Selected themes/filters often lack `aria-pressed` or an equivalent selection state. Room preview is attached to a nonfocusable div in [room-card.tsx:55](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/room-card.tsx:55).

[globals.css:305](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/globals.css:305) suppresses input outlines with selectors more specific than the generic `:focus-visible` rule, leaving only a low-contrast tinted shadow. Inline outline suppression adds further gaps. [layout.tsx:32](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/layout.tsx:32) sets `maximumScale: 1`, requesting a mobile zoom restriction; some browsers override it, but it should be removed. There is no skip link and several pages nest a second main inside the root main.

Associate labels, name switches and icon actions, expose selected state, make previews keyboard-operable, provide a robust focus indicator, allow zoom, and establish one main landmark with a skip link. Assess touch targets separately; many controls are smaller than a comfortable 44px target.

### F12 - P2: Sign-in loses the user's destination

[login/page.tsx:53](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/login/page.tsx:53) always sends password sign-in to `/account`; the Google flow also does not forward a return destination. Booking links supply `next`, invite links supply `redirect`, and middleware redirects account paths to plain `/login`, discarding the invite token before the page's own auth guard can run.

Standardize a validated internal return-path parameter and preserve it through middleware, password sign-in, OAuth, and account switching. A premium flow returns people directly to the reservation or invite they were opening.

### F13 - P2: Admin deep-link controls and dashboard dates go stale

[Admin filter/calendar state:203](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/page.tsx:203) reads query parameters only during state initialization. Sidebar navigation between URLs on the same page can change the URL without updating the existing status filter or calendar state. Tabs derive from the URL, but these controls do not.

[Confirmed count:609](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/page.tsx:609) fixes its month at October 2026. The calendar caption fixes October-November 2026. Derive filters from the URL or synchronize them, and label counts/calendar periods from actual dates.

### F14 - P2: Removed theme variables leave broken actions

[Admin shortcuts:1525](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/page.tsx:1525) use undefined `--bx-pine` with white text. In light mode the missing background can make these links effectively invisible. [Report selection:2046](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/admin/bx-reservations/page.tsx:2046) uses undefined `--bx-dark`, leaving the selected text color dependent on inheritance.

Replace obsolete references with complete semantic action tokens. Add a small token-reference validation check to prevent recurrence.

### F15 - P2: Room presentation promises more than it delivers

[lib/rooms.ts:2](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/lib/rooms.ts:2) explicitly identifies room photos as Unsplash placeholders. They are presented as photos of named BX spaces, including room-specific setup captions. [rooms-client.tsx:177](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/rooms/rooms-client.tsx:177) also marks every gallery room Available without a date-specific availability query.

[Room lightbox:241](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/room-lightbox.tsx:241) says Reserve this space but links to generic `/reserve` without preserving the room. Replace placeholders with actual BX photography, avoid claiming calendar availability in an undated gallery, and carry the selected room into booking. These changes materially improve trust and continuity.

### F16 - P2: Motion and native controls need more careful integration

[globals.css:751](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/globals.css:751) hides content until a JavaScript observer reveals it, without a visible fallback. Reduced-motion duration overrides do not remove the hidden state or disable global smooth scrolling. [ScrollReveal:41](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/components/scroll-reveal.tsx:41) rescans the document after every child-list mutation. Animated grain runs continuously on large page regions.

[Reserve dates:408](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reserve/reserve-client.tsx:408) force dark native control color schemes even in light themes. Let the selected theme determine native control appearance; make important content visible by default; bypass reveal motion when reduced motion is requested; and measure effects before retaining them.

### F17 - P2: Contact validation and draft recovery are weak

[ContactStep:175](/Users/josiahkingbbc/Documents/GitHub/bx-reservations/app/reserve/reserve-client.tsx:175) permits progression when strings are merely truthy. Email/phone input attributes do not enforce validity because progression occurs through a click outside a validating form. There is no draft persistence in the booking client, so reload or navigation loses the request.

Provide field-level validation before progression, meaningful errors tied to each field, safe draft recovery, and focus on the newly entered step. The home page also describes both account-free submission and signing in as part of submission; make the account policy consistent.

## Page Coverage

Every row includes the shared findings on contrast, navigation, preferences, and focus. A page wrapper without findings of its own does not imply its child components were excluded.

| Route | Specific review outcome |
| --- | --- |
| `/` | Accent contrast; placeholder photography; contradictory sign-in copy; reveal fallback. |
| `/rooms` | Undated Available badges; room choice lost when booking; keyboard preview/lightbox; filters and contrast. |
| `/reserve` | Invisible submit errors; weak progression validation; date-control theme; no draft recovery; labels and motion. |
| `/login` | Lost return path; unassociated labels; reset modal semantics; resend/reset handlers can report success without checking HTTP failure. |
| `/auth/reset-password` | Unassociated fields; hardcoded error color; expired-link state has an exit; pending/session handling needs runtime verification. |
| `/account` | Cross-device theme promise not fulfilled; stale independent selectors; unnamed switches; long identity strings lack robust wrapping. |
| `/account/invites` | Middleware loses invite destination; account-switch link loses token; error states exist; successful acceptance has no dedicated visible confirmation here. |
| `/reservations` | Date shift; early Past classification; excluded days/new cancellation variants; query failures resemble empty results. |
| `/reservations/[id]` | Agreement/COI state not loaded; status explanations are useful; disabled download links need keyboard behavior verification. |
| `/reservations/[id]/agreement` | Different fonts and hardcoded gold actions; labels/focus; name mismatch warning does not disable submission, so align copy with actual signing policy. |
| `/agree/[token]` | Parallel signing experience; mixed fixed light success panels with theme-muted text; labels and contrast. |
| `/bx-map` | OS-dark preference can override selected light theme; safe-area height mismatch; token failure has a useful fallback notice. |
| `/bx-map/plan` | Query failures resemble no reservations; truncated result limits; date/status handling should share list helpers. |
| `/reservations/[id]/event-map` | Nonwrapping toolbar; selected theme mismatch; safe-area fit; autosave lifecycle needs focused browser tests. |
| `/admin/bx-reservations` | Error payload handling; query-driven controls stale; fixed October KPI/calendar caption; missing CSS tokens. |
| `/admin/bx-reservations/documents` | Error objects treated as arrays; missing retry; UTC date-only expiry can mark an expiry day expired too early. |
| `/admin/bx-reservations/users` | Silent fetch failure shown as no users; unnamed inputs; dialogs/focus; long email/table fit. |
| `/admin/bx-reservations/users/[id]` | Labels; packed identity/action header; separate status styling; table column visibility requires mobile verification. |
| `/admin/bx-reservations/organizations` | Fixed minimum widths overflow phones; unnamed search/forms; drawer semantics; server error is passed through usefully. |
| `/admin/bx-reservations/organizations/[id]` | Dark discount dialog/light text-token conflict; grid minimum-width overflow; tab/table fit; separate incomplete status styling. |

## Additional Verification Risks

- The generated map uses one shared 600ms save debounce. A second edit in another room can clear the first room's pending callback. Saves are not serialized; a slower older response can overwrite a newer value or leave an inaccurate Saved indicator. Verify rapid cross-room edits, network reordering, immediate Done navigation, and failed saves before claiming reliable autosave. This is a source-identified risk, not a reproduced browser finding.
- Agreement PDF generation in the reservation signing endpoint slices each line at 100 characters rather than wrapping it. Inspect generated documents for truncated terms as a separate document-quality task.
- No route-specific `error.tsx`, `loading.tsx`, or `not-found.tsx` files were found. Add deliberate retry/not-found/loading experiences where navigation waits or failures otherwise feel abrupt.
- Lint includes React effect/ref/purity issues, unused code, internal links causing full reloads, and a reference to a nonexistent lint rule in the root layout. Clean these up without assuming every lint error demonstrates a user-facing failure.
- Version labels differ between package metadata (`0.7.4`) and the footer (`1.37.1`); consolidate release metadata when the intended version source is established.

## Premium Acceptance Standard

Accessibility should target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), including [normal text contrast of 4.5:1 and large text contrast of 3:1](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), keyboard operation, associated form labels, visible focus, usable magnification, and [reflow at 320 CSS pixels](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), with appropriate exceptions for inherently two-dimensional maps/tables. Shared overlays should follow the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Performance should target [Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds): LCP at most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1 at the 75th percentile of actual visits. There are no field measurements in this review, so performance is ungraded.

Product acceptance should include all guest, requester, collaborator, and staff journeys; successful and failed requests; touch and keyboard input; account preferences across devices; real room photography; preserved booking context; honest availability; stable pricing/date/status presentation; and dependable saves. Essential information should be comfortably readable, and actions should be easy to tap, with approximately 44px targets where practical.

## Recommended Order

1. Fix F01-F06: visible booking failure, accessible navigation, contrast, discount dialog, missing detail data, and error-safe loaders.
2. Fix preference synchronization, responsive grids/toolbars, date handling, auth return paths, and map theme precedence.
3. Establish shared Button, Field, Dialog/Drawer, Tabs, StatusBadge, and loading/error primitives using semantic theme tokens. Migrate pages incrementally; avoid a wholesale rewrite.
4. Replace room placeholder photography, preserve chosen rooms through booking, and add draft recovery.
5. Restore a reproducible local build, make lint/type checks pass, and add focused automated coverage for critical failure paths. Run browser checks across eight themes, mobile/desktop sizes, roles, keyboard navigation, zoom, and reduced motion.
6. Measure production performance and booking completion/failure rates before further animation or visual embellishment.

The largest improvement will come from consistent, dependable interactions and readable interfaces. More decorative treatments would not address the current gaps.
