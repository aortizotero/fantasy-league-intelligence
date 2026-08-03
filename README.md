# Fantasy League Intelligence

🇲🇽 [Leer en español](README.es.md)

A fantasy football analytics tool that starts as a simple API integration and grows, version by version, into an AI-powered agent — each version is a deliberate step up in technical complexity, built as a public record of that progression.

**[→ v1 is live: standings, head-to-head history, GOAT rankings, and auto-generated storylines](v1/)**

**[→ Product roadmap: viral MVP, engagement, monetization, and scale phases](ROADMAP.md)**

## The arc

Each version adds a genuinely different kind of integration, not just more features on the same stack:

| Version | Adds | Demonstrates |
|---|---|---|
| **v1 — API Integration** ✅ | [Sleeper API](https://docs.sleeper.com/) integration: historical standings, head-to-head records across every season, GOAT rankings (championships-weighted, not just win/loss), and auto-generated storylines from the data ("best regular-season record in league history, zero championships") | REST API consumption, JSON data modeling, a real frontend |
| **v2 — Multi-source data** | Cross-reference Sleeper player IDs with an NFL stats API (ESPN / nfl.com unofficial) to enrich player data with real performance stats | Multi-API integration, data normalization across platforms |
| **v3 — AI layer** | Claude API generates natural-language trade analysis ("this trade historically favors Team A because...") | LLM integration, prompt engineering, combining structured data with AI reasoning |
| **v4 — Notifications** | Discord/Slack webhooks for trades, relevant waiver moves, and trending-player alerts | Event-driven integrations, webhooks, messaging platform APIs |
| **v5 — MCP / agentic layer** | The whole project becomes its own MCP server, so any AI agent can query the league's state in natural language | Agent architecture, MCP, the full loop of building an agentic tool |

## v1 highlights

- **Championships-first GOAT ranking** — best regular-season record isn't automatically "the best manager ever." A manager can have the best win percentage in league history and rank *below* someone with fewer wins but multiple titles. The ranking reflects that on purpose.
- **Head-to-head matrix**, not a flat list — the standard shape for this kind of data, with collision-safe abbreviated column headers (two managers with the same first three letters of their name don't get identical, ambiguous columns).
- **Auto-generated narratives** — a small rule engine turns raw stats into actual storylines ("The Curse": best-ever record, zero rings; "The Executioner": the most lopsided rivalry in league history) without needing an LLM yet — that's what v3 is for.
- Every request fans out in parallel (not sequential) against the Sleeper API, with an in-memory cache so the same league's rosters/matchups aren't re-fetched three times per page load.

## Stack (v1)

Node.js + Express, vanilla JS/HTML/CSS frontend (no framework yet, deliberately — v1 is about the API integration, not the UI layer). No auth needed: Sleeper's API is fully public and read-only.

## Status

v1 shipped and running against a real 6-season dynasty league. v2 onward not started yet.
