// Weekly player projections from Sleeper's public (unofficial but no-auth)
// projections endpoint — same shape/spirit as the actual-points data
// already pulled from matchups elsewhere in this project.

const BASE = "https://api.sleeper.com/projections/nfl";

// A played week's projections don't change afterward, so this can cache
// forever — same convention as matchups/transactions in lib/sleeper.js.
const projectionsCache = new Map(); // `${season}:${week}` -> Map<playerId, stats>

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper projections error ${res.status} for ${url}`);
  return res.json();
}

const POSITIONS_QUERY = ["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => `position[]=${p}`).join("&");

export async function getProjectionsCached(season, week) {
  const key = `${season}:${week}`;
  if (projectionsCache.has(key)) return projectionsCache.get(key);

  const url = `${BASE}/${season}/${week}?season_type=regular&${POSITIONS_QUERY}`;
  const data = await fetchJSON(url);

  const byPlayerId = new Map();
  for (const entry of data) {
    if (entry.player_id) byPlayerId.set(entry.player_id, entry.stats || {});
  }

  projectionsCache.set(key, byPlayerId);
  return byPlayerId;
}

// Sleeper's projections only carry the three preset scoring buckets, not a
// fully custom-scored number — pick the bucket closest to the league's
// actual reception scoring. Approximate, same caveat as any stat sourced
// from outside the league's own scoring engine (see lib/espn.js).
export function projectionScoringField(scoringSettings) {
  const rec = scoringSettings?.rec ?? 0;
  if (rec >= 0.75) return "pts_ppr";
  if (rec >= 0.25) return "pts_half_ppr";
  return "pts_std";
}
