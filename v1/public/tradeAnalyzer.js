// Trade Analyzer — pick players to offer from your roster and players to
// request from another manager's, and get an AI verdict on who wins the
// hypothetical trade. Unlike Trade Tracker (real trades that already
// happened), this is entirely user-driven and nothing here is a fact about
// the league — so it lives in its own section/script, separate from the
// narrative/history features. Team pickers reuse data.rosterPlayerPool
// (per-player FantasyCalc value + season PPG) and data.rosterDepth (current
// position counts, for roster-need context) — both already loaded by
// app.js's single /api/league/:id call, so selecting players and updating
// the totals strip below costs zero extra network calls. Only the final
// "Analyze" step hits the server (POST /api/trade-simulate), since that's
// the one part that calls Claude.

const taOfferSelect = document.getElementById("ta-offer-select");
const taRequestSelect = document.getElementById("ta-request-select");
const taOfferPlayersEl = document.getElementById("ta-offer-players");
const taRequestPlayersEl = document.getElementById("ta-request-players");
const taTotalsEl = document.getElementById("ta-totals");
const taAnalyzeBtn = document.getElementById("ta-analyze-btn");
const taResultEl = document.getElementById("ta-result");

const TA_POSITION_ORDER = ["QB", "RB", "WR", "TE"];

let taData = null;
let taOfferSelected = new Set();
let taRequestSelected = new Set();
let taPendingOfferOwnerId = null; // set via "Mi equipo" before rosterPlayerPool has loaded

window.initTradeAnalyzer = function initTradeAnalyzer(data) {
  taData = data;
  const section = document.getElementById("trade-analyzer-section");

  if (!data.rosterPlayerPool || !data.rosterPlayerPool.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const placeholder = `<option value="">${escapeHtml(t("tradeAnalyzerSelectTeam"))}</option>`;
  const options = data.rosterPlayerPool
    .map((team) => `<option value="${escapeHtml(team.ownerId)}">${escapeHtml(team.displayName)}</option>`)
    .join("");
  taOfferSelect.innerHTML = placeholder + options;
  taRequestSelect.innerHTML = placeholder + options;

  taOfferSelected = new Set();
  taRequestSelected = new Set();
  renderChecklist("offer");
  renderChecklist("request");
  updateTotals();
  updateButtonState();
  hideResult();

  applyPendingOfferTeam();
};

// Guarded hook called from myteam.js's applyHighlight() whenever "Mi
// equipo" changes — defaults (but doesn't lock) the offer side to your own
// team. May fire before rosterPlayerPool has loaded (initMyTeam runs before
// initTradeAnalyzer in app.js's loadLeague), so it just remembers the
// choice until taData is ready.
window.setTradeAnalyzerOfferTeam = function setTradeAnalyzerOfferTeam(ownerId) {
  if (!ownerId) return;
  taPendingOfferOwnerId = ownerId;
  if (taData) applyPendingOfferTeam();
};

function applyPendingOfferTeam() {
  if (!taPendingOfferOwnerId) return;
  const exists = taData.rosterPlayerPool.some((team) => team.ownerId === taPendingOfferOwnerId);
  if (!exists) return;
  taOfferSelect.value = taPendingOfferOwnerId;
  handleTeamChange("offer");
}

function handleTeamChange(side) {
  if (side === "offer") taOfferSelected = new Set();
  else taRequestSelected = new Set();
  renderChecklist(side);
  updateTotals();
  updateButtonState();
  hideResult();
}

taOfferSelect.addEventListener("change", () => handleTeamChange("offer"));
taRequestSelect.addEventListener("change", () => handleTeamChange("request"));

taOfferPlayersEl.addEventListener("change", (e) => handleChecklistToggle(e, "offer"));
taRequestPlayersEl.addEventListener("change", (e) => handleChecklistToggle(e, "request"));

function handleChecklistToggle(e, side) {
  if (!(e.target instanceof HTMLInputElement) || e.target.type !== "checkbox") return;
  const set = side === "offer" ? taOfferSelected : taRequestSelected;
  if (e.target.checked) set.add(e.target.value);
  else set.delete(e.target.value);
  updateTotals();
  updateButtonState();
  hideResult();
}

function teamForSide(side) {
  const select = side === "offer" ? taOfferSelect : taRequestSelect;
  return taData?.rosterPlayerPool?.find((team) => team.ownerId === select.value) || null;
}

function renderChecklist(side) {
  const container = side === "offer" ? taOfferPlayersEl : taRequestPlayersEl;
  const selectedSet = side === "offer" ? taOfferSelected : taRequestSelected;
  const team = teamForSide(side);

  if (!team) {
    container.innerHTML = `<p class="hint">${escapeHtml(t("tradeAnalyzerPickTeam"))}</p>`;
    return;
  }
  if (!team.players.length) {
    container.innerHTML = `<p class="hint">${escapeHtml(t("tradeAnalyzerNoPlayers"))}</p>`;
    return;
  }

  container.innerHTML = TA_POSITION_ORDER.map((pos) => {
    const players = team.players.filter((p) => p.position === pos);
    if (!players.length) return "";
    const rows = players
      .map(
        (p) => `
        <label class="player-checklist-row">
          <input type="checkbox" value="${escapeHtml(p.playerId)}" ${selectedSet.has(p.playerId) ? "checked" : ""}>
          <span class="player-checklist-name">${escapeHtml(p.name)}</span>
          <span class="player-checklist-meta">${escapeHtml(p.position)} · ${Math.round(p.value)} val · ${p.ppg.toFixed(1)} pts/g</span>
        </label>`
      )
      .join("");
    return `<div class="player-checklist-group"><h4>${escapeHtml(pos)}</h4>${rows}</div>`;
  }).join("");
}

function sideTotals(side) {
  const team = teamForSide(side);
  const selectedSet = side === "offer" ? taOfferSelected : taRequestSelected;
  if (!team) return null;
  const players = team.players.filter((p) => selectedSet.has(p.playerId));
  return {
    count: players.length,
    value: players.reduce((sum, p) => sum + p.value, 0),
    ppg: players.reduce((sum, p) => sum + p.ppg, 0),
  };
}

function updateTotals() {
  const offer = sideTotals("offer");
  const request = sideTotals("request");
  if (!offer?.count && !request?.count) {
    taTotalsEl.hidden = true;
    taTotalsEl.innerHTML = "";
    return;
  }
  taTotalsEl.hidden = false;
  const line = (totals) => t("tradeAnalyzerTotalsLine", totals?.count || 0, Math.round(totals?.value || 0), (totals?.ppg || 0).toFixed(1));
  taTotalsEl.innerHTML = `
    <div class="ta-totals-side"><b>${escapeHtml(t("tradeAnalyzerYouOffer"))}:</b> ${escapeHtml(line(offer))}</div>
    <div class="ta-totals-side"><b>${escapeHtml(t("tradeAnalyzerYouRequest"))}:</b> ${escapeHtml(line(request))}</div>
  `;
}

function updateButtonState() {
  taAnalyzeBtn.disabled = taOfferSelected.size === 0 || taRequestSelected.size === 0;
}

function hideResult() {
  taResultEl.hidden = true;
  taResultEl.innerHTML = "";
}

// Same "ghost season" signal used by roast.js/tradeSuggest.js — see
// roastSeasonDataAvailable() in roast.js for why this matters.
function taSeasonDataAvailable() {
  return (taData.currentStandings || []).some((s) => (s.wins || 0) + (s.losses || 0) + (s.ties || 0) > 0);
}

function buildTeamPayload(side) {
  const team = teamForSide(side);
  const selectedSet = side === "offer" ? taOfferSelected : taRequestSelected;
  if (!team) return null;
  const players = team.players
    .filter((p) => selectedSet.has(p.playerId))
    .map((p) => ({ name: p.name, position: p.position, value: p.value, ppg: p.ppg }));
  if (!players.length) return null;

  const depthEntry = taData.rosterDepth?.find((r) => r.ownerId === team.ownerId);
  return { displayName: team.displayName, players, rosterCounts: depthEntry ? depthEntry.counts : {} };
}

taAnalyzeBtn.addEventListener("click", async () => {
  const offerTeam = buildTeamPayload("offer");
  const requestTeam = buildTeamPayload("request");
  if (!offerTeam || !requestTeam) return;

  const originalLabel = taAnalyzeBtn.textContent;
  taAnalyzeBtn.disabled = true;
  taAnalyzeBtn.textContent = t("aiAnalyzing");
  taResultEl.hidden = false;
  taResultEl.textContent = t("aiAnalyzing");

  try {
    const res = await fetch("/api/trade-simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerTeam, requestTeam, seasonDataAvailable: taSeasonDataAvailable(), lang: getLang() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("aiError"));
    // Shareable card — same "data rides on the trigger button" pattern as
    // the other two AI cards. Player names only (no value/ppg, the card
    // just needs "who's in the deal"), reusing offerTeam/requestTeam
    // already built above for the API payload. data.summary is a
    // card-length headline Claude writes in the same call (see
    // lib/claude.js) — falls back to the full interpretation (CSS
    // line-clamped) if it's null.
    const offerNames = offerTeam.players.map((p) => p.name).join(", ");
    const requestNames = requestTeam.players.map((p) => p.name).join(", ");
    const shareBtnHtml = `<button class="card-trigger-btn card-share-btn" type="button" data-card="tradeAnalyzer" data-offer-players="${escapeHtml(offerNames)}" data-request-players="${escapeHtml(requestNames)}" data-verdict="${escapeHtml(data.verdict)}" data-summary="${escapeHtml(data.summary || data.interpretation)}">${escapeHtml(t("share"))}</button>`;
    taResultEl.innerHTML = `<span class="verdict-badge verdict-${escapeHtml(data.verdict)}">${escapeHtml(t(data.verdict))}</span><p>${escapeHtml(data.interpretation)}</p>${shareBtnHtml}`;
  } catch (err) {
    taResultEl.textContent = err.message || t("aiError");
  } finally {
    taAnalyzeBtn.textContent = originalLabel;
    updateButtonState();
  }
});
