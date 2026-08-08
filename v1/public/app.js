const form = document.getElementById("league-form");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");
const leagueIdInput = document.getElementById("league-id");
const leagueIdError = document.getElementById("league-id-error");

let activeLeagueId = null;
let allTrades = []; // full tradeTracker list from the last load — renderTradeTracker() filters/slices from this, no re-fetch needed
const TRADE_TRACKER_LIMIT = 5;

// Sleeper League IDs are numeric snowflake-style IDs (18-19 digits in
// practice). This isn't a hard spec, just enough to catch "pasted the wrong
// thing" before burning a request on it.
const LEAGUE_ID_PATTERN = /^\d{10,}$/;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const leagueId = leagueIdInput.value.trim();
  if (!leagueId) return;

  if (!LEAGUE_ID_PATTERN.test(leagueId)) {
    leagueIdInput.classList.add("invalid");
    leagueIdError.textContent = t("invalidLeagueId");
    return;
  }
  leagueIdInput.classList.remove("invalid");
  leagueIdError.textContent = "";

  activeLeagueId = leagueId;
  loadLeague(leagueId);
});

leagueIdInput.addEventListener("input", () => {
  leagueIdInput.classList.remove("invalid");
  leagueIdError.textContent = "";
});

// Re-invoked by i18n.js after a language switch, if a league is already
// loaded — narratives are generated server-side, so a language change
// needs a re-fetch, not just a client-side string swap.
window.onLangChange = () => {
  if (activeLeagueId) loadLeague(activeLeagueId);
};

async function loadLeague(leagueId) {
  results.hidden = true;
  statusEl.textContent = t("loading");

  try {
    const res = await fetch(`/api/league/${encodeURIComponent(leagueId)}?lang=${getLang()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("unknownError"));

    render(data);
    if (window.initCards) window.initCards(data);
    if (window.initMyTeam) window.initMyTeam(data, leagueId);
    statusEl.textContent = "";
    results.hidden = false;
    maybeShowCoachmark();
  } catch (err) {
    statusEl.textContent = "⚠️ " + err.message;
  }
}

// Shown once, the first time results ever render for this browser — points
// at the same affordance the quieter permanent hint below the GOAT table
// already describes, just loud enough that a first-time visitor notices it.
const COACHMARK_SEEN_KEY = "fli:coachmarkSeen";
const coachmarkEl = document.getElementById("coachmark");

function maybeShowCoachmark() {
  if (localStorage.getItem(COACHMARK_SEEN_KEY)) return;
  coachmarkEl.hidden = false;
}

function dismissCoachmark() {
  coachmarkEl.hidden = true;
  localStorage.setItem(COACHMARK_SEEN_KEY, "1");
}

document.getElementById("coachmark-dismiss").addEventListener("click", dismissCoachmark);
document.addEventListener("click", (e) => {
  if (!coachmarkEl.hidden && e.target.closest("[data-card]")) dismissCoachmark();
});

function render(data) {
  document.getElementById("league-info").innerHTML = `
    <h2>${escapeHtml(data.league.name)}</h2>
    <p class="hint">${escapeHtml(t("seasonSummary", data.league.season, data.league.totalSeasons))}</p>
  `;

  const weekRecapSection = document.getElementById("week-recap-section");
  if (data.weekRecap) {
    weekRecapSection.hidden = false;
    document.getElementById("week-recap").innerHTML = weekRecapHtml(data.weekRecap);
  } else {
    weekRecapSection.hidden = true;
  }

  const narrativesSection = document.getElementById("narratives-section");
  if (data.narratives && data.narratives.length) {
    narrativesSection.hidden = false;
    document.getElementById("narratives").innerHTML = narrativeCards(data.narratives);
  } else {
    narrativesSection.hidden = true;
  }

  document.getElementById("current-standings").innerHTML = scrollWrap(standingsTable(data.currentStandings));
  document.getElementById("goat").innerHTML = goatCard(data.goat);
  document.getElementById("h2h").innerHTML = scrollWrap(h2hMatrix(data.h2h, data.goat));
  document.getElementById("historical-standings").innerHTML = data.historicalStandings
    .map((s, i) => ({ s, i }))
    .reverse()
    .map(
      ({ s, i }) => `
      <div class="season-header">
        <h3>${escapeHtml(s.season)}</h3>
        <div class="season-header-actions">
          ${
            data.champions[i]
              ? `<button class="card-trigger-btn" data-card="champion" data-index="${i}" type="button">${t("champion")}</button>`
              : ""
          }
          <button class="card-trigger-btn" data-card="season" data-index="${i}" type="button">${t("share")}</button>
        </div>
      </div>
      ${scrollWrap(standingsTable(s.standings))}`
    )
    .join("");

  document.getElementById("roster-depth").innerHTML = scrollWrap(rosterDepthTable(data.rosterDepth));
  document.getElementById("draft-picks").innerHTML = scrollWrap(draftPicksTable(data.draftPicks));
  toggleSection("roster-value-section", "roster-value", data.rosterValue, rosterValueTable, true);

  toggleSection("trophy-case-section", "trophy-case", data.trophyCase, trophyCaseHtml);
  toggleSection("bracket-section", "playoff-bracket", data.playoffBracket, playoffBracketHtml);
  toggleSection("power-rankings-section", "power-rankings", data.powerRankings, powerRankingsTable, true);
  toggleSection("season-trend-section", "season-trend", data.seasonTrend, seasonTrendHtml);
  toggleSection("luck-index-section", "luck-index", data.luckIndex, luckIndexHtml);
  allTrades = data.tradeTracker || [];
  renderTradeTracker(null, null);
}

// Last N trades, league-wide by default or scoped to one manager (either
// side of the trade) when "Mi equipo" has a selection. Trades are already
// sorted newest-first by computeTradeTracker, so slicing after filtering
// keeps them in order. filterName is the already-resolved display name for
// the scope hint — myteam.js has it on hand from its own ownerId lookup,
// so this doesn't need to re-derive it.
function filterAndLimitTrades(ownerId) {
  const filtered = ownerId ? allTrades.filter((t) => t.sideA.ownerId === ownerId || t.sideB.ownerId === ownerId) : allTrades;
  return filtered.slice(0, TRADE_TRACKER_LIMIT);
}

function renderTradeTracker(ownerId, filterName) {
  const trades = filterAndLimitTrades(ownerId);
  toggleSection("trade-tracker-section", "trade-tracker", trades, (t) => tradeTrackerHtml(t, ownerId ? filterName : null), false, true);
}
window.renderTradeTracker = renderTradeTracker;

// Shows/hides a section based on whether its data is present, and renders
// into it when shown. `wrapScroll` scrollWraps the table; `allowEmpty`
// shows the section even with an empty (but non-null) array, for sections
// with their own "nothing here" copy.
function toggleSection(sectionId, contentId, dataValue, renderFn, wrapScroll, allowEmpty) {
  const section = document.getElementById(sectionId);
  const hasData = dataValue && (allowEmpty || (Array.isArray(dataValue) ? dataValue.length : true));
  if (!hasData) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const html = renderFn(dataValue);
  document.getElementById(contentId).innerHTML = wrapScroll ? scrollWrap(html) : html;
}

// Results for the most recently played week, plus two callouts (biggest
// blowout, closest game) pulled from the same results list — no separate
// computation, just sorting the same data two different ways.
function weekRecapHtml(wr) {
  const matchupLine = (r) => {
    const aWin = r.teamA.points > r.teamB.points;
    const bWin = r.teamB.points > r.teamA.points;
    return `${escapeHtml(r.teamA.displayName)} ${r.teamA.points.toFixed(1)}${aWin ? " 🏆" : ""} - ${r.teamB.points.toFixed(1)}${bWin ? " 🏆" : ""} ${escapeHtml(r.teamB.displayName)}`;
  };

  const rows = wr.results
    .map((r) => {
      const aWin = r.teamA.points > r.teamB.points;
      const bWin = r.teamB.points > r.teamA.points;
      return `
    <div class="matchup-row">
      <span class="matchup-team ${aWin ? "won" : ""}" data-owner-id="${escapeHtml(r.teamA.ownerId)}">${escapeHtml(r.teamA.displayName)} <b>${r.teamA.points.toFixed(1)}</b></span>
      <span class="matchup-vs">vs</span>
      <span class="matchup-team ${bWin ? "won" : ""}" data-owner-id="${escapeHtml(r.teamB.ownerId)}"><b>${r.teamB.points.toFixed(1)}</b> ${escapeHtml(r.teamB.displayName)}</span>
    </div>`;
    })
    .join("");

  const benchBlunderRow = wr.benchBlunder
    ? `<div class="week-callout">${t("benchBlunderLabel")} ${escapeHtml(
        t(
          "benchBlunderDetail",
          wr.benchBlunder.displayName,
          wr.benchBlunder.starterName,
          wr.benchBlunder.starterPts,
          wr.benchBlunder.benchedName,
          wr.benchBlunder.benchedPts,
          wr.benchBlunder.regret
        )
      )}</div>`
    : "";

  return `
    <p class="hint">${escapeHtml(t("weekLabel", wr.week, wr.season))}</p>
    <div class="week-callout">${t("blowoutLabel")} ${matchupLine(wr.blowout)} (${wr.blowout.margin.toFixed(1)} ${t("marginSuffix")})</div>
    <div class="week-callout">${t("closestLabel")} ${matchupLine(wr.tightest)} (${wr.tightest.margin.toFixed(1)} ${t("marginSuffix")})</div>
    ${benchBlunderRow}
    <div class="week-results">${rows}</div>
    <button class="card-trigger-btn" data-card="week" type="button">${t("shareRecap")}</button>
  `;
}

const POSITION_COLUMNS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const VALUE_POSITION_COLUMNS = ["QB", "RB", "WR", "TE"]; // FantasyCalc doesn't price K/DEF

// One row per manager, one column per position — bolds the single highest
// count in each column so "who's stacked at RB" is a glance, not a scan.
function rosterDepthTable(rosterDepth) {
  if (!rosterDepth || !rosterDepth.length) return `<p class='hint'>${t("noData")}</p>`;

  const maxByPosition = Object.fromEntries(
    POSITION_COLUMNS.map((pos) => [pos, Math.max(...rosterDepth.map((r) => r.counts[pos] || 0))])
  );

  const rows = rosterDepth
    .map((r) => {
      const cells = POSITION_COLUMNS.map((pos) => {
        const count = r.counts[pos] || 0;
        const isMax = count > 0 && count === maxByPosition[pos];
        return `<td class="${isMax ? "depth-max" : ""}">${count}</td>`;
      }).join("");
      return `<tr data-owner-id="${escapeHtml(r.ownerId)}"><td class="row-label">${escapeHtml(r.displayName)}</td>${cells}<td>${r.total}</td></tr>`;
    })
    .join("");

  const header = `<th></th>${POSITION_COLUMNS.map((p) => `<th>${p}</th>`).join("")}<th>${t("colTotal")}</th>`;
  return `<table class="matrix"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Sorted by total value descending — unlike Roster Depth (count, no natural
// ranking), value is exactly what the user wants to compare across managers.
function rosterValueTable(rosterValue) {
  if (!rosterValue || !rosterValue.length) return `<p class='hint'>${t("noData")}</p>`;

  const maxByPosition = Object.fromEntries(
    VALUE_POSITION_COLUMNS.map((pos) => [pos, Math.max(...rosterValue.map((r) => r.byPosition[pos] || 0))])
  );

  const rows = rosterValue
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((r) => {
      const cells = VALUE_POSITION_COLUMNS.map((pos) => {
        const value = r.byPosition[pos] || 0;
        const isMax = value > 0 && value === maxByPosition[pos];
        return `<td class="${isMax ? "depth-max" : ""}">${value.toLocaleString()}</td>`;
      }).join("");
      return `<tr data-owner-id="${escapeHtml(r.ownerId)}"><td class="row-label">${escapeHtml(r.displayName)}</td>${cells}<td>${r.total.toLocaleString()}</td></tr>`;
    })
    .join("");

  const header = `<th></th>${VALUE_POSITION_COLUMNS.map((p) => `<th>${p}</th>`).join("")}<th>${t("colTotal")}</th>`;
  return `<table class="matrix"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function draftPicksTable(draftPicks) {
  if (!draftPicks || !draftPicks.length) return `<p class='hint'>${t("noData")}</p>`;
  const rows = draftPicks
    .map((d) => {
      const detail = [
        ...d.gained.map((p) => `+${escapeHtml(p.season)} R${p.round}`),
        ...d.lost.map((p) => `−${escapeHtml(p.season)} R${p.round}`),
      ].join(", ");
      return `
    <tr data-owner-id="${escapeHtml(d.ownerId)}">
      <td>${escapeHtml(d.displayName)}</td>
      <td class="${d.netPicks > 0 ? "depth-max" : ""}">${d.netPicks > 0 ? "+" : ""}${d.netPicks}</td>
      <td class="hint">${detail || t("noMoves")}</td>
    </tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${t("colManagerHeader")}</th><th>${t("colNetPicks")}</th><th>${t("colDetail")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// One square card per resolved season — same shell as everything else,
// four small trophies per season instead of a table row.
function trophyCaseHtml(trophyCase) {
  const slot = (label, entry, extra) =>
    entry
      ? `<div class="trophy-slot"><div class="trophy-label">${label}</div><div class="trophy-name">${escapeHtml(entry.displayName)}</div><div class="trophy-extra hint">${extra}</div></div>`
      : "";

  return `<div class="narrative-grid">${trophyCase
    .map((season) => {
      const record = (s) => `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`;
      return `
    <div class="narrative-card trophy-card">
      <div class="narrative-title">${escapeHtml(season.season)}</div>
      ${slot(t("trophyChampion"), season.champion, record(season.champion))}
      ${slot(t("trophyRunnerUp"), season.runnerUp, season.runnerUp ? record(season.runnerUp) : "")}
      ${slot(t("trophyMostPoints"), season.mostPoints, season.mostPoints.pointsFor.toFixed(1))}
      ${slot(t("trophyWoodenSpoon"), season.woodenSpoon, record(season.woodenSpoon))}
    </div>`;
    })
    .join("")}</div>`;
}

// Text-and-line bracket: one column per round, matches stacked vertically.
// Winner gets the accent tint, same pattern as a won matchup-row.
function playoffBracketHtml(bracket) {
  const rounds = new Map();
  for (const m of bracket) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round).push(m);
  }

  const teamLine = (name, isWinner) =>
    `<div class="bracket-team ${isWinner ? "won" : ""}">${name ? escapeHtml(name) : t("bracketTbd")}</div>`;

  const columns = [...rounds.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([round, matches]) => `
    <div class="bracket-round">
      <div class="bracket-round-label hint">${escapeHtml(t("bracketRound", round))}</div>
      ${matches
        .map(
          (m) => `
        <div class="bracket-match">
          ${teamLine(m.team1, m.winner && m.team1 === m.winner)}
          ${teamLine(m.team2, m.winner && m.team2 === m.winner)}
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  return `<div class="bracket">${columns}</div>`;
}

function powerRankingsTable(rankings) {
  const rows = rankings
    .map((r) => {
      let movementHtml = `<span class="power-flat">—</span>`;
      if (r.movement > 0) movementHtml = `<span class="power-up">▲ ${r.movement}</span>`;
      else if (r.movement < 0) movementHtml = `<span class="power-down">▼ ${Math.abs(r.movement)}</span>`;
      return `
    <tr data-owner-id="${escapeHtml(r.ownerId)}">
      <td>${r.rank}</td>
      <td>${escapeHtml(r.displayName)}</td>
      <td>${movementHtml}</td>
    </tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${t("colNum")}</th><th>${t("colManager")}</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// One row per manager, small inline SVG sparkline (no axes/gridlines, per
// the design system) plotting Points For across the played weeks.
function seasonTrendHtml(seasonTrend) {
  const rows = seasonTrend
    .map((t2) => `
    <div class="trend-row" data-owner-id="${escapeHtml(t2.ownerId)}">
      <div class="trend-name">${escapeHtml(t2.displayName)}</div>
      ${sparklineSvg(t2.weeks.map((w) => w.points))}
    </div>`)
    .join("");
  return `<div class="trend-list">${rows}</div>`;
}

function sparklineSvg(values) {
  if (values.length < 2) return "";
  const w = 160;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
}

// Highlights only — most unlucky and luckiest team, same narrative-card
// shell as the server-side narratives (this is a data story, not a table).
function luckIndexHtml(luckIndex) {
  const mostUnlucky = luckIndex[0];
  const luckiest = luckIndex[luckIndex.length - 1];
  const card = (title, row) => `
    <div class="narrative-card">
      <div class="narrative-title">${title}</div>
      <div class="narrative-headline">${escapeHtml(row.displayName)}</div>
      <div class="narrative-detail">${escapeHtml(t("luckIndexDetail", row.displayName, `${row.actualWins}-${row.actualLosses}`, row.expectedWins))}</div>
    </div>`;
  return `<div class="narrative-grid">${card(t("luckIndexMostUnlucky"), mostUnlucky)}${luckiest !== mostUnlucky ? card(t("luckIndexMostLucky"), luckiest) : ""}</div>`;
}

function tradeTrackerHtml(trades, filterName) {
  const scopeHint = `<p class="hint trade-tracker-scope">${filterName ? t("tradeTrackerScopeTeam", filterName) : t("tradeTrackerScopeLeague")}</p>`;
  if (!trades.length) return scopeHint + `<p class="hint">${t("tradeTrackerEmpty")}</p>`;
  return scopeHint + trades
    .map(
      (trade) => `
    <div class="trade-row">
      <div class="trade-meta hint">${escapeHtml(trade.season)} · ${escapeHtml(t("weekShort", trade.week))}</div>
      <div class="trade-sides">
        <div class="trade-side"><b>${escapeHtml(trade.sideA.displayName)}</b> ${t("tradeTrackerReceived")} ${escapeHtml(trade.sideA.players)}</div>
        <div class="trade-vs">⇄</div>
        <div class="trade-side"><b>${escapeHtml(trade.sideB.displayName)}</b> ${t("tradeTrackerReceived")} ${escapeHtml(trade.sideB.players)}</div>
      </div>
      <div class="trade-ai">
        <button
          class="ai-analyze-btn"
          type="button"
          data-season="${escapeHtml(trade.season)}"
          data-week="${trade.week}"
          data-side-a-name="${escapeHtml(trade.sideA.displayName)}"
          data-side-a-players="${escapeHtml(trade.sideA.players)}"
          data-side-a-value="${trade.sideA.value}"
          data-side-b-name="${escapeHtml(trade.sideB.displayName)}"
          data-side-b-players="${escapeHtml(trade.sideB.players)}"
          data-side-b-value="${trade.sideB.value}"
        >${t("aiAnalyzeBtn")}</button>
        <div class="ai-result" hidden></div>
      </div>
    </div>`
    )
    .join("");
}

// Delegated (not per-button) since trade rows are re-rendered wholesale on
// every language switch / league reload — a listener bound to a specific
// button node would be orphaned the next time tradeTrackerHtml() runs.
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ai-analyze-btn");
  if (!btn) return;

  const resultEl = btn.nextElementSibling;
  btn.disabled = true;
  btn.textContent = t("aiAnalyzing");
  resultEl.hidden = false;
  resultEl.textContent = t("aiAnalyzing");

  const payload = {
    season: btn.dataset.season,
    week: Number(btn.dataset.week),
    lang: getLang(),
    sideA: {
      displayName: btn.dataset.sideAName,
      players: btn.dataset.sideAPlayers,
      value: Number(btn.dataset.sideAValue),
    },
    sideB: {
      displayName: btn.dataset.sideBName,
      players: btn.dataset.sideBPlayers,
      value: Number(btn.dataset.sideBValue),
    },
  };

  try {
    const res = await fetch("/api/trade-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("aiError"));
    resultEl.textContent = data.analysis;
    btn.remove();
  } catch (err) {
    resultEl.textContent = err.message || t("aiError");
    btn.disabled = false;
    btn.textContent = t("aiAnalyzeBtn");
  }
});

// Every table on a phone-width screen can still overflow (long names, many
// columns) — scope the horizontal scroll to the table itself instead of
// letting it blow out the whole page layout.
function scrollWrap(tableHtml) {
  return `<div class="table-scroll">${tableHtml}</div>`;
}

function standingsTable(standings) {
  if (!standings.length) return `<p class='hint'>${t("noData")}</p>`;
  const rows = standings
    .map(
      (s, i) => `
    <tr data-owner-id="${escapeHtml(s.ownerId)}">
      <td>${i + 1}</td>
      <td>${escapeHtml(s.displayName)}</td>
      <td>${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}</td>
      <td>${s.pointsFor.toFixed(1)}</td>
      <td>${s.pointsAgainst.toFixed(1)}</td>
    </tr>`
    )
    .join("");
  return `<table><thead><tr><th>${t("colNum")}</th><th>${t("colManager")}</th><th>${t("colRecord")}</th><th>${t("colPF")}</th><th>${t("colPA")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Story cards, not a table — these are meant to be read, not scanned.
function narrativeCards(narratives) {
  return `<div class="narrative-grid">${narratives
    .map(
      (n, i) => `
    <div class="narrative-card">
      <div class="narrative-icon">${n.icon}</div>
      <div class="narrative-title">${escapeHtml(n.title)}</div>
      <div class="narrative-headline">${escapeHtml(n.headline)}</div>
      <div class="narrative-detail">${escapeHtml(n.detail)}</div>
      <button class="card-trigger-btn" data-card="narrative" data-index="${i}" type="button">${t("share")}</button>
    </div>`
    )
    .join("")}</div>`;
}

// The GOAT is the headline stat of the whole app — gets a hero card instead
// of blending into another plain table row.
function goatCard(goat) {
  if (!goat.length) return `<p class='hint'>${t("noData")}</p>`;
  const [champion, ...rest] = goat;
  const ringLine = champion.championships > 0 ? "🏆".repeat(champion.championships) : t("noRingsYet");

  const restRows = rest
    .map(
      (g, i) => `
    <tr class="card-trigger-row" data-card="goat" data-index="${i + 1}" data-owner-id="${escapeHtml(g.ownerId)}" title="${escapeHtml(t("shareGoatRanking", g.displayName))}">
      <td>${i + 2}</td>
      <td>${escapeHtml(g.displayName)}</td>
      <td>${g.championships > 0 ? "🏆".repeat(g.championships) : "—"}</td>
      <td>${g.wins}-${g.losses}${g.ties ? `-${g.ties}` : ""}</td>
      <td>${(g.winPct * 100).toFixed(1)}%</td>
      <td>${g.seasons}</td>
    </tr>`
    )
    .join("");

  return `
    <div class="goat-hero card-trigger-row" data-card="goat" data-index="0" data-owner-id="${escapeHtml(champion.ownerId)}" title="${escapeHtml(t("shareGoat"))}">
      <div class="goat-hero-emoji">🐐</div>
      <div>
        <div class="goat-hero-name">${escapeHtml(champion.displayName)}</div>
        <div class="goat-hero-rings">${ringLine}</div>
        <div class="goat-hero-stats">${champion.wins}-${champion.losses}${champion.ties ? `-${champion.ties}` : ""} · ${(champion.winPct * 100).toFixed(1)}% · ${champion.seasons} ${t("colSeasons").toLowerCase()}</div>
      </div>
    </div>
    <p class="hint card-hint-tap">${t("tapRowHint")}</p>
    ${rest.length ? scrollWrap(`<table><thead><tr><th>${t("colNum")}</th><th>${t("colManager")}</th><th>${t("colChampionships")}</th><th>${t("colHistoricalRecord")}</th><th>${t("colWinPct")}</th><th>${t("colSeasons")}</th></tr></thead><tbody>${restRows}</tbody></table>`) : ""}
  `;
}

// N x N grid (row manager's record vs column manager), the standard shape
// for head-to-head data — far more scannable than a flat list of pairs.
function h2hMatrix(h2h, goat) {
  if (!h2h.length || !goat.length) return `<p class='hint'>${t("noData")}</p>`;

  const managers = goat.map((g) => ({ ownerId: g.ownerId, displayName: g.displayName }));
  const lookup = new Map(); // "idA::idB" -> record from idA's perspective
  for (const r of h2h) {
    lookup.set(`${r.managerA.ownerId}::${r.managerB.ownerId}`, `${r.aWins}-${r.bWins}${r.ties ? `-${r.ties}` : ""}`);
    lookup.set(`${r.managerB.ownerId}::${r.managerA.ownerId}`, `${r.bWins}-${r.aWins}${r.ties ? `-${r.ties}` : ""}`);
  }

  const abbrevById = uniqueAbbreviations(managers);
  const header = `<th></th>${managers.map((m) => `<th data-owner-id="${escapeHtml(m.ownerId)}" title="${escapeHtml(m.displayName)}">${escapeHtml(abbrevById.get(m.ownerId))}</th>`).join("")}`;
  const rows = managers
    .map((rowMgr) => {
      const cells = managers
        .map((colMgr) => {
          if (rowMgr.ownerId === colMgr.ownerId) return `<td class="diag">—</td>`;
          const record = lookup.get(`${rowMgr.ownerId}::${colMgr.ownerId}`);
          if (!record) return `<td>—</td>`;
          return `<td class="card-trigger-cell" data-card="h2h" data-a-name="${escapeHtml(rowMgr.displayName)}" data-b-name="${escapeHtml(colMgr.displayName)}" data-record="${escapeHtml(record)}" title="${escapeHtml(t("shareH2H"))}">${record}</td>`;
        })
        .join("");
      return `<tr data-owner-id="${escapeHtml(rowMgr.ownerId)}"><th class="row-label">${escapeHtml(rowMgr.displayName)}</th>${cells}</tr>`;
    })
    .join("");

  return `<table class="matrix"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Shortest per-manager prefix (min 3 chars) that stays unique across the
// whole list — plain .slice(0, 3) collides on real rosters (e.g. "alexcuate"
// and "alexortizotero" both start with "ale").
function uniqueAbbreviations(managers) {
  const result = new Map();
  for (const m of managers) {
    const name = m.displayName || "?";
    let len = 3;
    while (len < name.length) {
      const candidate = name.slice(0, len);
      const collides = managers.some(
        (other) => other.ownerId !== m.ownerId && (other.displayName || "?").slice(0, len) === candidate
      );
      if (!collides) break;
      len += 1;
    }
    result.set(m.ownerId, name.slice(0, len));
  }
  return result;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
