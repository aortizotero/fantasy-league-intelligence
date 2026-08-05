// Shareable stat cards: builds a fixed-size square card for GOAT, H2H,
// season summaries, and narratives, then exports it via html-to-image
// (Descargar) or the Web Share API (Compartir — falls back to download on
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
    default:
      return null;
  }
}

function cardShell(inner) {
  return `<div class="stat-card">${inner}<div class="stat-card-footer">🏈 Fantasy League Intelligence</div></div>`;
}

function goatCardHtml(g, leagueName) {
  const rings = g.championships > 0 ? "🏆".repeat(g.championships) : "Sin anillos todavía";
  return cardShell(`
    <div class="stat-card-eyebrow">🐐 GOAT de ${escapeHtml(leagueName)}</div>
    <div class="stat-card-emoji">🐐</div>
    <div class="stat-card-name">${escapeHtml(g.displayName)}</div>
    <div class="stat-card-rings">${rings}</div>
    <div class="stat-card-stat-row">
      <div class="stat-card-stat"><span class="stat-card-num">${g.wins}-${g.losses}${g.ties ? `-${g.ties}` : ""}</span><span class="stat-card-label">Récord</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${(g.winPct * 100).toFixed(1)}%</span><span class="stat-card-label">Win%</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${g.seasons}</span><span class="stat-card-label">Temporadas</span></div>
    </div>
  `);
}

function championCardHtml(c, season, leagueName) {
  return cardShell(`
    <div class="stat-card-eyebrow">🏆 Campeón ${escapeHtml(season)} — ${escapeHtml(leagueName)}</div>
    <div class="stat-card-emoji">🏆</div>
    <div class="stat-card-name">${escapeHtml(c.displayName)}</div>
    <div class="stat-card-stat-row">
      <div class="stat-card-stat"><span class="stat-card-num">${c.wins}-${c.losses}${c.ties ? `-${c.ties}` : ""}</span><span class="stat-card-label">Récord</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${(c.winPct * 100).toFixed(1)}%</span><span class="stat-card-label">Win%</span></div>
      <div class="stat-card-stat"><span class="stat-card-num">${c.pointsFor.toFixed(0)}</span><span class="stat-card-label">Puntos</span></div>
    </div>
  `);
}

function h2hCardHtml(aName, bName, record, leagueName) {
  return cardShell(`
    <div class="stat-card-eyebrow">⚔️ Head to Head — ${escapeHtml(leagueName)}</div>
    <div class="stat-card-vs">
      <div class="stat-card-vs-name">${escapeHtml(aName)}</div>
      <div class="stat-card-vs-versus">VS</div>
      <div class="stat-card-vs-name">${escapeHtml(bName)}</div>
    </div>
    <div class="stat-card-record">${escapeHtml(record)}</div>
    <div class="stat-card-caption">Récord histórico, de por vida</div>
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
    <div class="stat-card-caption">Standings finales</div>
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
  hintEl.textContent = "Generando imagen...";
  try {
    const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 3 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "fantasy-league-card.png";
    a.click();
    hintEl.textContent = "";
  } catch (err) {
    hintEl.textContent = "⚠️ No se pudo generar la imagen.";
  }
});

shareBtn.addEventListener("click", async () => {
  const node = canvas.querySelector(".stat-card");
  if (!node) return;
  hintEl.textContent = "Generando imagen...";
  try {
    const blob = await htmlToImage.toBlob(node, { pixelRatio: 3 });
    const file = new File([blob], "fantasy-league-card.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Fantasy League Intelligence" });
      hintEl.textContent = "";
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fantasy-league-card.png";
      a.click();
      URL.revokeObjectURL(url);
      hintEl.textContent = "Tu navegador no soporta compartir directo — descargamos la imagen, compártela manualmente.";
    }
  } catch (err) {
    if (err.name !== "AbortError") hintEl.textContent = "⚠️ No se pudo compartir la imagen.";
  }
});
