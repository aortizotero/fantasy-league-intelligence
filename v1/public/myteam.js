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
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
