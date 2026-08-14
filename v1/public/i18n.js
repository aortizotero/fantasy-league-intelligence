// Client-side i18n: a plain string dictionary + a couple of helpers, no
// framework. Static markup is translated via `data-i18n` attributes;
// dynamically-built HTML (app.js/cards.js/myteam.js) calls `t(key)` directly
// when constructing each string. English is the default — Spanish is opt-in
// via the toggle, persisted in localStorage.

const STRINGS = {
  en: {
    subtitle: "Standings, head-to-head history, and your league's GOAT — just enter your Sleeper League ID.",
    leagueIdLabel: "Sleeper League ID",
    leagueIdPlaceholder: "Sleeper League ID (e.g. 123456789012345678)",
    analyzeBtn: "Analyze League",
    findLeagueId: "Where do I find my League ID?",
    loading: "Loading...",
    unknownError: "Unknown error",
    invalidLeagueId: "That doesn't look like a Sleeper League ID.",
    coachmarkText: "Tap any row to turn it into a shareable card",
    coachmarkDismiss: "Dismiss",
    scrollHintText: "Scroll down for your league's story ↓",

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

    groupRightNow: "🟢 Right Now",
    groupHistory: "🕰️ League History",
    groupAnalyze: "🔮 Analyze & Plan",

    rivalryTitle: "⚔️ Your Rivalries",
    nemesisTitle: "Your Nemesis",
    victimTitle: "Your Victim",
    nemesisDetail: (record, name) => `${record} all-time vs. ${name}. Your worst historical matchup.`,
    victimDetail: (record, name) => `${record} all-time vs. ${name}. The one you always beat.`,

    narrativesTitle: "📖 The Stories of Your League",
    narrativesHint: "What the numbers don't tell you at a glance.",

    currentStandingsTitle: "Where You Stand",
    currentStandingsHint: "This season so far.",
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
    h2hHint: "Every grudge match on the books, across every season.",
    shareH2H: "Share this head-to-head",

    seasonFilterLabel: "Season",
    seasonFilterAll: "All seasons",

    historicalStandingsTitle: "Standings by Season",
    champion: "🏆 Champion",
    share: "📤 Share",

    rosterDepthTitle: "📦 Roster Depth",
    rosterDepthHint: "How many players each team has at each position right now — useful for knowing who to offer a trade if you need help.",
    rosterValueTitle: "💰 Roster Value",
    rosterValueHint: "Current dynasty trade value per position, from FantasyCalc — who's actually stacked in trade-value terms, not just player count.",
    pointsReportTitle: "📈 Points Report",
    pointsReportHint: "Who beat their projection last week.",
    pointsReportWeek: (season, week) => `Week ${week}, ${season}`,
    pointsReportScopeLabel: "Scope",
    pointsReportScopeStarters: "Starters",
    pointsReportScopeBench: "Starters + Bench",
    pointsReportScopeBackup: "Starter + Primary Backup",
    pointsReportProjected: (n) => `proj. ${n}`,
    colTotal: "Total",

    draftPicksTitle: "🎟️ Draft Capital",
    draftPicksHint: "Net picks gained or lost in trades — who has the most ammo for the next draft.",
    colManagerHeader: "Manager",
    colNetPicks: "Net Picks",
    colDetail: "Details",
    noMoves: "No moves",

    modalClose: "Close",
    modalTitle: "Shareable card",
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
    trophyCaseEmptySeason: "This season hasn't crowned a champion yet.",

    bracketTitle: "🗂️ Playoff Bracket",
    bracketHint: "Who's still alive in the playoff chase — current season only.",
    bracketTbd: "TBD",
    bracketRound: (r) => `Round ${r}`,

    powerRankingsTitle: "📊 Power Rankings",
    powerRankingsHint: "Who's actually good right now, not just who's lucky.",

    seasonTrendTitle: "📈 Season Trend",
    seasonTrendHint: "Points For by week, current season.",

    luckIndexTitle: "🍀 Luck Index",
    luckIndexHint: "Is your record earned, or is your schedule carrying you?",
    luckIndexMostUnlucky: "🍀 Most Unlucky",
    luckIndexMostLucky: "🐰 Luckiest",
    luckIndexDetail: (name, actual, expected) => `${name} — actual record ${actual}, expected ${expected} based on schedule luck.`,

    transactionHistoryTitle: "📋 Transaction History",
    transactionHistoryEmpty: "No transactions on record.",
    tradeTrackerReceived: "received",
    tradeTrackerFor: "for",
    aiAnalyzeBtn: "🤖 Analyze with AI",
    aiAnalyzing: "Analyzing…",
    aiError: "Couldn't generate the analysis. Try again.",
    transactionHistoryScopeLeague: "Last 5 league transactions",
    transactionHistoryScopeTeam: (name) => `${name}'s last 5 transactions`,
    transactionHistoryScopeLeagueAll: (n) => `All ${n} league transaction${n === 1 ? "" : "s"} on record`,
    transactionHistoryScopeTeamAll: (name, n) => `All ${n} transaction${n === 1 ? "" : "s"} for ${name}`,
    transactionHistorySearchLabel: "Look up a manager's transactions",
    transactionHistorySearchPlaceholder: "— All managers —",
    transactionTypeTrade: "Trade",
    transactionTypeWaiver: "Waiver",
    transactionTypeFreeAgent: "Free Agent",
    transactionTypeDraft: "Draft",
    transactionAddedDropped: (added, dropped) => `added ${added}, dropped ${dropped}`,
    transactionAddedOnly: (added) => `added ${added}`,
    transactionDroppedOnly: (dropped) => `dropped ${dropped}`,
    transactionDrafted: (player, round, pick) => `drafted ${player} — Round ${round}, Pick ${pick}`,
    roastTitle: "🔥 Roast My Team",
    roastHint: "Get an AI evaluation of a roster's current strengths, weaknesses, and what to actually do about it.",
    roastSelectLabel: "Pick a team",
    roastPlaceholder: "— Select a team —",
    roastBtn: "🔥 Roast This Team",
    roastGenerating: "Roasting…",
    roastGradeLabel: (grade) => `Grade: ${grade}`,
    roastSuggestionsTitle: "What to do about it",
    roastShareBtn: "📤 Share this roast",
    cardRoastEyebrow: (league) => `🔥 ${league} Roast`,
    roastGradeCaption: "Grade",
    cardTradeVerdictEyebrow: (league) => `🔄 ${league} Trade Verdict`,
    cardTradeAnalyzerEyebrow: (league) => `🧮 ${league} Trade Analyzer`,
    cardHypotheticalTag: "Hypothetical — not a real trade",
    cardTradeSuggestEyebrow: (league) => `🧭 ${league} Trade Suggestion`,
    tradeHistoryAiTitle: "🤔 Who Won This Trade?",
    tradeHistoryAiHint: "Pick any trade from your league's full history and get an AI verdict — not just the last 5.",
    tradeHistoryAiSelectLabel: "Pick a trade",
    tradeHistoryAiPlaceholder: "— Select a trade —",
    tradeHistoryAiOption: (season, week, a, b) => `${season} · Week ${week} — ${a} ⇄ ${b}`,
    tradeAnalyzerTitle: "🧮 Trade Analyzer",
    tradeAnalyzerHint: "Pick players to offer and players to request, then get an AI verdict on who wins the trade.",
    tradeAnalyzerYourTeam: "Your team",
    tradeAnalyzerTheirTeam: "Their team",
    tradeAnalyzerSelectTeam: "— Select a team —",
    tradeAnalyzerPickTeam: "Pick a team to see its roster.",
    tradeAnalyzerNoPlayers: "This roster has no tradeable players.",
    tradeAnalyzerYouOffer: "You offer",
    tradeAnalyzerYouRequest: "You request",
    tradeAnalyzerTotalsLine: (count, value, ppg) => `${count} player${count === 1 ? "" : "s"}, ${value} value, ${ppg} pts/game`,
    tradeAnalyzerBtn: "🤖 Analyze Trade with AI",
    tradeSuggestTitle: "🧭 What Should You Offer Them?",
    tradeSuggestHint: "Pick a team and get an AI-recommended trade to offer them — or find out it's not worth pursuing right now.",
    tradeSuggestTargetTeamLabel: "Target team",
    tradeSuggestSelectTeam: "— Select a team —",
    tradeSuggestBtn: "🧭 Suggest a Trade",
    tradeSuggestGenerating: "Thinking…",
    tradeSuggestPropose: "🧭 Trade worth proposing",
    tradeSuggestPass: "🤷 Not worth it right now",
    steal_for_you: "🔥 Steal for you",
    win_for_you: "✅ You win",
    fair: "⚖️ Fair trade",
    win_for_them: "❌ They win",
    steal_for_them: "💀 Fleeced",

    footerDisclaimer: "Story of My League is an independent fan project. Not affiliated with, endorsed by, or sponsored by the NFL, Sleeper, ESPN, or FantasyCalc. All team and player names are the property of their respective owners.",
    footerPrivacyLink: "Privacy Policy",
    footerBackHome: "Back to Story of My League",

    privacyTitle: "Privacy Policy",
    privacyUpdated: "Last updated: August 14, 2026.",
    privacyWhoTitle: "Who runs this site",
    privacyWhoBody: "Story of My League is an independent, non-commercial fan project built and run by one person. It isn't a company, and it doesn't sell anything, run ads, or charge for anything.",
    privacyDataTitle: "What we collect",
    privacyDataLeagueId: "The Sleeper League ID you enter is sent to Sleeper's public API to fetch your league's data. It isn't stored in a database — aside from a short-lived in-memory cache used to speed up repeat views, it's discarded after your request.",
    privacyDataAnalytics: "Standard analytics via Google Tag Manager / Google Analytics (page views and feature usage, like when a stat card is shared) — aggregate usage data, not tied to your name or email.",
    privacyDataTurnstile: "A short-lived, signed cookie set after you pass a Cloudflare Turnstile bot check, so you don't have to re-verify on every request.",
    privacyDataTheme: "Your language and light/dark theme preference, saved locally in your browser (localStorage) — never sent to our server.",
    privacyThirdPartyTitle: "Third-party services this site uses",
    privacyThirdPartySleeper: "Sleeper — the source of all league, roster, and player data on this site.",
    privacyThirdPartyEspn: "ESPN — used to enrich a couple of stat narratives with real game stat lines.",
    privacyThirdPartyFantasyCalc: "FantasyCalc — used for dynasty trade values.",
    privacyThirdPartyAnthropic: "Anthropic (Claude) — powers the optional AI features (trade analysis, roasts, trade suggestions). Using one of these sends the specific roster/trade data being analyzed to Anthropic's API to generate that response.",
    privacyThirdPartyGoogle: "Google Tag Manager / Google Analytics — site analytics.",
    privacyThirdPartyCloudflare: "Cloudflare Turnstile — bot/spam protection on the League ID form.",
    privacyChoicesTitle: "Your choices",
    privacyChoicesBody: "Browser privacy controls (blocking third-party cookies, ad blockers, \"do not track\" extensions) are fine to use — the site's core features (standings, GOAT, H2H, narratives) work the same either way. The AI features need to send the roster/trade data being analyzed to work, since that's what generates the response.",
    privacyContactTitle: "Contact",
    privacyContactBody: "Questions about this policy? Reach out:",
  },

  es: {
    subtitle: "Standings, historial de enfrentamientos, y el GOAT de tu liga — solo pon tu League ID de Sleeper.",
    leagueIdLabel: "League ID de Sleeper",
    leagueIdPlaceholder: "League ID de Sleeper (ej. 123456789012345678)",
    analyzeBtn: "Analizar liga",
    findLeagueId: "¿Dónde encuentro mi League ID?",
    loading: "Cargando...",
    unknownError: "Error desconocido",
    invalidLeagueId: "Eso no parece un League ID de Sleeper.",
    coachmarkText: "Toca cualquier fila para convertirla en una card compartible",
    coachmarkDismiss: "Descartar",
    scrollHintText: "Desliza hacia abajo para ver la historia de tu liga ↓",

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

    groupRightNow: "🟢 Ahora Mismo",
    groupHistory: "🕰️ Historia de la Liga",
    groupAnalyze: "🔮 Analiza y Planea",

    rivalryTitle: "⚔️ Tus Rivalidades",
    nemesisTitle: "Tu Némesis",
    victimTitle: "Tu Víctima",
    nemesisDetail: (record, name) => `${record} de por vida contra ${name}. Tu peor matchup histórico.`,
    victimDetail: (record, name) => `${record} de por vida contra ${name}. Al que siempre le ganas.`,

    narrativesTitle: "📖 Las Historias de tu Liga",
    narrativesHint: "Lo que los números no te dicen a simple vista.",

    currentStandingsTitle: "Cómo Vas",
    currentStandingsHint: "Esta temporada, hasta ahora.",
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
    h2hHint: "Cada rivalidad registrada, de todas las temporadas.",
    shareH2H: "Compartir este head-to-head",

    seasonFilterLabel: "Temporada",
    seasonFilterAll: "Todas las temporadas",

    historicalStandingsTitle: "Standings por Temporada",
    champion: "🏆 Campeón",
    share: "📤 Compartir",

    rosterDepthTitle: "📦 Profundidad de Roster",
    rosterDepthHint: "Cuántos jugadores tiene cada equipo por posición ahorita — útil para saber a quién ofrecerle un trade si te falta algo.",
    rosterValueTitle: "💰 Valor de Roster",
    rosterValueHint: "Valor actual de trade por posición según FantasyCalc — quién está realmente stacked en términos de valor, no solo de cantidad de jugadores.",
    pointsReportTitle: "📈 Reporte de Puntos",
    pointsReportHint: "Quién superó su proyección la semana pasada.",
    pointsReportWeek: (season, week) => `Semana ${week}, ${season}`,
    pointsReportScopeLabel: "Alcance",
    pointsReportScopeStarters: "Titulares",
    pointsReportScopeBench: "Titulares + Banca",
    pointsReportScopeBackup: "Titular + Backup Principal",
    pointsReportProjected: (n) => `proy. ${n}`,
    colTotal: "Total",

    draftPicksTitle: "🎟️ Capital de Draft",
    draftPicksHint: "Picks netos ganados o perdidos en trades — quién tiene más municiones para el próximo draft.",
    colManagerHeader: "Manager",
    colNetPicks: "Picks Netos",
    colDetail: "Detalle",
    noMoves: "Sin movimientos",

    modalClose: "Cerrar",
    modalTitle: "Card compartible",
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
    trophyCaseEmptySeason: "Esta temporada todavía no tiene campeón.",

    bracketTitle: "🗂️ Bracket de Playoffs",
    bracketHint: "Quién sigue vivo en la pelea de playoffs — solo temporada actual.",
    bracketTbd: "Por definir",
    bracketRound: (r) => `Ronda ${r}`,

    powerRankingsTitle: "📊 Power Rankings",
    powerRankingsHint: "Quién es bueno de verdad ahorita, no solo quién tiene suerte.",

    seasonTrendTitle: "📈 Tendencia de Temporada",
    seasonTrendHint: "Puntos anotados por semana, temporada actual.",

    luckIndexTitle: "🍀 Índice de Suerte",
    luckIndexHint: "¿Tu récord te lo ganaste, o te está cargando el calendario?",
    luckIndexMostUnlucky: "🍀 El Más Desafortunado",
    luckIndexMostLucky: "🐰 El Más Suertudo",
    luckIndexDetail: (name, actual, expected) => `${name} — récord real ${actual}, esperado ${expected} según la suerte del calendario.`,

    transactionHistoryTitle: "📋 Historial de Transacciones",
    transactionHistoryEmpty: "No hay transacciones registradas.",
    tradeTrackerReceived: "recibió",
    tradeTrackerFor: "a cambio de",
    aiAnalyzeBtn: "🤖 Analizar con IA",
    aiAnalyzing: "Analizando…",
    aiError: "No se pudo generar el análisis. Intenta de nuevo.",
    transactionHistoryScopeLeague: "Últimas 5 transacciones de la liga",
    transactionHistoryScopeTeam: (name) => `Últimas 5 transacciones de ${name}`,
    transactionHistoryScopeLeagueAll: (n) => `Las ${n} transacci${n === 1 ? "ón" : "ones"} registradas en la liga`,
    transactionHistoryScopeTeamAll: (name, n) => `${n === 1 ? "La única transacción" : `Las ${n} transacciones`} de ${name}`,
    transactionHistorySearchLabel: "Buscar las transacciones de un manager",
    transactionHistorySearchPlaceholder: "— Todos los managers —",
    transactionTypeTrade: "Trade",
    transactionTypeWaiver: "Waiver",
    transactionTypeFreeAgent: "Agente Libre",
    transactionTypeDraft: "Draft",
    transactionAddedDropped: (added, dropped) => `agregó a ${added}, dejó ir a ${dropped}`,
    transactionAddedOnly: (added) => `agregó a ${added}`,
    transactionDroppedOnly: (dropped) => `dejó ir a ${dropped}`,
    transactionDrafted: (player, round, pick) => `draftó a ${player} — Ronda ${round}, Pick ${pick}`,
    roastTitle: "🔥 Roastea Mi Equipo",
    roastHint: "Obtén una evaluación de IA de las fortalezas y debilidades actuales de un roster, y qué hacer al respecto.",
    roastSelectLabel: "Elige un equipo",
    roastPlaceholder: "— Selecciona un equipo —",
    roastBtn: "🔥 Roastear Este Equipo",
    roastGenerating: "Roasteando…",
    roastGradeLabel: (grade) => `Calificación: ${grade}`,
    roastSuggestionsTitle: "Qué hacer al respecto",
    roastShareBtn: "📤 Compartir este roast",
    cardRoastEyebrow: (league) => `🔥 Roast de ${league}`,
    roastGradeCaption: "Calificación",
    cardTradeVerdictEyebrow: (league) => `🔄 Veredicto de Trade — ${league}`,
    cardTradeAnalyzerEyebrow: (league) => `🧮 Analizador de Trades — ${league}`,
    cardHypotheticalTag: "Hipotético — no es un trade real",
    cardTradeSuggestEyebrow: (league) => `🧭 Sugerencia de Trade — ${league}`,
    tradeHistoryAiTitle: "🤔 ¿Quién Ganó Este Trade?",
    tradeHistoryAiHint: "Elige cualquier trade de todo el historial de tu liga y obtén un veredicto de IA — no solo los últimos 5.",
    tradeHistoryAiSelectLabel: "Elige un trade",
    tradeHistoryAiPlaceholder: "— Selecciona un trade —",
    tradeHistoryAiOption: (season, week, a, b) => `${season} · Semana ${week} — ${a} ⇄ ${b}`,
    tradeAnalyzerTitle: "🧮 Analizador de Trades",
    tradeAnalyzerHint: "Elige jugadores para ofrecer y jugadores para pedir, y obtén un veredicto de IA sobre quién gana el trade.",
    tradeAnalyzerYourTeam: "Tu equipo",
    tradeAnalyzerTheirTeam: "Su equipo",
    tradeAnalyzerSelectTeam: "— Selecciona un equipo —",
    tradeAnalyzerPickTeam: "Elige un equipo para ver su roster.",
    tradeAnalyzerNoPlayers: "Este roster no tiene jugadores tradeables.",
    tradeAnalyzerYouOffer: "Ofreces",
    tradeAnalyzerYouRequest: "Pides",
    tradeAnalyzerTotalsLine: (count, value, ppg) => `${count} jugador${count === 1 ? "" : "es"}, valor ${value}, ${ppg} pts/partido`,
    tradeAnalyzerBtn: "🤖 Analizar Trade con IA",
    tradeSuggestTitle: "🧭 ¿Qué Deberías Ofrecerle?",
    tradeSuggestHint: "Elige un equipo y recibe una sugerencia de trade generada por IA — o descubre que no vale la pena por ahora.",
    tradeSuggestTargetTeamLabel: "Equipo objetivo",
    tradeSuggestSelectTeam: "— Selecciona un equipo —",
    tradeSuggestBtn: "🧭 Sugerir un Trade",
    tradeSuggestGenerating: "Pensando…",
    tradeSuggestPropose: "🧭 Trade que vale la pena proponer",
    tradeSuggestPass: "🤷 No vale la pena por ahora",
    steal_for_you: "🔥 Robo total para ti",
    win_for_you: "✅ Ganas el trade",
    fair: "⚖️ Trade parejo",
    win_for_them: "❌ Pierdes el trade",
    steal_for_them: "💀 Te fletaron",

    footerDisclaimer: "Story of My League es un proyecto de fan independiente. No está afiliado, avalado ni patrocinado por la NFL, Sleeper, ESPN, o FantasyCalc. Todos los nombres de equipos y jugadores son propiedad de sus respectivos dueños.",
    footerPrivacyLink: "Aviso de Privacidad",
    footerBackHome: "Volver a Story of My League",

    privacyTitle: "Aviso de Privacidad",
    privacyUpdated: "Última actualización: 14 de agosto de 2026.",
    privacyWhoTitle: "Quién opera este sitio",
    privacyWhoBody: "Story of My League es un proyecto de fan independiente, sin fines comerciales, construido y operado por una sola persona. No es una empresa, y no vende nada, no corre anuncios, ni cobra por nada.",
    privacyDataTitle: "Qué recolectamos",
    privacyDataLeagueId: "El League ID de Sleeper que ingresas se envía a la API pública de Sleeper para obtener los datos de tu liga. No se guarda en una base de datos — aparte de un cache temporal en memoria para acelerar visitas repetidas, se descarta después de tu solicitud.",
    privacyDataAnalytics: "Analítica estándar vía Google Tag Manager / Google Analytics (vistas de página y uso de funciones, como cuando se comparte una card) — datos de uso agregados, no ligados a tu nombre o correo.",
    privacyDataTurnstile: "Una cookie firmada de corta duración, puesta después de pasar el chequeo anti-bot de Cloudflare Turnstile, para que no tengas que reverificarte en cada solicitud.",
    privacyDataTheme: "Tu preferencia de idioma y tema claro/oscuro, guardada localmente en tu navegador (localStorage) — nunca se envía a nuestro servidor.",
    privacyThirdPartyTitle: "Servicios de terceros que usa este sitio",
    privacyThirdPartySleeper: "Sleeper — la fuente de todos los datos de liga, roster y jugadores en este sitio.",
    privacyThirdPartyEspn: "ESPN — usado para enriquecer un par de narrativas con el stat line real de un partido.",
    privacyThirdPartyFantasyCalc: "FantasyCalc — usado para los valores de trade dynasty.",
    privacyThirdPartyAnthropic: "Anthropic (Claude) — potencia las funciones opcionales de IA (análisis de trades, roasts, sugerencias de trade). Usar una de ellas envía el dato específico de roster/trade que se está analizando a la API de Anthropic para generar esa respuesta.",
    privacyThirdPartyGoogle: "Google Tag Manager / Google Analytics — analítica del sitio.",
    privacyThirdPartyCloudflare: "Cloudflare Turnstile — protección anti-bot/spam en el formulario de League ID.",
    privacyChoicesTitle: "Tus opciones",
    privacyChoicesBody: "Los controles de privacidad de tu navegador (bloquear cookies de terceros, ad blockers, extensiones \"do not track\") se pueden usar sin problema — las funciones principales del sitio (standings, GOAT, H2H, narrativas) funcionan igual de cualquier forma. Las funciones de IA necesitan enviar el dato de roster/trade que se está analizando para funcionar, ya que eso es lo que genera la respuesta.",
    privacyContactTitle: "Contacto",
    privacyContactBody: "¿Preguntas sobre este aviso? Escríbenos:",
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
    const isActive = btn.dataset.langBtn === currentLang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.langBtn));
});

document.documentElement.lang = currentLang;
applyStaticTranslations();
updateToggleButtons();
