# Fantasy League Intelligence

🇲🇽 [Leer en español](README.es.md)

A fantasy football analytics tool that starts as a simple API integration and grows, version by version, into an AI-powered agent — each version is a deliberate step up in technical complexity, built as a public record of that progression.

**[🔴 Live: storyofmyleague.com](https://www.storyofmyleague.com)** — standings, head-to-head history, GOAT rankings, player/draft/trade storylines, and shareable stat cards. Source in [`v1/`](v1/).

## The arc

Each version adds a genuinely different kind of integration, not just more features on the same stack:

| Version | Adds | Demonstrates |
|---|---|---|
| **v1 — API Integration** ✅ | [Sleeper API](https://docs.sleeper.com/) integration: historical standings, head-to-head records across every season, GOAT rankings (championships-weighted, not just win/loss), and auto-generated storylines from the data ("best regular-season record in league history, zero championships") | REST API consumption, JSON data modeling, a real frontend |
| **v2 — Multi-source data** ✅ | Cross-references Sleeper player/draft/transaction data with ESPN's stats API to enrich player-level storylines (best individual week, worst bench call, biggest draft steal/bust, most lopsided trade) with real stat lines instead of just fantasy points | Multi-API integration, data normalization across platforms |
| **v3 — AI layer** | Claude API generates natural-language trade analysis ("this trade historically favors Team A because...") | LLM integration, prompt engineering, combining structured data with AI reasoning |
| **v4 — Notifications** | Discord/Slack webhooks for trades, relevant waiver moves, and trending-player alerts | Event-driven integrations, webhooks, messaging platform APIs |
| **v5 — MCP / agentic layer** | The whole project becomes its own MCP server, so any AI agent can query the league's state in natural language | Agent architecture, MCP, the full loop of building an agentic tool |

## Highlights

- **Championships-first GOAT ranking** — best regular-season record isn't automatically "the best manager ever." A manager can have the best win percentage in league history and rank *below* someone with fewer wins but multiple titles. The ranking reflects that on purpose.
- **Head-to-head matrix**, not a flat list — the standard shape for this kind of data, with collision-safe abbreviated column headers (two managers with the same first three letters of their name don't get identical, ambiguous columns).
- **9 auto-generated league narratives** — a rule engine turns raw stats into actual storylines ("The Curse": best-ever record, zero rings; "The Executioner": the most lopsided rivalry in league history; "The Draft Steal", "The Most Lopsided Trade", etc.) without needing an LLM yet — that's what v3 is for. Player-level ones are enriched with real ESPN stat lines ("Rushing: 32 CAR, 185 YDS, 4 TD").
- **Shareable stat cards** — any row/cell in the app (GOAT, H2H, a season, a narrative, a trophy) renders to a PNG client-side and shares via the Web Share API, no server round-trip.
- **Roster-building tools** — position depth and net draft-pick capital per manager, for "who do I trade with."
- **Trophy Case, Playoff Bracket, Power Rankings, Season Trend, Luck Index (all-play expected record), Trade Tracker** — a full second layer of history/analysis tools beyond the base roadmap, built against a real, live 6-season dynasty league.
- **English/Spanish toggle** (defaults to English) and a light/dark theme, both persisted client-side, both fully covering the server-generated narrative text, not just UI chrome.
- Every request fans out in parallel (not sequential) against the Sleeper API, with an in-memory cache so the same league's rosters/matchups aren't re-fetched three times per page load.

## Stack

Node.js + Express, vanilla JS/HTML/CSS frontend (no framework, deliberately — the point of v1 was the API integration, not a UI framework, and it stuck). No auth needed: Sleeper's API is fully public and read-only.

## Status

v1 and v2 shipped and live at [storyofmyleague.com](https://www.storyofmyleague.com), running against a real 6-season dynasty league. v3 (AI layer) is next, not started yet.
