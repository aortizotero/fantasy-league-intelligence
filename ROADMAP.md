# 🏈 Product Roadmap: Fantasy Analytics Platform for Sleeper

🇲🇽 [Leer en español](ROADMAP.es.md)

A phased plan to design, build, and monetize an interactive web tool for the **Sleeper** league ecosystem, prioritizing virality, UI/UX, and multiple revenue streams.

---

```
[ Phase 1: Viral MVP ] ➔ [ Phase 2: Engagement ] ➔ [ Phase 3: Monetization ] ➔ [ Phase 4: Scale ]
(Aug - Sept)               (Oct - Nov)              (Preseason/Launch)          (Expansion)
```

---

## 🔎 Roadmap evaluation

**What works well:**
- The viral loop is well designed: zero signup friction in Phase 1 + exportable cards for the league chat is the right distribution channel — Sleeper has no social feed of its own, so the league chat *is* the feed.
- The monetization sequence is sound: traffic first (low-effort DFS affiliates), then retention (weekly recap), and only *then* asking for a credit card (Phase 3). Charging before proving recurring value would kill adoption.
- This repo's v1 already covers part of Phase 1 (parallel fetch + in-memory cache against the Sleeper API), so "Ultra-Fast Sync" isn't starting from zero.

**Risks and gaps to fix:**
1. **Localization in Phase 4 is too late.** If the key differentiator is "100% Spanish for LatAm/Mexico/Spain," that's a Phase 1 value, not an expansion nice-to-have — it competes directly with ESPN/Yahoo/Sleeper itself, all English-only. Recommendation: Spanish-first UI from the MVP; Phase 4 becomes *additional* languages (Portuguese for Brazil, etc.), not the first one.
2. **VORP and projections need a data source Sleeper doesn't provide.** The Sleeper API doesn't expose player projections — the Draft Assistant (Phase 3) and any "strongest/weakest" ranking need a second provider (FantasyPros, unofficial ESPN). This is already scoped as v2 in this repo's technical roadmap ("Multi-source data") — pull it forward before committing the Draft Assistant to Phase 3.
3. **Sleeper's live draft has no public websocket.** The "Live Draft Assistant" would need aggressive polling against the picks endpoint, not real-time push. Worth sizing as a technical risk before selling it as a paid pass.
4. **DFS affiliate CTAs in Phase 1 can clash with the "zero friction" promise.** Keep them as a discreet banner or a slot on the exported card, never as an interstitial.
5. **Missing a mid-week retention hook** (not just the post-matchup recap): waiver-deadline and incomplete-lineup alerts are cheap to build and give users a reason to come back *before* the week starts, not only after.

---

## 🎨 Phase 1: Viral MVP & Hook (Sync + Social Reports)
> **Goal:** Capture massive traffic with zero signup friction and drive organic sharing in league chats.

### 1. Ultra-Fast Sync (Sleeper API)
* Direct queries against the public Sleeper API via `username` or `league_id`.
* Automatic detection of league format: **Redraft**, **Dynasty**, **Superflex**, **PPR**, **TE Premium**, and **IDP**.
* UI 100% in Spanish from day one (moved up from Phase 4 — see Evaluation).

### 2. Card & Report Generator for League Chats (The Social Hook)
* **Visual Power Rankings:** Modern, clean graphic cards ready to export as PNG/JPG.
* **"Luck" Index:** Real record vs. the expected record if the team had faced every rival every week.
* **🆕 Season record projection:** in the style of the widget the official NFL app used to have — using each team's remaining schedule, project the likely final record (based on strength of remaining opponents and recent performance). Shares a table with the Luck Index but looks forward instead of back.
* **Share button:** one-click copy-to-clipboard to paste the image or link directly into the Sleeper app.

### 3. Basic Monetization
* Contextual CTAs with **DFS affiliate** codes (*Underdog Fantasy*, *PrizePicks*, *Sleeper Picks*), placed discreetly (never as an interstitial).

---

## 📊 Phase 2: Engagement & Weekly Analytics
> **Goal:** Convert casual visits into weekly recurring users during the NFL regular season.

### 1. Roster Evaluator & Team Health
* Positional balance diagnosis (strengths, weaknesses, bench depth).
* Automatic competitive-window classification: **Contender** vs. **Rebuilder**.
* **🆕 League-wide positional strength/weakness ranking:** not just "how's my team?" but "who's the strongest and weakest in the league at QB/RB/WR/TE?" — a comparative view across all teams in the league, position by position.
* **🆕 Positional surplus finder:** if you want to reinforce a position (e.g. RB), the tool identifies which team(s) in the league have surplus depth there (bench depth above the starter threshold) — the natural starting point for a trade.

### 2. Trade Module (Trade Analyzer)
* Trade calculator adjusted to the league's specific scoring settings.
* Future rookie pick valuation (essential for Dynasty leagues).
* **🆕 Ideal trade proposal generator:** pick a player on another team's roster that you want to acquire, and the engine automatically builds a balanced offer using your own assets (players + picks), based on value and both rosters' needs — plugs directly into the surplus finder above.

### 3. Weekly Recap Report (Matchup Recap)
* "Social" content generation:
  * *Lineup mistake of the week* (points left on the bench).
  * *Blowout of the week*.
  * *MVP of the week*.
* **🆕 "Before kickoff" alerts:** waiver-deadline reminders and incomplete/bye-week lineup warnings, giving users a reason to come back *before* kickoff, not just a recap after.

---

## 💳 Phase 3: Pro Architecture & Direct Monetization
> **Goal:** Ship payment rails and advanced features ahead of the draft-season peak.

### 1. User & Payment Infrastructure
* Lightweight auth (Email, Google Sign-In) to save favorite leagues and preferences.
* Stripe integration for recurring subscriptions and one-time charges.

### 2. Pro Module: Live Draft Assistant (One-Time Payment / Season Pass)
* Interactive board synced during Sleeper's live draft (via polling against the picks endpoint — Sleeper has no public draft websocket, so polling frequency needs careful sizing).
* Pick-by-pick suggestions based on **VORP** (*Value Over Replacement Player*) and roster needs — requires an external projections source (see Evaluation, point 2).

### 3. Pro Module: Multi-League Dashboard (Monthly Subscription)
* Consolidated dashboard for hardcore users managing 5, 10+ leagues at once.
* Unified waiver-wire view and incomplete-lineup alerts across all leagues.

---

## 🚀 Phase 4: Scale, Localization & Partnerships
> **Goal:** Position the platform as the go-to tool in the Spanish-speaking market and build partnerships.

### 1. Additional Localization
* Expand to more languages/variants (e.g. Portuguese for Brazil) — Spanish is already native from Phase 1.

### 2. Content Creator Exporter
* Module for podcasters, analysts, and commissioners to generate custom-branded reports for their shows or leagues.

### 3. Direct Module Sponsorship
* Sell discreet sponsorship slots in the interface (e.g. *"Trade Calculator presented by [Brand]"*).

---

## 🛠️ Recommended Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js / React + Tailwind CSS | Ultra-fast, responsive, mobile-optimized UI. |
| **Visual generation** | `@vercel/og` / `html-to-image` | Instantly converts React components to exportable images. |
| **Backend & DB** | Node.js + Supabase / Firebase | Lightweight auth and profile/league storage. |
| **Payment gateway** | Stripe API | Manages Pro subscriptions and season-pass sales. |
| **Data source** | Sleeper API (`api.sleeper.app`) | League, roster, transaction, and draft data. |
| **Projections source** | FantasyPros / ESPN (unofficial) | Needed for VORP, positional strength ranking, and record projection — Sleeper exposes no projections. |

---

## 💡 Ideas from the Chafi feedback thread

| Original idea | Where it landed |
| :--- | :--- |
| "Also build the season record projection like the NFL app used to do" | Phase 1 → Card Generator, *Season record projection* |
| "Who's the strongest and weakest at each position?" | Phase 2 → Roster Evaluator, *League-wide positional strength/weakness ranking* |
| "Who has surplus RBs (or any position), so I can go target them" | Phase 2 → Roster Evaluator, *Positional surplus finder* |
| "Put in a player from the other team and have it build an ideal trade proposal" | Phase 2 → Trade Analyzer, *Ideal trade proposal generator* |
