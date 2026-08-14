import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  getLeague,
  getLeagueChain,
  getHistoricalStandings,
  computeH2H,
  computeGOAT,
  computeNarratives,
  getPlayersMap,
  getChampionsBySeasonIndex,
  computeRosterDepth,
  computeDraftPickCapital,
  computeWeekRecap,
  computeSeasonTrend,
  computeLuckIndex,
  computePowerRankings,
  computeTrophyCase,
  computePlayoffBracket,
  computeTransactionHistory,
  computeRosterValue,
  computePositionPointsReport,
  computeRosterPlayerPool,
} from "./lib/sleeper.js";
import { analyzeTrade, simulateTradeAnalysis, roastTeam, suggestTrade } from "./lib/claude.js";
import { checkTurnstile } from "./lib/turnstile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Everything a league needs in one call: current standings, full season
// history, head-to-head records, and career (GOAT) rankings.
app.get("/api/league/:leagueId", async (req, res) => {
  const lang = req.query.lang === "es" ? "es" : "en";
  const errors = {
    en: {
      notFound: "League not found. Check the League ID.",
      loadFailed: "Couldn't load the league. ",
      turnstileFailed: "Security check failed. Please try again.",
    },
    es: {
      notFound: "Liga no encontrada. Revisa el League ID.",
      loadFailed: "No se pudo cargar la liga. ",
      turnstileFailed: "Falló la verificación de seguridad. Intenta de nuevo.",
    },
  }[lang];

  const passedTurnstile = await checkTurnstile(req, res);
  if (!passedTurnstile) {
    return res.status(403).json({ error: errors.turnstileFailed });
  }

  try {
    const { leagueId } = req.params;
    const league = await getLeague(leagueId);
    if (!league) {
      return res.status(404).json({ error: errors.notFound });
    }

    const chain = await getLeagueChain(leagueId);
    // historicalStandings is computed once and reused for both "current
    // season" (its last entry, since the chain is oldest -> newest) and the
    // GOAT career totals — avoids fetching the same rosters/users twice.
    const historicalStandings = await getHistoricalStandings(chain);
    // getPlayersMap() fetches Sleeper's global player directory, independent
    // of this league, so it runs alongside h2h/goat instead of after them.
    const [h2h, goat, playersMap] = await Promise.all([
      computeH2H(chain),
      computeGOAT(chain, historicalStandings),
      getPlayersMap(),
    ]);
    // Narratives are derived FROM h2h + goat, so they run after (not in
    // parallel with) the calls that produce those.
    const narratives = await computeNarratives(chain, historicalStandings, h2h, goat, playersMap, lang);

    // The actual bracket winner per season — NOT the same as "#1 in the
    // standings table" (regular-season record and playoff results can
    // diverge). Parallel array to historicalStandings; null for a season
    // whose bracket hasn't finished yet (in progress / not started).
    const championsBySeasonIndex = await getChampionsBySeasonIndex(chain);
    const champions = historicalStandings.map((s, i) => {
      const championOwnerId = championsBySeasonIndex[i];
      if (!championOwnerId) return null;
      return s.standings.find((line) => line.ownerId === championOwnerId) ?? null;
    });

    // Roster-building tools — "who's stacked at a position" and "who has
    // extra draft capital" — both scoped to the *current* league (the one
    // the user actually entered), not the whole historical chain. Season
    // Trend / Luck Index / Power Rankings are also current-season only,
    // for the same reason.
    const [
      rosterDepth,
      draftPicks,
      weekRecap,
      seasonTrend,
      luckIndex,
      powerRankings,
      trophyCase,
      playoffBracket,
      transactionHistory,
      rosterValue,
      positionPointsReport,
      rosterPlayerPool,
    ] = await Promise.all([
      computeRosterDepth(league, playersMap),
      computeDraftPickCapital(league),
      computeWeekRecap(league, playersMap),
      computeSeasonTrend(league),
      computeLuckIndex(league),
      computePowerRankings(league),
      computeTrophyCase(chain, historicalStandings),
      computePlayoffBracket(league),
      computeTransactionHistory(chain, playersMap, lang),
      computeRosterValue(league, playersMap),
      computePositionPointsReport(league, playersMap),
      computeRosterPlayerPool(league, playersMap),
    ]);

    res.json({
      league: { name: league.name, season: league.season, totalSeasons: chain.length },
      currentStandings: historicalStandings[historicalStandings.length - 1]?.standings ?? [],
      historicalStandings,
      h2h,
      goat,
      narratives,
      champions,
      rosterDepth,
      draftPicks,
      weekRecap,
      seasonTrend,
      luckIndex,
      powerRankings,
      trophyCase,
      playoffBracket,
      transactionHistory,
      rosterValue,
      positionPointsReport,
      rosterPlayerPool,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: errors.loadFailed + err.message });
  }
});

// AI narrative for one trade the client already knows about (from the
// Transaction History feed) — generated on demand rather than for every
// trade on page load, since it's a paid API call. Validates shape/length
// rather than trusting the client, since this hits Claude directly and
// isn't rate-limited.
function isValidTradeSide(side) {
  return (
    side &&
    typeof side.displayName === "string" &&
    side.displayName.length <= 100 &&
    typeof side.players === "string" &&
    side.players.length <= 500 &&
    typeof side.value === "number" &&
    Number.isFinite(side.value)
  );
}

app.post("/api/trade-analysis", async (req, res) => {
  const lang = req.body?.lang === "es" ? "es" : "en";
  const errors = {
    en: { badRequest: "Invalid trade data.", notConfigured: "AI analysis isn't configured for this deployment.", failed: "Couldn't generate the analysis. " },
    es: { badRequest: "Datos de trade inválidos.", notConfigured: "El análisis con IA no está configurado en este deployment.", failed: "No se pudo generar el análisis. " },
  }[lang];

  const { season, week, sideA, sideB } = req.body || {};
  const validSeason = typeof season === "string" && season.length <= 10;
  const validWeek = Number.isInteger(week) && week >= 1 && week <= 18;
  if (!validSeason || !validWeek || !isValidTradeSide(sideA) || !isValidTradeSide(sideB)) {
    return res.status(400).json({ error: errors.badRequest });
  }

  try {
    // { analysis, summary } — summary is a card-length headline generated
    // in the same call, so the shareable card doesn't have to truncate the
    // full analysis (see lib/claude.js's buildPrompt).
    const result = await analyzeTrade({ season, week, sideA, sideB }, lang);
    res.json(result);
  } catch (err) {
    if (err.message === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: errors.notConfigured });
    }
    console.error(err);
    res.status(500).json({ error: errors.failed + err.message });
  }
});

// Hypothetical trade evaluator (Trade Analyzer) — distinct from
// /api/trade-analysis above, which narrates a trade that already happened.
// This one takes a proposed combination of players the user picked in the
// browser and asks Claude to weigh value + points potential + roster need
// itself (rather than a hand-tuned scoring formula), returning a verdict
// key plus a written interpretation. Same "validate, don't trust the
// client" posture as isValidTradeSide, since this also hits Claude
// directly with no rate-limiting.
function isValidPickedPlayer(p) {
  return (
    p &&
    typeof p.name === "string" &&
    p.name.length <= 80 &&
    typeof p.position === "string" &&
    p.position.length <= 10 &&
    typeof p.value === "number" &&
    Number.isFinite(p.value) &&
    typeof p.ppg === "number" &&
    Number.isFinite(p.ppg)
  );
}

function isValidSimulatedTeam(team) {
  return (
    team &&
    typeof team.displayName === "string" &&
    team.displayName.length <= 100 &&
    Array.isArray(team.players) &&
    team.players.length >= 1 &&
    team.players.length <= 6 &&
    team.players.every(isValidPickedPlayer) &&
    team.rosterCounts &&
    typeof team.rosterCounts === "object" &&
    Object.values(team.rosterCounts).every((n) => Number.isInteger(n) && n >= 0)
  );
}

app.post("/api/trade-simulate", async (req, res) => {
  const lang = req.body?.lang === "es" ? "es" : "en";
  const errors = {
    en: { badRequest: "Invalid trade data.", notConfigured: "AI analysis isn't configured for this deployment.", failed: "Couldn't generate the analysis. " },
    es: { badRequest: "Datos de trade inválidos.", notConfigured: "El análisis con IA no está configurado en este deployment.", failed: "No se pudo generar el análisis. " },
  }[lang];

  const { offerTeam, requestTeam, seasonDataAvailable } = req.body || {};
  const validSeasonFlag = seasonDataAvailable === undefined || typeof seasonDataAvailable === "boolean";
  if (!isValidSimulatedTeam(offerTeam) || !isValidSimulatedTeam(requestTeam) || !validSeasonFlag) {
    return res.status(400).json({ error: errors.badRequest });
  }

  try {
    const result = await simulateTradeAnalysis({ offerTeam, requestTeam, seasonDataAvailable: seasonDataAvailable ?? true }, lang);
    res.json(result);
  } catch (err) {
    if (err.message === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: errors.notConfigured });
    }
    console.error(err);
    res.status(500).json({ error: errors.failed + err.message });
  }
});

// Roast My Team — grades and roasts a manager's CURRENT roster (backlog
// item, not a hypothetical trade). Reuses isValidPickedPlayer for the
// player shape; rosterCounts/netPicks/gained/lost mirror what
// computeRosterDepth/computeDraftPickCapital already return, validated the
// same "don't trust the client, this hits Claude directly" way as the other
// two AI endpoints above.
function isValidPickTrade(p) {
  return p && typeof p.season === "string" && p.season.length <= 10 && Number.isInteger(p.round) && p.round >= 1 && p.round <= 30;
}

function isValidRoastTeam(team) {
  return (
    team &&
    typeof team.displayName === "string" &&
    team.displayName.length <= 100 &&
    Array.isArray(team.players) &&
    team.players.length >= 1 &&
    team.players.length <= 40 &&
    team.players.every(isValidPickedPlayer) &&
    team.rosterCounts &&
    typeof team.rosterCounts === "object" &&
    Object.values(team.rosterCounts).every((n) => Number.isInteger(n) && n >= 0) &&
    Number.isInteger(team.netPicks) &&
    Array.isArray(team.gained) &&
    team.gained.length <= 50 &&
    team.gained.every(isValidPickTrade) &&
    Array.isArray(team.lost) &&
    team.lost.length <= 50 &&
    team.lost.every(isValidPickTrade)
  );
}

// Other rosters in the league, passed alongside the roasted team so Claude
// can suggest a real trade partner instead of inventing one — trimmed
// client-side to each team's top players (see roast.js), so this validator
// caps well below the isValidRoastTeam limits above.
function isValidLeagueTeam(t) {
  return (
    t &&
    typeof t.displayName === "string" &&
    t.displayName.length <= 100 &&
    Array.isArray(t.topPlayers) &&
    t.topPlayers.length <= 15 &&
    t.topPlayers.every(isValidPickedPlayer) &&
    t.rosterCounts &&
    typeof t.rosterCounts === "object" &&
    Object.values(t.rosterCounts).every((n) => Number.isInteger(n) && n >= 0) &&
    Number.isInteger(t.netPicks)
  );
}

app.post("/api/roast-team", async (req, res) => {
  const lang = req.body?.lang === "es" ? "es" : "en";
  const errors = {
    en: { badRequest: "Invalid team data.", notConfigured: "AI analysis isn't configured for this deployment.", failed: "Couldn't generate the roast. " },
    es: { badRequest: "Datos de equipo inválidos.", notConfigured: "El análisis con IA no está configurado en este deployment.", failed: "No se pudo generar el roast. " },
  }[lang];

  const { displayName, players, rosterCounts, netPicks, gained, lost, leagueTeams, seasonDataAvailable } = req.body || {};
  const validLeagueTeams = leagueTeams === undefined || (Array.isArray(leagueTeams) && leagueTeams.length <= 30 && leagueTeams.every(isValidLeagueTeam));
  const validSeasonFlag = seasonDataAvailable === undefined || typeof seasonDataAvailable === "boolean";
  if (!isValidRoastTeam({ displayName, players, rosterCounts, netPicks, gained, lost }) || !validLeagueTeams || !validSeasonFlag) {
    return res.status(400).json({ error: errors.badRequest });
  }

  try {
    const result = await roastTeam({ displayName, players, rosterCounts, netPicks, gained, lost, leagueTeams, seasonDataAvailable: seasonDataAvailable ?? true }, lang);
    res.json(result);
  } catch (err) {
    if (err.message === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: errors.notConfigured });
    }
    console.error(err);
    res.status(500).json({ error: errors.failed + err.message });
  }
});

// Trade Suggester ("What should you offer them?") — distinct from
// /api/trade-simulate, which grades a trade the user already picked.
// This one only takes a target team; Claude proposes the trade itself (or
// says to pass), so the validation here doesn't need a players.length
// floor of 1 on the offer side the way isValidSimulatedTeam does — both
// sides come straight from computeRosterPlayerPool, so a real roster with
// zero tradeable players just never gets this far (the section hides
// itself client-side, see tradeSuggest.js).
function isValidTradeSuggestTeam(team) {
  return (
    team &&
    typeof team.displayName === "string" &&
    team.displayName.length <= 100 &&
    Array.isArray(team.players) &&
    team.players.length >= 1 &&
    team.players.length <= 40 &&
    team.players.every(isValidPickedPlayer) &&
    team.rosterCounts &&
    typeof team.rosterCounts === "object" &&
    Object.values(team.rosterCounts).every((n) => Number.isInteger(n) && n >= 0)
  );
}

function isValidTeamRecord(record) {
  return (
    record === null ||
    record === undefined ||
    (typeof record === "object" &&
      Number.isInteger(record.wins) &&
      record.wins >= 0 &&
      Number.isInteger(record.losses) &&
      record.losses >= 0 &&
      Number.isInteger(record.ties) &&
      record.ties >= 0 &&
      typeof record.pointsFor === "number" &&
      Number.isFinite(record.pointsFor))
  );
}

app.post("/api/trade-suggest", async (req, res) => {
  const lang = req.body?.lang === "es" ? "es" : "en";
  const errors = {
    en: { badRequest: "Invalid team data.", notConfigured: "AI analysis isn't configured for this deployment.", failed: "Couldn't generate the suggestion. " },
    es: { badRequest: "Datos de equipo inválidos.", notConfigured: "El análisis con IA no está configurado en este deployment.", failed: "No se pudo generar la sugerencia. " },
  }[lang];

  const { yourTeam, targetTeam, seasonDataAvailable } = req.body || {};
  const validSeasonFlag = typeof seasonDataAvailable === "boolean";
  if (
    !isValidTradeSuggestTeam(yourTeam) ||
    !isValidTradeSuggestTeam(targetTeam) ||
    !isValidTeamRecord(targetTeam?.record) ||
    !validSeasonFlag
  ) {
    return res.status(400).json({ error: errors.badRequest });
  }

  try {
    const result = await suggestTrade({ yourTeam, targetTeam, seasonDataAvailable }, lang);
    res.json(result);
  } catch (err) {
    if (err.message === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: errors.notConfigured });
    }
    console.error(err);
    res.status(500).json({ error: errors.failed + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`www.storyofmyleague.com running at http://localhost:${PORT}`);
});
