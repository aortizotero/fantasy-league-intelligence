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
  computeTradeTracker,
  computeRosterValue,
  computePositionPointsReport,
} from "./lib/sleeper.js";
import { analyzeTrade } from "./lib/claude.js";

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
    en: { notFound: "League not found. Check the League ID.", loadFailed: "Couldn't load the league. " },
    es: { notFound: "Liga no encontrada. Revisa el League ID.", loadFailed: "No se pudo cargar la liga. " },
  }[lang];

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
      tradeTracker,
      rosterValue,
      positionPointsReport,
    ] = await Promise.all([
      computeRosterDepth(league, playersMap),
      computeDraftPickCapital(league),
      computeWeekRecap(league, playersMap),
      computeSeasonTrend(league),
      computeLuckIndex(league),
      computePowerRankings(league),
      computeTrophyCase(chain, historicalStandings),
      computePlayoffBracket(league),
      computeTradeTracker(chain, playersMap),
      computeRosterValue(league, playersMap),
      computePositionPointsReport(league, playersMap),
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
      tradeTracker,
      rosterValue,
      positionPointsReport,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: errors.loadFailed + err.message });
  }
});

// AI narrative for one trade the client already knows about (from
// tradeTracker) — generated on demand rather than for every trade on page
// load, since it's a paid API call. Validates shape/length rather than
// trusting the client, since this hits Claude directly and isn't rate-limited.
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
    const analysis = await analyzeTrade({ season, week, sideA, sideB }, lang);
    res.json({ analysis });
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
