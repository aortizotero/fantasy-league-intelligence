// "Mi equipo" — lets a viewer pick which manager they are, then highlights
// their rows across every table already on the page (standings, GOAT, H2H)
// and flags narratives that mention them by name. Pure client-side: the
// data is already fully loaded, this is just conditional styling over it —
// no new API calls, no backend changes.

const select = document.getElementById("my-team-select");
let myTeamData = null;
let currentLeagueId = null;

function storageKey(leagueId) {
  return `fli:selectedOwnerId:${leagueId}`;
}

window.initMyTeam = function initMyTeam(data, leagueId) {
  myTeamData = data;
  currentLeagueId = leagueId;

  const options = data.goat
    .map((g) => `<option value="${escapeHtml(g.ownerId)}">${escapeHtml(g.displayName)}</option>`)
    .join("");
  select.innerHTML = `<option value="">— Selecciona tu equipo —</option>${options}`;

  const saved = localStorage.getItem(storageKey(leagueId)) || "";
  select.value = saved;
  applyHighlight();
};

select.addEventListener("change", () => {
  if (currentLeagueId) localStorage.setItem(storageKey(currentLeagueId), select.value);
  applyHighlight();
});

function applyHighlight() {
  const ownerId = select.value;
  document.querySelectorAll("[data-owner-id]").forEach((el) => {
    el.classList.toggle("is-me", !!ownerId && el.dataset.ownerId === ownerId);
  });

  const myName = ownerId ? myTeamData?.goat.find((g) => g.ownerId === ownerId)?.displayName : null;
  document.querySelectorAll(".narrative-card").forEach((card) => {
    card.classList.toggle("mentions-me", !!myName && card.textContent.includes(myName));
  });

  renderRivalries(ownerId);
}

const MIN_RIVALRY_GAMES = 3; // enough head-to-head games for "nemesis"/"victim" to mean something

// Your worst and best personal matchup, from the h2h data already loaded —
// purely a reshuffle of what's on the page, from the selected manager's
// point of view instead of the league's.
function computeRivalries(ownerId) {
  if (!ownerId || !myTeamData) return null;
  let nemesis = null; // { rival, myWins, theirWins, ties, winPct }
  let victim = null;

  for (const r of myTeamData.h2h) {
    let rival, myWins, theirWins, ties;
    if (r.managerA.ownerId === ownerId) {
      rival = r.managerB; myWins = r.aWins; theirWins = r.bWins; ties = r.ties;
    } else if (r.managerB.ownerId === ownerId) {
      rival = r.managerA; myWins = r.bWins; theirWins = r.aWins; ties = r.ties;
    } else continue;

    const games = myWins + theirWins + ties;
    if (games < MIN_RIVALRY_GAMES) continue;
    const winPct = myWins / games;
    const entry = { rival, myWins, theirWins, ties, winPct };

    if (!nemesis || winPct < nemesis.winPct) nemesis = entry;
    if (!victim || winPct > victim.winPct) victim = entry;
  }

  return { nemesis, victim };
}

function renderRivalries(ownerId) {
  const section = document.getElementById("rivalry-section");
  const container = document.getElementById("rivalry-cards");
  const result = computeRivalries(ownerId);
  const cards = [];

  if (result?.nemesis) {
    const n = result.nemesis;
    cards.push(
      rivalryCardHtml(
        "🧟",
        "Tu Némesis",
        n.rival.displayName,
        `${n.myWins}-${n.theirWins}${n.ties ? `-${n.ties}` : ""} de por vida contra ${n.rival.displayName}. Tu peor matchup histórico.`
      )
    );
  }
  if (result?.victim) {
    const v = result.victim;
    cards.push(
      rivalryCardHtml(
        "😈",
        "Tu Víctima",
        v.rival.displayName,
        `${v.myWins}-${v.theirWins}${v.ties ? `-${v.ties}` : ""} de por vida contra ${v.rival.displayName}. Al que siempre le ganas.`
      )
    );
  }

  if (!cards.length) {
    section.hidden = true;
    container.innerHTML = "";
    return;
  }
  section.hidden = false;
  container.innerHTML = `<div class="narrative-grid">${cards.join("")}</div>`;
}

function rivalryCardHtml(icon, title, headline, detail) {
  return `
    <div class="narrative-card">
      <div class="narrative-icon">${icon}</div>
      <div class="narrative-title">${escapeHtml(title)}</div>
      <div class="narrative-headline">${escapeHtml(headline)}</div>
      <div class="narrative-detail">${escapeHtml(detail)}</div>
      <button class="card-trigger-btn" data-card="personal" data-icon="${escapeHtml(icon)}" data-title="${escapeHtml(title)}" data-headline="${escapeHtml(headline)}" data-detail="${escapeHtml(detail)}" type="button">📤 Compartir</button>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
