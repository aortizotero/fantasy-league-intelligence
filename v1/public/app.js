const form = document.getElementById("league-form");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const leagueId = document.getElementById("league-id").value.trim();
  if (!leagueId) return;

  results.hidden = true;
  statusEl.textContent = "Cargando...";

  try {
    const res = await fetch(`/api/league/${encodeURIComponent(leagueId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    render(data);
    if (window.initCards) window.initCards(data);
    statusEl.textContent = "";
    results.hidden = false;
  } catch (err) {
    statusEl.textContent = "⚠️ " + err.message;
  }
});

function render(data) {
  document.getElementById("league-info").innerHTML = `
    <h2>${escapeHtml(data.league.name)}</h2>
    <p class="hint">Temporada actual: ${data.league.season} · ${data.league.totalSeasons} temporada(s) en el historial</p>
  `;

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
        <button class="card-trigger-btn" data-card="season" data-index="${i}" type="button">📤 Compartir</button>
      </div>
      ${scrollWrap(standingsTable(s.standings))}`
    )
    .join("");
}

// Every table on a phone-width screen can still overflow (long names, many
// columns) — scope the horizontal scroll to the table itself instead of
// letting it blow out the whole page layout.
function scrollWrap(tableHtml) {
  return `<div class="table-scroll">${tableHtml}</div>`;
}

function standingsTable(standings) {
  if (!standings.length) return "<p class='hint'>Sin datos.</p>";
  const rows = standings
    .map(
      (s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.displayName)}</td>
      <td>${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}</td>
      <td>${s.pointsFor.toFixed(1)}</td>
      <td>${s.pointsAgainst.toFixed(1)}</td>
    </tr>`
    )
    .join("");
  return `<table><thead><tr><th>#</th><th>Manager</th><th>Record</th><th>PF</th><th>PA</th></tr></thead><tbody>${rows}</tbody></table>`;
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
      <button class="card-trigger-btn" data-card="narrative" data-index="${i}" type="button">📤 Compartir</button>
    </div>`
    )
    .join("")}</div>`;
}

// The GOAT is the headline stat of the whole app — gets a hero card instead
// of blending into another plain table row.
function goatCard(goat) {
  if (!goat.length) return "<p class='hint'>Sin datos.</p>";
  const [champion, ...rest] = goat;
  const ringLine = champion.championships > 0 ? "🏆".repeat(champion.championships) : "Sin anillos todavía";

  const restRows = rest
    .map(
      (g, i) => `
    <tr class="card-trigger-row" data-card="goat" data-index="${i + 1}" title="Compartir el ranking de ${escapeHtml(g.displayName)}">
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
    <div class="goat-hero card-trigger-row" data-card="goat" data-index="0" title="Compartir el GOAT de la liga">
      <div class="goat-hero-emoji">🐐</div>
      <div>
        <div class="goat-hero-name">${escapeHtml(champion.displayName)}</div>
        <div class="goat-hero-rings">${ringLine}</div>
        <div class="goat-hero-stats">${champion.wins}-${champion.losses}${champion.ties ? `-${champion.ties}` : ""} · ${(champion.winPct * 100).toFixed(1)}% · ${champion.seasons} temporadas</div>
      </div>
    </div>
    <p class="hint card-hint-tap">📤 Toca una fila para generar su stat card</p>
    ${rest.length ? scrollWrap(`<table><thead><tr><th>#</th><th>Manager</th><th>Campeonatos</th><th>Record histórico</th><th>Win%</th><th>Temporadas</th></tr></thead><tbody>${restRows}</tbody></table>`) : ""}
  `;
}

// N x N grid (row manager's record vs column manager), the standard shape
// for head-to-head data — far more scannable than a flat list of pairs.
function h2hMatrix(h2h, goat) {
  if (!h2h.length || !goat.length) return "<p class='hint'>Sin datos.</p>";

  const managers = goat.map((g) => ({ ownerId: g.ownerId, displayName: g.displayName }));
  const lookup = new Map(); // "idA::idB" -> record from idA's perspective
  for (const r of h2h) {
    lookup.set(`${r.managerA.ownerId}::${r.managerB.ownerId}`, `${r.aWins}-${r.bWins}${r.ties ? `-${r.ties}` : ""}`);
    lookup.set(`${r.managerB.ownerId}::${r.managerA.ownerId}`, `${r.bWins}-${r.aWins}${r.ties ? `-${r.ties}` : ""}`);
  }

  const abbrevById = uniqueAbbreviations(managers);
  const header = `<th></th>${managers.map((m) => `<th title="${escapeHtml(m.displayName)}">${escapeHtml(abbrevById.get(m.ownerId))}</th>`).join("")}`;
  const rows = managers
    .map((rowMgr) => {
      const cells = managers
        .map((colMgr) => {
          if (rowMgr.ownerId === colMgr.ownerId) return `<td class="diag">—</td>`;
          const record = lookup.get(`${rowMgr.ownerId}::${colMgr.ownerId}`);
          if (!record) return `<td>—</td>`;
          return `<td class="card-trigger-cell" data-card="h2h" data-a-name="${escapeHtml(rowMgr.displayName)}" data-b-name="${escapeHtml(colMgr.displayName)}" data-record="${escapeHtml(record)}" title="Compartir este head-to-head">${record}</td>`;
        })
        .join("");
      return `<tr><th class="row-label">${escapeHtml(rowMgr.displayName)}</th>${cells}</tr>`;
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
