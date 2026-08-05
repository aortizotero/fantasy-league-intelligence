const form = document.getElementById("league-form");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");

let activeLeagueId = null;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const leagueId = document.getElementById("league-id").value.trim();
  if (!leagueId) return;
  activeLeagueId = leagueId;
  loadLeague(leagueId);
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
  } catch (err) {
    statusEl.textContent = "⚠️ " + err.message;
  }
}

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

  return `
    <p class="hint">${escapeHtml(t("weekLabel", wr.week, wr.season))}</p>
    <div class="week-callout">${t("blowoutLabel")} ${matchupLine(wr.blowout)} (${wr.blowout.margin.toFixed(1)} ${t("marginSuffix")})</div>
    <div class="week-callout">${t("closestLabel")} ${matchupLine(wr.tightest)} (${wr.tightest.margin.toFixed(1)} ${t("marginSuffix")})</div>
    <div class="week-results">${rows}</div>
    <button class="card-trigger-btn" data-card="week" type="button">${t("shareRecap")}</button>
  `;
}

const POSITION_COLUMNS = ["QB", "RB", "WR", "TE", "K", "DEF"];

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
