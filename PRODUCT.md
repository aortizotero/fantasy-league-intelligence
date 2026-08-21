# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fantasy football managers in Sleeper dynasty/redraft leagues. Founding use case is Alex's own league ("Dominators Dinasty" — dynasty, Superflex, half-PPR, 10 teams, 6 seasons), but the product is deliberately built for any Sleeper league: a manager pastes their League ID and gets the same experience. Growing adoption beyond Alex's league is an active goal, not just incidental architecture (SEO quick-wins already shipped for this reason).

## Product Purpose

Turns raw Sleeper league data into a rich, narrative-driven history and decision-support tool for fantasy football managers: historical standings, head-to-head records, GOAT/Hall of Fame rankings, automatically generated narratives (draft steals/busts, lopsided trades, worst bench decisions, etc.), and AI-assisted trade/roster tools. Success looks like managers returning to check stats, sharing stat cards socially, and actually using the AI tools to make real trade decisions.

## Positioning

The hook is the combination, not either piece alone: deep historical storytelling (narratives, GOAT, Hall of Fame, records generated from a league's real multi-season history — nothing a generic platform surfaces) plus AI-assisted decision tools (Trade Analyzer for hypothetical trades, Trade Suggester, Roast My Team, AI verdicts on real historical trades). Sleeper, ESPN, and KeepTradeCut each cover fragments of this (raw data, or trade values, or league management) — none combine "the story of your league" with "help me decide what to do next."

## Operating Context

A manager pastes a Sleeper League ID with no login/auth (Sleeper's API is public and read-only). The page is organized into three time-based groups — Ahora Mismo (current season), Historia de la Liga (all-time history), Analiza y Planea (AI decision tools) — navigable via a sticky scrollspy nav. Individual stats render as shareable cards (tap/click to open), exported client-side and sent via Web Share to WhatsApp/Instagram or downloaded on desktop. EN/ES and light/dark are both user-togglable and persisted per-browser (not per-league).

## Capabilities and Constraints

- Node.js + Express backend; vanilla JS/CSS frontend using classic `<script>` tags (no build step, no framework, by design) — all frontend scripts share one global lexical scope, so top-level variable names must be checked across files before adding new ones.
- Data sources: Sleeper API (primary, public, read-only), ESPN's unofficial API (player game logs, no auth), FantasyCalc (dynasty trade values, 12h TTL — the only cache in the project with a TTL), Sleeper's projections API.
- AI features (Trade Analyzer, Trade Suggester, Roast My Team, trade-history analysis) call Claude Haiku 4.5 via `@anthropic-ai/sdk`; all degrade gracefully to a bilingual 503 without `ANTHROPIC_API_KEY` rather than breaking the rest of the app.
- i18n: English default, Spanish optional, toggle persisted in `localStorage`, not scoped per league.
- Light/dark mode, WCAG 2.1 AA audited (2026) and fixed — contrast, keyboard operability, focus management, table semantics.
- Cloudflare Turnstile bot-gate on the League ID form only (not the AI endpoints, which rely on payload validation instead).
- **No monetization today, but planned for the future** (ads, paid tier, or donations — not yet decided which). Sleeper's API terms are explicit: free for non-commercial use only; commercial use requires contacting Sleeper to license first. This must happen before any monetization ships.
- Deployed self-hosted via Coolify at storyofmyleague.com; DNS on GoDaddy, SSL via Let's Encrypt.

## Brand Commitments

Name is "Story of My League" / storyofmyleague.com — all in-app branding (title, H1, card footers, share sheet title) was deliberately moved to the domain form at Alex's request, since shareable cards carry that footer wherever they're shared. No NFL trademarks or team/league logos are used anywhere — player and team names appear only as factual data (same nominative-fair-use posture as ESPN or Pro-Football-Reference). Current mark is a 🏈 emoji favicon (data-URI, no real logo asset yet). Shareable stat cards are a protected brand asset: they always render in a fixed dark theme regardless of the viewer's active site theme, because they travel to WhatsApp/Instagram independent of site settings.

## Evidence on Hand

Real league data from "Dominators Dinasty" (Sleeper League ID `1342746115425964032`; dynasty, Superflex, half-PPR, 10 teams, 6 seasons) has been used throughout development and every feature has been verified against it live. No testimonials, press, or validation yet from managers outside Alex's own league — growth beyond it is a goal, not yet evidence.

## Product Principles

- Never assert a narrative or record the underlying data doesn't actually support — every automatic narrative has a minimum game/season threshold before it's shown.
- AI features never get to invent context they weren't given (injuries, motives, external rankings) — prompts are scoped strictly to real computed data from Sleeper/ESPN/FantasyCalc.
- Degrade gracefully, never block: a missing API key, an unavailable third-party source, or a season that hasn't started yet all hide just the affected section instead of erroring for the whole page.
- Stay retrospective and honest over predictive or invented — no external ADP data, no synthetic benchmarks; rankings and "steal/bust" narratives are computed only from what the league's own real history supports.
- No runtime CDN dependency except Cloudflare Turnstile, which cannot be self-hosted.

## Accessibility & Inclusion

WCAG 2.1 AA audited and fixed (2026): color contrast (dedicated text-safe tokens separate from background/border tokens), full keyboard operability of the row/card share interactions, focus management (trap, restore, Escape) in the share modal, and correct table semantics (`scope="row"/"col"`). Any future visual work must preserve these fixes, not just the current look.
