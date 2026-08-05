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
} from "./lib/sleeper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Everything a league needs in one call: current standings, full season
// history, head-to-head records, and career (GOAT) rankings.
app.get("/api/league/:leagueId", async (req, res) => {
  try {
    const { leagueId } = req.params;
    const league = await getLeague(leagueId);
    if (!league) {
      return res.status(404).json({ error: "Liga no encontrada. Revisa el League ID." });
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
    const narratives = await computeNarratives(chain, historicalStandings, h2h, goat, playersMap);

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

    res.json({
      league: { name: league.name, season: league.season, totalSeasons: chain.length },
      currentStandings: historicalStandings[historicalStandings.length - 1]?.standings ?? [],
      historicalStandings,
      h2h,
      goat,
      narratives,
      champions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo cargar la liga. " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fantasy League Intelligence corriendo en http://localhost:${PORT}`);
});
