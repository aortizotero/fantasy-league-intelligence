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

    aboutTitle: "What Story of My League tracks",
    aboutIntro: "Paste your Sleeper League ID above and get a full history of your fantasy football league — no setup, no account, nothing to connect. It's free and works with any Sleeper league.",
    aboutFeature1: "Historical standings and head-to-head records across every season",
    aboutFeature2: "A championships-weighted GOAT ranking — not just win/loss",
    aboutFeature3: "Automatically generated storylines: your league's most lopsided rivalry, best draft steal, worst bench call, and biggest trade blowout",
    aboutFeature4: "A Luck Index comparing your actual record to an all-play expected record",
    aboutFeature5: "Trophy Case, Playoff Bracket, Power Rankings, and Season Trend for every resolved season",
    aboutFeature6: "Shareable stat cards you can post straight to your league group chat",
    seasonSummary: (season, n) => `Current season: ${season} · ${n} season(s) of history`,

    weekRecapTitle: "📅 Week Recap",
    weekLabel: (week, season) => `Week ${week} — ${season}`,
    weekShort: (week) => `Week ${week}`,
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

    benchBlunderLabel: "🪑 Bench Blunder:",
    benchBlunderDetail: (name, starter, starterPts, benched, benchedPts, regret) =>
      `${name} started ${starter} (${starterPts.toFixed(1)} pts) over ${benched} (${benchedPts.toFixed(1)} pts) — ${regret.toFixed(1)} pts left on the bench.`,

    trophyCaseTitle: "🏆 Trophy Case",
    trophyChampion: "🏆 Champion",
    trophyRunnerUp: "🥈 Runner-up",
    trophyMostPoints: "🎖️ Most Points",
    trophyWoodenSpoon: "💀 Wooden Spoon",

    bracketTitle: "🗂️ Playoff Bracket",
    bracketHint: "Current season only.",
    bracketTbd: "TBD",
    bracketRound: (r) => `Round ${r}`,

    powerRankingsTitle: "📊 Power Rankings",
    powerRankingsHint: "Blends record and points-for — not the same as the standings table. Movement since last week.",

    seasonTrendTitle: "📈 Season Trend",
    seasonTrendHint: "Points For by week, current season.",

    luckIndexTitle: "🍀 Luck Index",
    luckIndexHint: "Expected record vs. actual, based on how you'd have done against every team's score each week — not just your real opponent.",
    luckIndexMostUnlucky: "🍀 Most Unlucky",
    luckIndexMostLucky: "🐰 Luckiest",
    luckIndexDetail: (name, actual, expected) => `${name} — actual record ${actual}, expected ${expected} based on schedule luck.`,

    tradeTrackerTitle: "🔄 Trade Tracker",
    tradeTrackerEmpty: "No trades on record.",
    tradeTrackerReceived: "received",
    tradeTrackerFor: "for",
    aiAnalyzeBtn: "🤖 Analyze with AI",
    aiAnalyzing: "Analyzing…",
    aiError: "Couldn't generate the analysis. Try again.",
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

    aboutTitle: "Qué rastrea Story of My League",
    aboutIntro: "Pega tu League ID de Sleeper arriba y obtén el historial completo de tu liga de fantasy football — sin configuración, sin cuenta, sin nada que conectar. Es gratis y funciona con cualquier liga de Sleeper.",
    aboutFeature1: "Standings históricos y récords head-to-head de todas las temporadas",
    aboutFeature2: "Ranking GOAT ponderado por campeonatos — no solo win/loss",
    aboutFeature3: "Historias generadas automáticamente: la rivalidad más desigual de tu liga, el mejor robo de draft, el peor banquillo, y el trade más lopsided",
    aboutFeature4: "Un Índice de Suerte comparando tu récord real contra un récord esperado all-play",
    aboutFeature5: "Vitrina de Trofeos, Bracket de Playoffs, Power Rankings y Tendencia de Temporada para cada temporada resuelta",
    aboutFeature6: "Stat cards compartibles que puedes mandar directo al chat de tu liga",
    seasonSummary: (season, n) => `Temporada actual: ${season} · ${n} temporada(s) en el historial`,

    weekRecapTitle: "📅 Resumen de la Semana",
    weekLabel: (week, season) => `Semana ${week} — ${season}`,
    weekShort: (week) => `Semana ${week}`,
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

    benchBlunderLabel: "🪑 Peor Banquillo:",
    benchBlunderDetail: (name, starter, starterPts, benched, benchedPts, regret) =>
      `${name} tituló a ${starter} (${starterPts.toFixed(1)} pts) sobre ${benched} (${benchedPts.toFixed(1)} pts) — ${regret.toFixed(1)} pts dejados en la banca.`,

    trophyCaseTitle: "🏆 Vitrina de Trofeos",
    trophyChampion: "🏆 Campeón",
    trophyRunnerUp: "🥈 Subcampeón",
    trophyMostPoints: "🎖️ Más Puntos",
    trophyWoodenSpoon: "💀 Cuchara de Palo",

    bracketTitle: "🗂️ Bracket de Playoffs",
    bracketHint: "Solo temporada actual.",
    bracketTbd: "Por definir",
    bracketRound: (r) => `Ronda ${r}`,

    powerRankingsTitle: "📊 Power Rankings",
    powerRankingsHint: "Combina récord y puntos anotados — no es lo mismo que la tabla de standings. Movimiento desde la semana pasada.",

    seasonTrendTitle: "📈 Tendencia de Temporada",
    seasonTrendHint: "Puntos anotados por semana, temporada actual.",

    luckIndexTitle: "🍀 Índice de Suerte",
    luckIndexHint: "Récord esperado vs. real, basado en cómo te hubiera ido contra el puntaje de todos los equipos cada semana — no solo tu rival real.",
    luckIndexMostUnlucky: "🍀 El Más Desafortunado",
    luckIndexMostLucky: "🐰 El Más Suertudo",
    luckIndexDetail: (name, actual, expected) => `${name} — récord real ${actual}, esperado ${expected} según la suerte del calendario.`,

    tradeTrackerTitle: "🔄 Historial de Trades",
    tradeTrackerEmpty: "No hay trades registrados.",
    tradeTrackerReceived: "recibió",
    tradeTrackerFor: "a cambio de",
    aiAnalyzeBtn: "🤖 Analizar con IA",
    aiAnalyzing: "Analizando…",
    aiError: "No se pudo generar el análisis. Intenta de nuevo.",
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
