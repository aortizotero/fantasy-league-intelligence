// Shareable stat cards: builds a fixed-size square card for GOAT, H2H,
// season summaries, and narratives, then exports it via html-to-image
// (Download) or the Web Share API (Share — falls back to download on
// desktop browsers that don't support sharing files).

let currentData = null;
let modalTrigger = null; // element that opened the modal, so focus can return to it on close

const modal = document.getElementById("card-modal");
const canvas = document.getElementById("card-canvas");
const closeBtn = document.getElementById("card-close");
const downloadBtn = document.getElementById("card-download");
const shareBtn = document.getElementById("card-share");
const hintEl = document.getElementById("card-hint");

// Called by app.js after each successful league fetch so card builders have
// the data to pull from (goat/h2h/narratives/historicalStandings).
window.initCards = function initCards(data) {
  currentData = data;
};

document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-card]");
  if (!trigger || !currentData) return;
  activateTrigger(trigger);
});

// GOAT rows/hero and H2H cells are <tr>/<div>/<td> with role="button" +
// tabindex="0" (not real <button>s), so they need Enter/Space wired up by
// hand. Real <button data-card>s (narrative/season/week/trade-AI) already
// fire a native click on Enter/Space — skip those here or they'd double-fire.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const trigger = e.target.closest("[data-card]");
  if (!trigger || trigger.tagName === "BUTTON" || !currentData) return;
  e.preventDefault(); // Space would otherwise scroll the page
  activateTrigger(trigger);
});

function activateTrigger(trigger) {
  const html = buildCardHtml(trigger.dataset);
  if (!html) return;
  modalTrigger = trigger;
  openModal(html);
}

closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

function openModal(html) {
  canvas.innerHTML = html;
  hintEl.textContent = "";
  modal.hidden = false;
  closeBtn.focus();
}

function closeModal() {
  modal.hidden = true;
  canvas.innerHTML = "";
  if (modalTrigger) {
    modalTrigger.focus();
    modalTrigger = null;
  }
}

// Escape closes the modal; Tab/Shift+Tab wrap within it instead of leaking
// focus into the page behind — this is the only modal in the app, so a
// single document-level listener (gated on modal.hidden) covers it.
document.addEventListener("keydown", (e) => {
  if (modal.hidden) return;
  if (e.key === "Escape") {
    closeModal();
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

function buildCardHtml(ds) {
  const leagueName = currentData.league.name;
  switch (ds.card) {
    case "goat": {
      const g = currentData.goat[Number(ds.index)];
      return g ? goatCardHtml(g, leagueName) : null;
    }
    case "h2h":
      return h2hCardHtml(ds.aName, ds.bName, ds.record, leagueName);
    case "season": {
      const s = currentData.historicalStandings[Number(ds.index)];
      return s ? seasonCardHtml(s, leagueName) : null;
    }
    case "champion": {
      const c = currentData.champions[Number(ds.index)];
      const season = currentData.historicalStandings[Number(ds.index)]?.season;
      return c ? championCardHtml(c, season, leagueName) : null;
    }
    case "narrative": {
      const n = currentData.narratives[Number(ds.index)];
      return n ? narrativeCardHtml(n, leagueName) : null;
    }
    case "personal":
      // "Mi equipo" rivalry cards (Némesis/Víctima) — computed client-side
      // by myteam.js, so the data rides along on the trigger button itself
      // instead of an index into currentData.
      return narrativeCardHtml({ icon: ds.icon, title: ds.title, headline: ds.headline, detail: ds.detail }, leagueName);
    case "week":
      return currentData.weekRecap ? weekCardHtml(currentData.weekRecap, leagueName) : null;
    // The three AI-analysis cards below all follow the same "data rides on
    // the trigger button" pattern as "personal" above — each is an on-demand
    // AI result (roast.js / the trade-analysis and trade-simulate click
    // handlers in app.js/tradeAnalyzer.js), not part of the league payload,
    // so there's no currentData index to look up.
    case "roast": {
      const suggestions = (ds.suggestions || "").split(" ||| ").filter(Boolean);
      return roastCardHtml(ds.displayName, ds.grade, ds.summary, suggestions, leagueName);
    }
    case "tradeVerdict":
      return tradeVerdictCardHtml(ds, leagueName);
    case "tradeAnalyzer":
      return tradeAnalyzerCardHtml(ds, leagueName);
    default:
      return null;
  }
}

function cardShell(inner) {
  return `<div class="stat-card">${inner}<div class="stat-card-footer">🏈 www.storyofmyleague.com</div></div>`;
}

function goatCardHtml(g, leagueName) {
  const rings = g.championships > 0 ? "🏆".repeat(g.championships) : t("noRingsYet");
  return cardShell(`
    <div class="stat-card-eyebrow">${escapeHtml(t("cardGoatEyebrow", leagueName))}</div>
    <div class="stat-card-emoji">🐐</div>
    <div class="stat-card-name">${escapeHtml(g.displayName)}</div>
    <div class="stat-card-rings">${rings}</div>
    <div class="stat-card-stat-row">
      <div class="stat-card-stat"><span class="stat-card-num">${g.wins}-${g.losses}${g.ties ? `-${g.ties}` : ""}</span><span class="stat-card-label">${t("cardRecord")}</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${(g.winPct * 100).toFixed(1)}%</span><span class="stat-card-label">${t("cardWinPct")}</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${g.seasons}</span><span class="stat-card-label">${t("cardSeasons")}</span></div>
    </div>
  `);
}

function championCardHtml(c, season, leagueName) {
  return cardShell(`
    <div class="stat-card-eyebrow">${escapeHtml(t("cardChampionEyebrow", season, leagueName))}</div>
    <div class="stat-card-emoji">🏆</div>
    <div class="stat-card-name">${escapeHtml(c.displayName)}</div>
    <div class="stat-card-stat-row">
      <div class="stat-card-stat"><span class="stat-card-num">${c.wins}-${c.losses}${c.ties ? `-${c.ties}` : ""}</span><span class="stat-card-label">${t("cardRecord")}</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${(c.winPct * 100).toFixed(1)}%</span><span class="stat-card-label">${t("cardWinPct")}</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${c.pointsFor.toFixed(0)}</span><span class="stat-card-label">${t("cardPoints")}</span></div>
    </div>
  `);
}

function weekCardHtml(wr, leagueName) {
  const line = (r) => `${escapeHtml(r.teamA.displayName)} ${r.teamA.points.toFixed(1)} - ${r.teamB.points.toFixed(1)} ${escapeHtml(r.teamB.displayName)}`;
  return cardShell(`
    <div class="stat-card-eyebrow">${escapeHtml(t("cardWeekEyebrow", wr.week, leagueName))}</div>
    <div class="stat-card-week-block">
      <div class="stat-card-narrative-title">${t("cardBlowoutTitle")}</div>
      <div class="stat-card-week-score">${line(wr.blowout)}</div>
      <div class="stat-card-caption">${wr.blowout.margin.toFixed(1)} ${t("marginSuffix")}</div>
    </div>
    <div class="stat-card-week-block">
      <div class="stat-card-narrative-title">${t("cardClosestTitle")}</div>
      <div class="stat-card-week-score">${line(wr.tightest)}</div>
      <div class="stat-card-caption">${wr.tightest.margin.toFixed(1)} ${t("marginSuffix")}</div>
    </div>
  `);
}

function h2hCardHtml(aName, bName, record, leagueName) {
  return cardShell(`
    <div class="stat-card-eyebrow">${escapeHtml(t("cardH2HEyebrow", leagueName))}</div>
    <div class="stat-card-vs">
      <div class="stat-card-vs-name">${escapeHtml(aName)}</div>
      <div class="stat-card-vs-versus">VS</div>
      <div class="stat-card-vs-name">${escapeHtml(bName)}</div>
    </div>
    <div class="stat-card-record">${escapeHtml(record)}</div>
    <div class="stat-card-caption">${t("cardAllTimeRecord")}</div>
  `);
}

function seasonCardHtml(seasonEntry, leagueName) {
  const top3 = seasonEntry.standings.slice(0, 3);
  const rows = top3
    .map(
      (s, i) => `
    <div class="stat-card-rank-row">
      <span>${i + 1}. ${escapeHtml(s.displayName)}</span>
      <span>${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}</span>
    </div>`
    )
    .join("");
  return cardShell(`
    <div class="stat-card-eyebrow">📅 ${escapeHtml(leagueName)}</div>
    <div class="stat-card-season">${escapeHtml(seasonEntry.season)}</div>
    <div class="stat-card-caption">${t("cardFinalStandings")}</div>
    <div class="stat-card-ranklist">${rows}</div>
  `);
}

// Shared shell for the three AI-analysis cards (Roast, Trade Verdict, Trade
// Analyzer) — same 9:16 shape/safe-zones/footer as each other, only the
// middle content and the accent-color modifier differ. See style.css's
// .ai-card block for why this is a different shape from cardShell()'s
// square .stat-card (these pack more content than a single stat).
function aiCardShell(bodyHtml, extraClass = "") {
  return `<div class="ai-card ${extraClass}">
    <div class="safe-top"></div>
    <div class="ai-body">${bodyHtml}</div>
    <div class="safe-bottom"><div class="ai-footer">🏈 www.storyofmyleague.com</div></div>
  </div>`;
}

// D/F grade -> red (bad), C -> amber (warn), A/B -> default green (good).
function gradeCardClass(grade) {
  if (grade === "D" || grade === "F") return "ai-card--bad";
  if (grade === "C") return "ai-card--warn";
  return "";
}

// Same 5-key verdict Trade Analyzer already colors inline via .verdict-badge
// — reused here as a 3-tier read (good/fair/bad) for the card's accent.
function verdictCardClass(verdict) {
  if (verdict === "win_for_them" || verdict === "steal_for_them") return "ai-card--bad";
  if (verdict === "fair") return "ai-card--neutral";
  return "";
}

// `summary` is the card-length headline Claude writes alongside the full
// roast (see lib/claude.js's buildRoastPrompt) — not the full roast text.
// CSS line-clamp on .ai-text (style.css) is still there as a safety net for
// the rare case Claude's summary runs long or the JSON parse fell back to
// the full roast (see roast.js).
function roastCardHtml(displayName, grade, summary, suggestions, leagueName) {
  const todoHtml = suggestions.length
    ? `<div class="todo-box">
        <div class="todo-label">${escapeHtml(t("roastSuggestionsTitle"))}</div>
        ${suggestions.slice(0, 2).map((s) => `<div class="todo-item"><span class="todo-item-text">${escapeHtml(s)}</span></div>`).join("")}
      </div>`
    : "";
  return aiCardShell(
    `
    <div class="ai-kicker">${escapeHtml(t("cardRoastEyebrow", leagueName))}</div>
    <div class="ai-card-name">${escapeHtml(displayName)}</div>
    <div class="grade-ring"><div class="grade-letter">${escapeHtml(grade)}</div></div>
    <div class="grade-caption">${escapeHtml(t("roastGradeCaption"))}</div>
    <div class="ai-divider"></div>
    <div class="ai-text">${escapeHtml(summary)}</div>
    ${todoHtml}`,
    gradeCardClass(grade)
  );
}

// "Who Won This Trade?" — sideA is always the higher-value side (collectTrades
// labels it winner/loser server-side), so it always gets the crown + accent
// color, no client-side comparison needed.
function tradeVerdictCardHtml(ds, leagueName) {
  return aiCardShell(`
    <div class="ai-kicker">${escapeHtml(t("cardTradeVerdictEyebrow", leagueName))}</div>
    <div class="vs-row">
      <div class="vs-side winner">
        <div class="vs-crown">👑</div>
        <div class="vs-name">${escapeHtml(ds.aName)}</div>
        <div class="vs-players">${escapeHtml(ds.aPlayers)}</div>
        <div class="vs-value">${Number(ds.aValue).toFixed(1)} pts</div>
      </div>
      <div class="vs-mid">⇄</div>
      <div class="vs-side">
        <div class="vs-crown">&nbsp;</div>
        <div class="vs-name">${escapeHtml(ds.bName)}</div>
        <div class="vs-players">${escapeHtml(ds.bPlayers)}</div>
        <div class="vs-value">${Number(ds.bValue).toFixed(1)} pts</div>
      </div>
    </div>
    <div class="ai-divider"></div>
    <div class="ai-text">${escapeHtml(ds.summary)}</div>`);
}

// Trade Analyzer — hypothetical, not-yet-made trade, so the "Hypothetical"
// tag is non-negotiable: this card leaves the app the same way any other
// share does (WhatsApp/Instagram), and without it a screenshot could read as
// a real completed trade.
function tradeAnalyzerCardHtml(ds, leagueName) {
  return aiCardShell(
    `
    <div class="ai-kicker">${escapeHtml(t("cardTradeAnalyzerEyebrow", leagueName))}</div>
    <div class="ai-hypo-tag">${escapeHtml(t("cardHypotheticalTag"))}</div>
    <div class="vs-row">
      <div class="vs-side">
        <div class="vs-name">${escapeHtml(t("tradeAnalyzerYouOffer"))}</div>
        <div class="vs-players">${escapeHtml(ds.offerPlayers)}</div>
      </div>
      <div class="vs-mid">⇄</div>
      <div class="vs-side">
        <div class="vs-name">${escapeHtml(t("tradeAnalyzerYouRequest"))}</div>
        <div class="vs-players">${escapeHtml(ds.requestPlayers)}</div>
      </div>
    </div>
    <div class="verdict-pill">${escapeHtml(t(ds.verdict))}</div>
    <div class="ai-divider"></div>
    <div class="ai-text">${escapeHtml(ds.summary)}</div>`,
    verdictCardClass(ds.verdict)
  );
}

function narrativeCardHtml(n, leagueName) {
  return cardShell(`
    <div class="stat-card-eyebrow">${escapeHtml(leagueName)}</div>
    <div class="stat-card-emoji">${n.icon}</div>
    <div class="stat-card-narrative-title">${escapeHtml(n.title)}</div>
    <div class="stat-card-narrative-headline">${escapeHtml(n.headline)}</div>
    <div class="stat-card-narrative-detail">${escapeHtml(n.detail)}</div>
  `);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

downloadBtn.addEventListener("click", async () => {
  const node = canvas.querySelector(".stat-card, .ai-card");
  if (!node) return;
  hintEl.textContent = t("generatingImage");
  try {
    const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 3 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "fantasy-league-card.png";
    a.click();
    hintEl.textContent = "";
  } catch (err) {
    hintEl.textContent = t("imageError");
  }
});

shareBtn.addEventListener("click", async () => {
  const node = canvas.querySelector(".stat-card, .ai-card");
  if (!node) return;
  hintEl.textContent = t("generatingImage");
  try {
    const blob = await htmlToImage.toBlob(node, { pixelRatio: 3 });
    const file = new File([blob], "fantasy-league-card.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "www.storyofmyleague.com" });
      hintEl.textContent = "";
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fantasy-league-card.png";
      a.click();
      URL.revokeObjectURL(url);
      hintEl.textContent = t("shareUnsupported");
    }
  } catch (err) {
    if (err.name !== "AbortError") hintEl.textContent = t("shareError");
  }
});
