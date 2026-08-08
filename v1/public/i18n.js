// Client-side i18n: a plain string dictionary + a couple of helpers, no
// framework. Static markup is translated via `data-i18n` attributes;
// dynamically-built HTML (app.js/cards.js/myteam.js) calls `t(key)` directly
// when constructing each string. English is the default — Spanish is opt-in
// via the toggle, persisted in localStorage.

const STRINGS = {
  en: {
    subtitle: "Standings, head-to-head history, and your league's GOAT — just enter your Sleeper League ID.",
    leagueIdPlaceholder: "Sleeper League ID (e.g. 123456789012345678)",
    analyzeBtn: "Analyze League",
    findLeagueId: "Where do I find my League ID?",
    loading: "Loading...",
    unknownError: "Unknown error",
    invalidLeagueId: "That doesn't look like a Sleeper League ID.",
    coachmarkText: "Tap any row to turn it into a shareable card",
    coachmarkDismiss: "Dismiss",
    seasonSummary: (season, n) => `Current season: ${season} · ${n} season(s) of history`,

    weekRecapTitle: "📅 Week Recap",
    weekLabel: (week, season) => `Week ${week} — ${season}`,
    blowoutLabel: "💥 Blowout of the week:",
    closestLabel: "😰 Closest game:",
    marginSuffix: "pt margin",
    shareRecap: "📤 Share recap",

    myTeamLabel: "🎯 My Team",
    myTeamPlaceholder: "— Select your team —",
    myTeamHint: "Highlights your rows in standings, GOAT, and H2H, and flags the stories that mention you.",

    rivalryTitle: "⚔️ Your Rivalries",
    nemesisTitle: "Your Nemesis",
    victimTitle: "Your Victim",
    nemesisDetail: (record, name) => `${record} all-time vs. ${name}. Your worst historical matchup.`,
    victimDetail: (record, name) => `${record} all-time vs. ${name}. The one you always beat.`,

    narrativesTitle: "📖 The Stories of Your League",
    narrativesHint: "What the numbers don't tell you at a glance.",

    currentStandingsTitle: "Standings — Current Season",
    colNum: "#",
    colManager: "Manager",
    colRecord: "Record",
    colPF: "PF",
    colPA: "PA",
    noData: "No data.",

    goatTitle: "🐐 League GOAT",
    goatHint: "Historical ranking: championships first, win record as tiebreaker.",
    noRingsYet: "No rings yet",
    colChampionships: "Championships",
    colHistoricalRecord: "Historical Record",
    colWinPct: "Win%",
    colSeasons: "Seasons",
    tapRowHint: "📤 Tap a row to generate their stat card",
    shareGoat: "Share the league GOAT",
    shareGoatRanking: (name) => `Share ${name}'s ranking`,

    h2hTitle: "Head-to-Head",
    h2hHint: "Record between every pair of managers, across all seasons.",
    shareH2H: "Share this head-to-head",

    historicalStandingsTitle: "Standings by Season",
    champion: "🏆 Champion",
    share: "📤 Share",

    rosterDepthTitle: "📦 Roster Depth",
    rosterDepthHint: "How many players each team has at each position right now — useful for knowing who to offer a trade if you need help.",
    colTotal: "Total",

    draftPicksTitle: "🎟️ Draft Capital",
    draftPicksHint: "Net picks gained or lost in trades — who has the most ammo for the next draft.",
    colManagerHeader: "Manager",
    colNetPicks: "Net Picks",
    colDetail: "Details",
    noMoves: "No moves",

    modalClose: "Close",
    modalDownload: "⬇️ Download",
    modalShare: "📤 Share",
    generatingImage: "Generating image...",
    imageError: "⚠️ Couldn't generate the image.",
    shareUnsupported: "Your browser doesn't support direct sharing — the image downloaded instead, share it manually.",
    shareError: "⚠️ Couldn't share the image.",

    cardRecord: "Record",
    cardWinPct: "Win%",
    cardSeasons: "Seasons",
    cardPoints: "Points",
    cardAllTimeRecord: "All-time record",
    cardFinalStandings: "Final standings",
    cardGoatEyebrow: (league) => `🐐 ${league} GOAT`,
    cardH2HEyebrow: (league) => `⚔️ Head to Head — ${league}`,
    cardChampionEyebrow: (season, league) => `🏆 ${season} Champion — ${league}`,
    cardWeekEyebrow: (week, league) => `📅 Week ${week} — ${league}`,
    cardBlowoutTitle: "💥 Blowout of the Week",
    cardClosestTitle: "😰 Closest Game",
  },

  es: {
    subtitle: "Standings, historial de enfrentamientos, y el GOAT de tu liga — solo pon tu League ID de Sleeper.",
    leagueIdPlaceholder: "League ID de Sleeper (ej. 123456789012345678)",
    analyzeBtn: "Analizar liga",
    findLeagueId: "¿Dónde encuentro mi League ID?",
    loading: "Cargando...",
    unknownError: "Error desconocido",
    invalidLeagueId: "Eso no parece un League ID de Sleeper.",
    coachmarkText: "Toca cualquier fila para convertirla en una card compartible",
    coachmarkDismiss: "Descartar",
    seasonSummary: (season, n) => `Temporada actual: ${season} · ${n} temporada(s) en el historial`,

    weekRecapTitle: "📅 Resumen de la Semana",
    weekLabel: (week, season) => `Semana ${week} — ${season}`,
    blowoutLabel: "💥 Golpe de la semana:",
    closestLabel: "😰 Partido más cerrado:",
    marginSuffix: "pts de diferencia",
    shareRecap: "📤 Compartir resumen",

    myTeamLabel: "🎯 Mi equipo",
    myTeamPlaceholder: "— Selecciona tu equipo —",
    myTeamHint: "Resalta tus filas en standings, GOAT y H2H, y marca las historias que te involucran.",

    rivalryTitle: "⚔️ Tus Rivalidades",
    nemesisTitle: "Tu Némesis",
    victimTitle: "Tu Víctima",
    nemesisDetail: (record, name) => `${record} de por vida contra ${name}. Tu peor matchup histórico.`,
    victimDetail: (record, name) => `${record} de por vida contra ${name}. Al que siempre le ganas.`,

    narrativesTitle: "📖 Las Historias de tu Liga",
    narrativesHint: "Lo que los números no te dicen a simple vista.",

    currentStandingsTitle: "Standings — Temporada Actual",
    colNum: "#",
    colManager: "Manager",
    colRecord: "Record",
    colPF: "PF",
    colPA: "PA",
    noData: "Sin datos.",

    goatTitle: "🐐 GOAT de la Liga",
    goatHint: "Ranking histórico: campeonatos primero, récord de victorias como desempate.",
    noRingsYet: "Sin anillos todavía",
    colChampionships: "Campeonatos",
    colHistoricalRecord: "Record histórico",
    colWinPct: "Win%",
    colSeasons: "Temporadas",
    tapRowHint: "📤 Toca una fila para generar su stat card",
    shareGoat: "Compartir el GOAT de la liga",
    shareGoatRanking: (name) => `Compartir el ranking de ${name}`,

    h2hTitle: "Head-to-Head",
    h2hHint: "Récord entre cada par de managers, a través de todas las temporadas.",
    shareH2H: "Compartir este head-to-head",

    historicalStandingsTitle: "Standings por Temporada",
    champion: "🏆 Campeón",
    share: "📤 Compartir",

    rosterDepthTitle: "📦 Profundidad de Roster",
    rosterDepthHint: "Cuántos jugadores tiene cada equipo por posición ahorita — útil para saber a quién ofrecerle un trade si te falta algo.",
    colTotal: "Total",

    draftPicksTitle: "🎟️ Capital de Draft",
    draftPicksHint: "Picks netos ganados o perdidos en trades — quién tiene más municiones para el próximo draft.",
    colManagerHeader: "Manager",
    colNetPicks: "Picks Netos",
    colDetail: "Detalle",
    noMoves: "Sin movimientos",

    modalClose: "Cerrar",
    modalDownload: "⬇️ Descargar",
    modalShare: "📤 Compartir",
    generatingImage: "Generando imagen...",
    imageError: "⚠️ No se pudo generar la imagen.",
    shareUnsupported: "Tu navegador no soporta compartir directo — descargamos la imagen, compártela manualmente.",
    shareError: "⚠️ No se pudo compartir la imagen.",

    cardRecord: "Récord",
    cardWinPct: "Win%",
    cardSeasons: "Temporadas",
    cardPoints: "Puntos",
    cardAllTimeRecord: "Récord histórico, de por vida",
    cardFinalStandings: "Standings finales",
    cardGoatEyebrow: (league) => `🐐 GOAT de ${league}`,
    cardH2HEyebrow: (league) => `⚔️ Head to Head — ${league}`,
    cardChampionEyebrow: (season, league) => `🏆 Campeón ${season} — ${league}`,
    cardWeekEyebrow: (week, league) => `📅 Semana ${week} — ${league}`,
    cardBlowoutTitle: "💥 Golpe de la Semana",
    cardClosestTitle: "😰 Partido Más Cerrado",
  },
};

let currentLang = localStorage.getItem("fli:lang") === "es" ? "es" : "en";

window.t = function t(key, ...args) {
  const entry = STRINGS[currentLang]?.[key] ?? STRINGS.en[key];
  return typeof entry === "function" ? entry(...args) : entry ?? key;
};

window.getLang = function getLang() {
  return currentLang;
};

window.setLang = function setLang(lang) {
  currentLang = lang === "es" ? "es" : "en";
  localStorage.setItem("fli:lang", currentLang);
  document.documentElement.lang = currentLang;
  applyStaticTranslations();
  updateToggleButtons();
  if (window.onLangChange) window.onLangChange();
};

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
}

function updateToggleButtons() {
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.langBtn === currentLang);
  });
}

document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.langBtn));
});

document.documentElement.lang = currentLang;
applyStaticTranslations();
updateToggleButtons();
