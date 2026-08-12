# Component Specifications — Story of My League

Baseline: current state documented. These are the **actual** components in production, not aspirational design.

**Status (updated after the follow-up pass):** all 11 recommendations from the original audit have been applied to `public/style.css`, plus the new Trade Tracker manager-search `<select>` (added after this audit was first written) has been folded into the shared `select` component below. See "Recommendations" at the bottom for what changed and, where a recommendation was *not* implemented literally, why.

## Button (Primary)

**Tokens:** `--accent` (bg), `--accent-contrast` (text)

**States:**

| State | CSS | Visual |
|-------|-----|--------|
| Default | `background: var(--accent)` | Green fill, white text |
| Hover | `opacity: 0.9` | Slightly transparent |
| Active | `opacity: 0.8` | More transparent |
| Focused | `box-shadow: 0 0 0 3px rgba(0, 196, 106, 0.25)` | Green glow ring |
| Disabled | `opacity: 0.5; cursor: not-allowed` | Grayed out |

**Done:** `active`/`disabled` states added directly to the base `button` rule, plus a `transition: opacity 0.15s ease` so hover/active/disabled all animate instead of snapping.

---

## Button (Secondary / Card Trigger)

**Tokens:** `--border` (border), `--text` (text), `--accent-text` (hover text)

**Classes:** `.card-trigger-btn`, `.ai-analyze-btn`, `.ta-analyze-btn` — three call sites that were declaring the identical padding/font-size/radius/border/background independently.

**States:**

| State | CSS | Visual |
|-------|-----|--------|
| Default | `border: 1px solid var(--border)` | Outlined, transparent bg |
| Hover | `border-color: var(--accent); color: var(--accent-text)` | Green outline + text |
| Disabled (`.ai-analyze-btn`, `.ta-analyze-btn` only) | `opacity: 0.6; cursor: default` | Dimmed, no pointer |
| Focused | `box-shadow: 0 0 0 3px rgba(0, 196, 106, 0.25)` | Green glow ring |

**Done:** the shared size/shape (padding, font-size, radius, border, background) is now declared once, in a single grouped selector, and each class only overrides its own font-weight/default color. **Not** renamed to `.btn`/`.btn--secondary` — the three classes are read directly by JS event delegation (`e.target.closest(".ai-analyze-btn")` in `app.js`, and the equivalent in `tradeAnalyzer.js`), so a rename would require touching those listeners too for a purely cosmetic win. The duplication was eliminated at the CSS level instead, which was the actual problem the recommendation was pointing at.

---

## Input (Text)

**Tokens:** `--card` (bg), `--border` (border), `--text` (text)

**ID:** `#league-id`

**States:**

| State | CSS | Visual |
|-------|-----|--------|
| Default | `border: 1px solid var(--border)` | Card surface, light border |
| Hover | `border-color: var(--accent)` (skipped while `.invalid`) | Green border on hover |
| Focused | `box-shadow: 0 0 0 3px rgba(0, 196, 106, 0.25)` | Green glow ring |
| Invalid | `border-color: var(--error)` | Red border + red glow on focus |

**Done.**

---

## Select (Dropdown)

**Classes:** bare `select` — one shared rule now covers every dropdown in the app: `#season-filter`, `#trade-tracker-select` (manager search, added after the original audit), `#my-team-select`, `#points-report-scope`, `#ta-offer-select`, `#ta-request-select`. Previously each of these repeated the same five declarations in its own rule block.

**Tokens:** `--bg` (bg), `--border` (border), `--text` (text)

**States:**

| State | CSS | Visual |
|-------|-----|--------|
| Default | `background: var(--bg); border: 1px solid var(--border)` | Background surface, light border |
| Hover | `border-color: var(--accent)` | Green border on hover |
| Focused | `box-shadow: 0 0 0 3px rgba(0, 196, 106, 0.25)` | Green glow ring |
| Disabled | `opacity: 0.5; cursor: not-allowed` | Grayed out (no `<select>` is currently disabled in the app, but the state exists for free) |

**Size variant:** `#points-report-scope` overrides to a smaller `padding: 6px 10px; font-size: 13px` — it sits inline next to its own label rather than standing alone, so it reads as a compact control on purpose, not an inconsistency.

**Trade Tracker manager search (`#trade-tracker-select`):** functionally identical to every other select here — same default/hover/focus/disabled behavior, wrapped in `.trade-tracker-search` for layout spacing only (`margin: 4px 0 16px`) and paired with a `.sr-only` `<label>` (there's a visible section heading right above it, so a second visible label would be redundant, but it still needs a real programmatic name). No component-level fix was needed here; it inherited every state correctly once the shared `select` rule existed.

**Done:** hover state added; icon-on-the-right was skipped as unnecessary — native `<select>` arrows already signal "dropdown" on every platform this app is used on.

---

## Table (Standard)

**Tokens:** `--border` (divider), `--text` (text), `--muted` (header text)

**States:**

| Element | CSS | Visual |
|---------|-----|--------|
| Header (`th`) | `color: var(--muted); font-size: 11px; text-transform: uppercase` | Muted, small caps |
| Row | `border-bottom: 1px solid var(--border)` | Standard row divider |
| Row hover | `background: rgba(0, 196, 106, 0.05)` | Subtle green tint, readability only |
| Row Highlight (`.goat-row`) | `background: rgba(0, 196, 106, 0.08)` | Subtle green tint (excluded from hover so it doesn't wash out) |
| "Mi equipo" row (`.is-me`) | `background: rgba(0, 196, 106, 0.14)` | Stronger tint (also excluded from hover) |

**Done:** row hover added (`table tr:hover:not(.goat-row):not(.is-me)`), deliberately lighter (0.05 alpha) than `.card-trigger-row`'s hover (0.14) so a plain informational table doesn't visually claim to be clickable when it isn't. Padding was already token-driven (`8px 10px` on `th`/`td`, consistent everywhere) — there was no hardcoded value left to replace.

---

## Table (Matrix / H2H)

**Classes:** `table.matrix` — this **is** the "comparator" variant; a separate `.table--comparator` class was not added since it would just be a second name for the same rule.

**Tokens:** Same as standard table, plus `--border` (diagonal cells)

**Special:** Diagonal cells (`.diag`) are muted to de-emphasize self-matchups. Row hover from the standard-table rule above applies here too (it targets `table tr`, not just plain tables).

**Done (naming):** documented the standard vs. matrix distinction directly in `style.css` as a comment above the base `table` rule, so the variant naming lives next to the code it describes. **Not done (column highlight on hover):** left out — it needs a JS-side "which column is the cursor over" listener, not a CSS-only fix, so it's out of scope for this pass; noted here as a real follow-up if it's ever prioritized.

---

## Card (Narrative)

**Classes:** `.narrative-card`

**Tokens:** `--card` (bg), `--border` (border), `--accent-text` (title), `--muted` (detail), `--shadow-sm`/`--shadow-md`

**Layout:** Icon (28px emoji) → Title (11px) → Headline (17px) → Detail (13px)

**States:** `:hover` → `box-shadow: var(--shadow-md); border-color: var(--accent)`, animated via `transition: box-shadow 0.2s ease, border-color 0.2s ease`.

**Done** (shipped in the previous pass, before this document was written).

---

## Card (Section)

**Tokens:** `--card` (bg), `--border` (border), `--space-section` / `--space-section-sm`

**Padding:** `var(--space-section)` (`20px 24px`) desktop, `var(--space-section-sm)` (`16px`) inside the `max-width: 480px` media query — both now tokens instead of the same literal typed twice.

**Styles:**
- `#narratives-section` has a gradient background (`linear-gradient(160deg, ...)`)
- Standard sections are flat color

**Done (padding token). Not done (single `.section` component with modifiers):** `section` is a bare element selector, not a class, and every section in the DOM is a real `<section>` — introducing `.section`/`.section--narrative` classes would mean adding a class to every `<section>` tag in `index.html` for zero visual change (the gradient override already works fine as `#narratives-section`, a normal CSS override by ID). Skipped as churn without benefit.

---

## Focus Ring (Global)

**Selector:** `#league-id:focus-visible, #my-team-select:focus-visible, button:focus-visible, .card-trigger-btn:focus-visible, .card-trigger-row:focus-visible, .card-trigger-cell:focus-visible, select:focus-visible, a:focus-visible`

**Style:** `box-shadow: 0 0 0 3px rgba(0, 196, 106, 0.25)`

**Color:** Green at 25% opacity (already meets WCAG AA contrast)

**Status:** Already WCAG 2.1 AA compliant. The generic `select:focus-visible` in this list already covered `#trade-tracker-select` and every other dropdown without needing a new entry.

---

## Hero Card (GOAT) / Callout (Week Recap) — the "accent callout" family

**Classes:** `.goat-hero` (lg), `.week-callout` (sm)

**Tokens:** `--accent` (tinted background 8–10%, tinted border 25–35% depending on size), `--radius-card`/`--radius-control`, `--shadow-md` (hero only)

**Status:** documented as two size variants of one visual pattern (accent-tinted background + accent-tinted border) directly in `style.css`, rather than merged into a single `.callout` class. Their values are genuinely different by design (hero: 10%/35% alpha, `--radius-card`, `box-shadow: var(--shadow-md)`, flex layout for the icon+stats row; callout: 8%/25% alpha, `--radius-control`, no shadow, block layout) — collapsing them into one rule with modifiers would mean either losing that intentional weight difference or reintroducing per-variant overrides that just re-create the current two blocks under new names. The comment in `style.css` above `.goat-hero` names both variants and states the sizing rule ("lg" = single headline stat, "sm" = repeated 2–3x) so a future third size has a pattern to follow.

---

## Skeleton / Loading State

**Classes:** `.skeleton` (new)

**Status:** Added — `background: var(--border); border-radius: var(--radius-control); animation: skeleton-pulse 1.4s ease-in-out infinite` (opacity pulse between 0.6 and 1). **Not wired into any component** — every current load is the full-page `#status` "Loading..." text, and no section fetches independently of that. This is infrastructure for the next time a section needs its own loading placeholder, not a currently-visible change.

---

## Summary of Token Usage

**Most-used tokens:**
- `--accent` / `--accent-text`: 45+ places (buttons, highlights, titles, callouts, row hover)
- `--border`: 30+ places (dividers, borders)
- `--text` / `--muted`: 25+ places (body text, labels)
- `--card` / `--bg`: 15+ places (surfaces)
- `--shadow-sm` / `--shadow-md` / `--shadow-lg`: sections, hero card, narrative cards, share modal

**Tokens defined but underused (re-checked):**
- `--error`: Still only in input validation (1 place) — correct as-is, it's a single-purpose token (see the "never confused with a stat loss" comment in `style.css`).
- `--negative`: Still only in Power Rankings (2 places) — same reasoning, deliberately scoped.
- `--radius-pill`: Reviewed against the recommendation to "expand to buttons, badges" — it's already used everywhere a pill shape is appropriate (`.card-trigger-btn`, `.ai-analyze-btn`/`.ta-analyze-btn`, `.coachmark`, `.verdict-badge`, `.stat-card`). Rectangular controls (`.lang-toggle button`, all `<select>`s, the primary `button`) intentionally use `--radius-control` instead — forcing pill radius onto a toggle-button group or a form select would be a regression, not consistency. No change made.

**Tokens NOT YET defined:**
- Font weights (hardcoded 400/500/600/700/800 per component) — not addressed this pass; would need a `--weight-*` scale audited against every component individually, bigger scope than a CSS-only cleanup.
- Letter-spacing (hardcoded per component, values are already consistent at `0.04em`/`0.06em`/`0.08em` — a token would just name three numbers that are already used correctly).

---

## Recommendations (Priority Order) — status

### High Impact

1. **Add shadow hierarchy** — ✅ Done (previous pass): `--shadow-sm`/`--shadow-md`/`--shadow-lg`, applied to sections, GOAT hero, narrative cards (hover), share modal.
2. **Standardize button sizes** — ✅ Done, as CSS de-duplication (see "Button (Secondary)" above) rather than a class rename, to avoid touching JS event delegation for no visual change.
3. **Add row hover** — ✅ Done: subtle hover on standard/matrix table rows.
4. **Define component padding via tokens** — ✅ Done: `--space-section` / `--space-section-sm`.

### Medium Impact

5. **Extract callout/hero as reusable components** — ⚠️ Documented as a two-size family instead of merged into one class (see "Hero Card / Callout" above) — the two are intentionally different weights, not accidental duplication.
6. **Add loading / skeleton states** — ✅ Done: `.skeleton` class + `@keyframes skeleton-pulse`, not yet wired into a component (none currently need one).
7. **Expand `--radius-pill`** — ✅ Reviewed: already correctly scoped, no forced changes made.
8. **Document table variants** — ✅ Done via a `style.css` comment identifying `table` (standard) vs `table.matrix` (comparator); did not introduce `.table--standard`/`.table--matrix` class names since they'd just alias the existing selectors.

### Low Impact (Polish)

9. **Add `active` state to buttons** — ✅ Done: `button:active { opacity: 0.8 }` on the primary button base.
10. **Hover state on inputs** — ✅ Done: `#league-id` and the shared `select` rule both got `:hover` border-color changes.
11. **Disabled state styling** — ✅ Done: generic `button:disabled`/`select:disabled` fallback added (lower specificity than the existing `.ai-analyze-btn:disabled`/`.ta-analyze-btn:disabled` overrides, so those keep their own lighter treatment).

---

## Next Action

This pass closes out the original 11-item list. Real remaining follow-ups, not done here because they need more than a CSS edit:
- Matrix column highlight on hover (needs JS, not just CSS)
- A font-weight token scale (needs a full per-component audit to avoid silently changing existing weights)
