// Shareable stat cards: builds a fixed-size square card for GOAT, H2H,
// season summaries, and narratives, then exports it via html-to-image
// (Download) or the Web Share API (Share — falls back to download on
// desktop browsers that don't support sharing files).

let currentData = null;

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
  const html = buildCardHtml(trigger.dataset);
  if (!html) return;
  openModal(html);
});

closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

function openModal(html) {
  canvas.innerHTML = html;
  hintEl.textContent = "";
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  canvas.innerHTML = "";
}

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
  const node = canvas.querySelector(".stat-card");
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
  const node = canvas.querySelector(".stat-card");
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
