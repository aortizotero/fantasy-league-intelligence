const BASE = "https://api.fantasycalc.com";

// Unlike the rest of this project (box scores, drafts, transactions — all
// immutable history), trade values genuinely drift week to week as players
// perform or get hurt. A short TTL instead of the usual "cache forever"
// convention keeps roster values from going stale for days.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const valuesCache = new Map(); // `${numQbs}:${numTeams}:${ppr}` -> { fetchedAt, bySleeperId }

const VALUE_POSITIONS = ["QB", "RB", "WR", "TE"]; // FantasyCalc doesn't price K/DEF

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`FantasyCalc request failed: ${res.status}`);
  return res.json();
}

// Returns a Map of sleeperId -> current trade value, scoped to the league's
// actual settings (numQbs/numTeams/ppr materially change dynasty values —
// a Superflex QB is worth ~2x a 1QB one, so this can't be hardcoded).
export async function getValuesBySleeperId({ numQbs, numTeams, ppr }) {
  const key = `${numQbs}:${numTeams}:${ppr}`;
  const cached = valuesCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.bySleeperId;

  const url = `${BASE}/values/current?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;
  const data = await fetchJSON(url);

  const bySleeperId = new Map();
  for (const entry of data) {
    const sleeperId = entry.player?.sleeperId;
    if (!sleeperId || !VALUE_POSITIONS.includes(entry.player.position)) continue;
    bySleeperId.set(sleeperId, entry.value);
  }

  valuesCache.set(key, { fetchedAt: Date.now(), bySleeperId });
  return bySleeperId;
}
