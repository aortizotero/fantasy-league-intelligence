// Roast My Team — pick any manager and get an AI grade + roast of their
// CURRENT roster, plus concrete suggestions. Backlog item, own script for
// the same reason as tradeAnalyzer.js (isolated top-level names — no ES
// module scope here, see the currentData/currentLeagueId note in
// CLAUDE.md). Reuses data.rosterPlayerPool (per-player dynasty value +
// season PPG) and data.rosterDepth/data.draftPicks — all already loaded by
// app.js's single /api/league/:id call, so picking a team costs zero extra
// network calls. Only the "Roast" click hits the server (POST
// /api/roast-team), since that's the one part that calls Claude.

const roastSelect = document.getElementById("roast-select");
const roastBtn = document.getElementById("roast-btn");
const roastResultEl = document.getElementById("roast-result");

let roastData = null;

window.initRoast = function initRoast(data) {
  roastData = data;
  const section = document.getElementById("roast-section");

  if (!data.rosterPlayerPool || !data.rosterPlayerPool.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const placeholder = `<option value="">${escapeHtml(t("roastPlaceholder"))}</option>`;
  const options = data.rosterPlayerPool
    .map((team) => `<option value="${escapeHtml(team.ownerId)}">${escapeHtml(team.displayName)}</option>`)
    .join("");
  roastSelect.innerHTML = placeholder + options;
  roastBtn.disabled = true;
  hideRoastResult();
};

roastSelect.addEventListener("change", () => {
  roastBtn.disabled = !roastSelect.value;
  hideRoastResult();
});

function hideRoastResult() {
  roastResultEl.hidden = true;
  roastResultEl.innerHTML = "";
}

const ROAST_TOP_PLAYERS_PER_OTHER_TEAM = 8; // enough real ammo for a concrete trade suggestion, without ballooning the prompt with every other team's full 24-player roster

// Same shape computeRosterPlayerPool/computeRosterDepth/computeDraftPickCapital
// already return per manager — just picked out by ownerId, no recomputation.
function buildRoastPayload(ownerId) {
  const team = roastData.rosterPlayerPool.find((t) => t.ownerId === ownerId);
  if (!team) return null;

  const depthEntry = roastData.rosterDepth?.find((r) => r.ownerId === ownerId);
  const pickEntry = roastData.draftPicks?.find((d) => d.ownerId === ownerId);

  // Every OTHER manager's top players (already value-sorted by
  // computeRosterPlayerPool) + depth + draft capital — real trade-partner
  // ammo for the AI, so it can name an actual team and an actual player
  // instead of inventing one (see lib/claude.js's buildRoastPrompt).
  const leagueTeams = roastData.rosterPlayerPool
    .filter((t) => t.ownerId !== ownerId)
    .map((t) => {
      const otherDepth = roastData.rosterDepth?.find((r) => r.ownerId === t.ownerId);
      const otherPicks = roastData.draftPicks?.find((d) => d.ownerId === t.ownerId);
      return {
        displayName: t.displayName,
        topPlayers: t.players.slice(0, ROAST_TOP_PLAYERS_PER_OTHER_TEAM).map((p) => ({ name: p.name, position: p.position, value: p.value, ppg: p.ppg })),
        rosterCounts: otherDepth ? otherDepth.counts : {},
        netPicks: otherPicks ? otherPicks.netPicks : 0,
      };
    });

  return {
    displayName: team.displayName,
    players: team.players.map((p) => ({ name: p.name, position: p.position, value: p.value, ppg: p.ppg })),
    rosterCounts: depthEntry ? depthEntry.counts : {},
    netPicks: pickEntry ? pickEntry.netPicks : 0,
    gained: pickEntry ? pickEntry.gained : [],
    lost: pickEntry ? pickEntry.lost : [],
    leagueTeams,
  };
}

roastBtn.addEventListener("click", async () => {
  const payload = buildRoastPayload(roastSelect.value);
  if (!payload) return;

  const originalLabel = roastBtn.textContent;
  roastBtn.disabled = true;
  roastBtn.textContent = t("roastGenerating");
  roastResultEl.hidden = false;
  roastResultEl.textContent = t("roastGenerating");

  try {
    const res = await fetch("/api/roast-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, lang: getLang() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("aiError"));

    const suggestions = data.suggestions?.length
      ? `<p class="roast-suggestions-title">${escapeHtml(t("roastSuggestionsTitle"))}</p><ul>${data.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "";
    // Shareable card — same "data rides on the trigger button" pattern as
    // the "Mi equipo" rivalry cards (cards.js's "personal" case): the roast
    // is an on-demand AI result, not part of currentData, so it's carried
    // as dataset attributes instead of an index lookup.
    const shareBtnHtml = `<button class="card-trigger-btn card-share-btn" type="button" data-card="roast" data-display-name="${escapeHtml(payload.displayName)}" data-grade="${escapeHtml(data.grade)}" data-roast="${escapeHtml(data.roast)}" data-suggestions="${escapeHtml((data.suggestions || []).join(" ||| "))}">${escapeHtml(t("roastShareBtn"))}</button>`;
    roastResultEl.innerHTML = `<span class="grade-badge grade-${escapeHtml(data.grade)}">${escapeHtml(t("roastGradeLabel", data.grade))}</span><p>${escapeHtml(data.roast)}</p>${suggestions}${shareBtnHtml}`;
  } catch (err) {
    roastResultEl.textContent = err.message || t("aiError");
  } finally {
    roastBtn.textContent = originalLabel;
    roastBtn.disabled = false;
  }
});
