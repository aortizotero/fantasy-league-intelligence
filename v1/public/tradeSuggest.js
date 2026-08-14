// Trade Suggester — pick a target team and get an AI recommendation for
// what to offer them (or a "not worth it" verdict), based on their dynasty
// value, their roster needs, and (when available) their record this
// season. Distinct from tradeAnalyzer.js: there the user hand-picks both
// sides of a trade and Claude only grades it; here Claude proposes the
// trade itself starting from just a target manager. Same "everything
// already loaded" posture as roast.js — reuses data.rosterPlayerPool,
// data.rosterDepth, data.currentStandings, all already fetched by app.js's
// single /api/league/:id call, so picking teams costs zero extra network
// calls. Only the "Suggest a Trade" click hits the server (POST
// /api/trade-suggest), since that's the one part that calls Claude.

const tsYourSelect = document.getElementById("trade-suggest-your-select");
const tsTargetSelect = document.getElementById("trade-suggest-target-select");
const tsBtn = document.getElementById("trade-suggest-btn");
const tsResultEl = document.getElementById("trade-suggest-result");

let tsData = null;
let tsPendingYourOwnerId = null; // set via "Mi equipo" before rosterPlayerPool has loaded

window.initTradeSuggest = function initTradeSuggest(data) {
  tsData = data;
  const section = document.getElementById("trade-suggest-section");

  if (!data.rosterPlayerPool || !data.rosterPlayerPool.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const placeholder = `<option value="">${escapeHtml(t("tradeSuggestSelectTeam"))}</option>`;
  const options = data.rosterPlayerPool
    .map((team) => `<option value="${escapeHtml(team.ownerId)}">${escapeHtml(team.displayName)}</option>`)
    .join("");
  tsYourSelect.innerHTML = placeholder + options;
  tsTargetSelect.innerHTML = placeholder + options;

  updateTsButtonState();
  hideTsResult();
  applyPendingYourTeam();
};

// Guarded hook called from myteam.js's applyHighlight() whenever "Mi
// equipo" changes — same pattern as setTradeAnalyzerOfferTeam, defaults
// (but doesn't lock) "your team" to your own roster.
window.setTradeSuggestYourTeam = function setTradeSuggestYourTeam(ownerId) {
  if (!ownerId) return;
  tsPendingYourOwnerId = ownerId;
  if (tsData) applyPendingYourTeam();
};

function applyPendingYourTeam() {
  if (!tsPendingYourOwnerId) return;
  const exists = tsData.rosterPlayerPool.some((t) => t.ownerId === tsPendingYourOwnerId);
  if (!exists) return;
  tsYourSelect.value = tsPendingYourOwnerId;
  updateTsButtonState();
  hideTsResult();
}

tsYourSelect.addEventListener("change", () => {
  updateTsButtonState();
  hideTsResult();
});
tsTargetSelect.addEventListener("change", () => {
  updateTsButtonState();
  hideTsResult();
});

function updateTsButtonState() {
  const your = tsYourSelect.value;
  const target = tsTargetSelect.value;
  tsBtn.disabled = !your || !target || your === target;
}

function hideTsResult() {
  tsResultEl.hidden = true;
  tsResultEl.innerHTML = "";
}

// Same "ghost season" signal already used elsewhere (Week Recap, Season
// Trend, Luck Index, Power Rankings): if nobody in current standings has
// played a game yet, per-player PPG is meaningless (computeSeasonPlayerPpg
// never saw a real week, so every value defaults to 0) and so is a
// win-loss record — both get dropped from the AI prompt entirely instead
// of feeding Claude a wall of "0.0 pts/game, 0-0" that it then narrates as
// if it were real (this was the bug reported for Roast My Team).
function hasSeasonData() {
  return (tsData.currentStandings || []).some((s) => (s.wins || 0) + (s.losses || 0) + (s.ties || 0) > 0);
}

function teamPayload(ownerId) {
  const team = tsData.rosterPlayerPool.find((t) => t.ownerId === ownerId);
  if (!team) return null;
  const depthEntry = tsData.rosterDepth?.find((r) => r.ownerId === ownerId);
  return {
    displayName: team.displayName,
    players: team.players.map((p) => ({ name: p.name, position: p.position, value: p.value, ppg: p.ppg })),
    rosterCounts: depthEntry ? depthEntry.counts : {},
  };
}

function targetRecord(ownerId) {
  const standing = (tsData.currentStandings || []).find((s) => s.ownerId === ownerId);
  if (!standing) return null;
  return { wins: standing.wins, losses: standing.losses, ties: standing.ties, pointsFor: standing.pointsFor };
}

tsBtn.addEventListener("click", async () => {
  const yourTeam = teamPayload(tsYourSelect.value);
  const targetTeamBase = teamPayload(tsTargetSelect.value);
  if (!yourTeam || !targetTeamBase) return;

  const seasonDataAvailable = hasSeasonData();
  const targetTeam = { ...targetTeamBase, record: seasonDataAvailable ? targetRecord(tsTargetSelect.value) : null };

  const originalLabel = tsBtn.textContent;
  tsBtn.disabled = true;
  tsBtn.textContent = t("tradeSuggestGenerating");
  tsResultEl.hidden = false;
  tsResultEl.textContent = t("tradeSuggestGenerating");

  try {
    const res = await fetch("/api/trade-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yourTeam, targetTeam, seasonDataAvailable, lang: getLang() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("aiError"));

    const isPropose = data.recommendation === "propose";
    const badgeHtml = `<span class="recommendation-badge recommendation-${isPropose ? "propose" : "pass"}">${escapeHtml(t(isPropose ? "tradeSuggestPropose" : "tradeSuggestPass"))}</span>`;
    const packageHtml =
      isPropose && data.offerPlayers?.length && data.requestPlayers?.length
        ? `<p class="trade-suggest-package"><b>${escapeHtml(t("tradeAnalyzerYouOffer"))}:</b> ${escapeHtml(data.offerPlayers.join(", "))}<br><b>${escapeHtml(t("tradeAnalyzerYouRequest"))}:</b> ${escapeHtml(data.requestPlayers.join(", "))}</p>`
        : "";
    // Shareable card — same "data rides on the trigger button" pattern as
    // Trade Analyzer's card (cards.js's "tradeSuggest" case): this is an
    // on-demand AI result, not part of currentData. data.summary is the
    // card-length headline Claude writes in the same call (see
    // lib/claude.js's suggestTrade), falls back to the full reasoning
    // (CSS line-clamped) if it's null.
    const offerNames = (data.offerPlayers || []).join(", ");
    const requestNames = (data.requestPlayers || []).join(", ");
    const shareBtnHtml = `<button class="card-trigger-btn card-share-btn" type="button" data-card="tradeSuggest" data-target-name="${escapeHtml(targetTeam.displayName)}" data-recommendation="${escapeHtml(data.recommendation)}" data-offer-players="${escapeHtml(offerNames)}" data-request-players="${escapeHtml(requestNames)}" data-summary="${escapeHtml(data.summary || data.reasoning)}">${escapeHtml(t("share"))}</button>`;
    tsResultEl.innerHTML = `${badgeHtml}${packageHtml}<p>${escapeHtml(data.reasoning)}</p>${shareBtnHtml}`;
  } catch (err) {
    tsResultEl.textContent = err.message || t("aiError");
  } finally {
    tsBtn.textContent = originalLabel;
    updateTsButtonState();
  }
});
