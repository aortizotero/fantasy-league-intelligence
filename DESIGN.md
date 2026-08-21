---
name: Story of My League
description: A stadium-scoreboard instrument panel for fantasy football league history and AI trade decisions
colors:
  bg-ink: "#0a0d14"
  panel-tint: "#0e1119"
  border-hairline: "#262e40"
  text-bone: "#ece7da"
  muted-slate: "#838b9e"
  ghost: "#3a4358"
  accent-cathode: "#ffb454"
  accent-contrast: "#1a1006"
  error-red: "#ff7a7a"
  negative-rose: "#c98890"
  bg-paper: "#f6f2e7"
  panel-tint-light: "#faf6ec"
  border-hairline-light: "#e4d8bc"
  text-ink: "#211d14"
  muted-warm: "#6b6455"
  ghost-light: "#c9bfa4"
  accent-cathode-light: "#a04a15"
  accent-contrast-light: "#fffbf5"
  error-red-light: "#b4232b"
  negative-rose-light: "#8c4a4c"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "8px"
  card: "12px"
  pill: "20px"
spacing:
  section-sm: "16px"
  section: "20px 24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-cathode}"
    textColor: "{colors.accent-contrast}"
    typography: "{typography.display}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
---

# Design System: Story of My League

## Overview

**Creative North Star: "The Scoreboard / Marquee"**

Every stat on this page is a lit digit against its own dark ghosts. The system reads like a stadium scoreboard or an instrument panel — one cathode-amber glow marking whatever value is real or yours, low-opacity "ghost" duplicates sitting behind it for the alternatives — not another SaaS analytics dashboard built from white cards and soft shadows. Dark is the primary, default identity (mobile, short glance-and-share sessions, Sunday/Monday NFL) — "the marquee at night." Light mode is the secondary, fully-supported "daylight readout" variant: same geometry and material logic, paper-and-ink temperature instead of night-glow, never an afterthought.

This direction won a seeded concept roll against three others (a Box Score/Ledger newspaper world, a vintage Trading Card world, and the category-standard clean dashboard) specifically because it does double duty: it dramatizes "your league's real history" (the struck-forward value is always the true one) and "help me decide" (Trade Analyzer/Roast verdicts glow the same way a winning ticker value would) in one material, without borrowing gambling or esports cues — the amber-on-ink palette reads as instrument, not casino.

Confirmed visual rejections: no card-box-with-shadow as the default content container; no green as the accent (retired in favor of amber); no decorative gradients, glass, or icon tiles; monospace is used only where it is earned (numerals, labels, measurement), never as a "technical" costume on prose.

**Key Characteristics:**
- Struck-forward amber glow marks the one number that matters; everything else stays legible, never artificially dimmed by default.
- Flat plane, not elevated cards — hairline top-rules and a faint mesh-grille texture do the grouping work shadows used to do.
- JetBrains Mono for every number, heading, and label; Inter for prose and proper nouns.
- Dark-primary, light-secondary — a deliberate reversal from the previous version, where both modes were treated as symmetric.

## Colors

Two hues carry the whole system per mode — amber-on-ink (dark) or amber-on-paper (light) — plus the two inherited semantic exceptions (error red, desaturated negative-rose) that predate this redesign and are preserved for continuity.

### Primary
- **Cathode Amber** (`#ffb454` dark / `#a04a15` light): the one accent. Marks "the real/yours" value — winning rows, your team's highlight, positive deltas, active nav/filter states, focus rings, button fills. Never means loss.

### Neutral
- **Ink** (`#0a0d14`, dark mode background): the marquee ground.
- **Panel Tint** (`#0e1119` dark / `#faf6ec` light): the barely-there plane shift that separates one section from the next on a long page — not a card, a few percent of tonal difference.
- **Bone** (`#ece7da` dark text / `#211d14` light text, `211d14`/`ece7da` respectively): primary reading color, 15:1+ against its background in both modes.
- **Slate** (`#838b9e` dark muted / `#6b6455` light muted): secondary text — hints, captions, table headers.
- **Ghost** (`#3a4358` dark / `#c9bfa4` light): the unlit duplicate. Deliberately low-contrast and decorative — the "vs" separator, the bracket's not-yet-decided team, a projected-but-not-real value. Never the reading a user needs.
- **Hairline** (`#262e40` dark / `#e4d8bc` light): section top-rules and table row dividers, intentionally low-contrast against the background (~1.5–2:1) — a decorative separator, not a WCAG non-text-contrast boundary. Interactive focus states carry their own high-contrast ring instead.

### Named Rules
**The One Glow Rule.** Amber is the only color that means "pay attention to this" anywhere in the app. It never appears twice in the same view meaning two different things.

**The Ghost Is Decorative Rule.** Anything rendered in `ghost` is context, never the answer. If removing it would remove information the user needs, it was the wrong token.

## Typography

**Display Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)
**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)

**Character:** An instrument-panel numeral face carrying every heading, label, badge, and number in the app, paired with a plain, highly-legible humanist sans for prose and proper nouns — the readout voice and the reading voice, kept visibly distinct on purpose.

### Hierarchy
- **Display** (800, 32px, -0.02em): the `<h1>` wordmark only.
- **Headline** (700, 19px): section `<h2>` titles — reads like scoreboard/departure-board signage.
- **Title** (700, 17–20px, JetBrains Mono for numerals / Inter for names): hero stats (GOAT hero, stat-card headline), narrative headlines.
- **Body** (400, 13.5–14px, Inter, 1.5–1.6 line-height): narrative detail text, AI result prose, hints, form help.
- **Label** (600–700, 10.5–13px, JetBrains Mono, uppercase, 0.05–0.09em tracking): table headers, badges, kickers, nav pills.

### Named Rules
**The Measurement-Only Mono Rule.** JetBrains Mono is reserved for numerals, headings-as-signage, and short labels — never body prose, and never a manager's name (see `.name-cell` / `.row-label`, which reset to Inter inside otherwise-mono tables).

## Layout

Single-column content, `max-width: 900px`, centered — unchanged from the incumbent structure; this redesign is a material and token change, not an information-architecture change. ~20 distinct sections are grouped into three time-based chapters (Ahora Mismo / Historia de la Liga / Analiza y Planea) behind a sticky pill-nav with scrollspy. Section padding: `20px 24px` desktop, `16px` under 480px. Tables and wide grids scroll horizontally within their own box on mobile; Roster Depth/Value and Points Report additionally swap to stacked mobile cards under 480px.

## Elevation & Depth

Flat by design — the redesign explicitly retired the card-plus-border-plus-shadow elevation model. Depth is now read two ways: a barely-there **panel-tint** plane shift (a few percent lighter/darker than the page background) separates one section from the next, and a **glow** (an amber `text-shadow`, never a `box-shadow`) marks a value as "struck forward" and lit rather than "raised." The one exception is the share-card modal, which is a genuine interruption and keeps real offset+blur elevation.

### Shadow Vocabulary
- **`--shadow-sm` / `--shadow-md`** (`0 1px 2px rgba(0,0,0,.3)` / `0 4px 10px -2px rgba(0,0,0,.45)`): unused by any current component; reserved for a future genuinely-lifted surface.
- **`--shadow-lg`** (`0 12px 28px -6px rgba(0,0,0,.55)`): the share-card modal and the scroll-hint pill — the only two surfaces treated as physically above the page.

### Named Rules
**The Glow-Not-Lift Rule.** A highlighted value gets brighter (amber `text-shadow`), never taller (`box-shadow`). Elevation is reserved for things that are genuinely, temporarily on top of the page — a modal, not a stat.

## Shapes

Radius stays modest and purposeful: `8px` (`--radius-control`) for inputs/buttons, `12px` (`--radius-card`) for the few surfaces that remain real boxes (narrative cards, the modal, stat/AI share-cards), `20px` (`--radius-pill`) for small discrete controls (nav pills, segmented filters, selects, badges) — never for content containers. Sections themselves are radius-less: a `1px` hairline top-rule (`2px` amber on anchor sections) is their only edge.

## Components

### Buttons
- **Shape:** 8px radius (`--radius-control`).
- **Primary:** amber fill, ink-dark text (`#1a1006` dark / `#fffbf5` light), JetBrains Mono, 700 weight, `12px 20px` padding.
- **Hover / Focus:** opacity dip on hover/active; focus-visible gets a 3px amber glow ring (`rgba(255,180,84,.3)`), replacing the old green ring.
- **Pill triggers** (`.card-trigger-btn`, `.ai-analyze-btn`, `.roast-btn`): transparent fill, hairline border, pill radius, JetBrains Mono label.

### Cards / Containers
- **Sections** (the ~20 content blocks): no border-box, no shadow — `panel-tint` background, `1px` hairline top-rule (`2px` amber on anchor sections).
- **Narrative cards**: the one place a real bordered box survives (12px radius, `panel` fill, hairline border) — a paragraph of prose needs somewhere legible to sit; hover adds an amber glow ring, no lift.
- **Stat cards / AI cards** (the shareable brand assets): always dark regardless of page theme, now the natural default rather than an exception — ink background, subtle radial amber glow + mesh-dot texture, 2px amber top border.

### Inputs / Fields
- **Style:** `panel` background, hairline border, 8px radius, JetBrains Mono for the League ID field (an ID is data, not prose).
- **Focus:** 3px amber glow ring.
- **Error:** red border + red glow ring (the only place red text/borders appear — never "loss" in a stat).

### Navigation
- **Jump-nav / segmented filters:** pill-radius, JetBrains Mono labels, transparent-to-amber active state, sticky with scrollspy.
- **Lang/theme toggles:** small hairline-bordered pill buttons, amber-filled when active.

### Signature Component: the "struck" state
Any row, cell, or number that is "the one that matters right now" (`.goat-row`, `td.depth-max`, `.power-up`, `.pp-actual.power-up`, `tr.is-me`, `.matchup-team.won`, `.bracket-team.won`) drops its old flat green tint in favor of amber text + a soft `text-shadow` glow (`0 0 8–16px` at the accent's own low-opacity glow token) — the "cathode" signature the whole redesign is named for.

## Do's and Don'ts

### Do:
- **Do** use JetBrains Mono for anything that is a number, a short code, or signage-style text (headings, labels, badges) — that's the earned, sanctioned use of a monospace face here.
- **Do** mark a highlighted value with an amber `text-shadow` glow, never a background tint or a `box-shadow`.
- **Do** keep the share-card assets (`.stat-card`, `.ai-card`) hard-coded to the dark palette regardless of the page's active theme — they are a brand asset, not a themed surface.
- **Do** treat `--ghost` as decorative-only; anything the user must be able to read stays at full `--text`/`--muted` contrast.

### Don't:
- **Don't** reintroduce a bordered-box-plus-drop-shadow "card" as the default container for a content section — that model was deliberately retired.
- **Don't** use green anywhere in this system; the accent is amber, full stop.
- **Don't** put JetBrains Mono on body prose or on a manager/team name — use the `.name-cell`/`.row-label` reset to Inter.
- **Don't** treat light mode as symmetric-but-secondary polish work — it is a fully maintained variant of the same instrument, not an afterthought, even though dark is the default.
