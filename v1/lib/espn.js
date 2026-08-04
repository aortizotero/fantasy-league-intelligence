// Unofficial ESPN API for real per-game stat lines (yards, TDs, etc.) — no
// auth, no API key, the same endpoint espn.com's own web client calls.
// Verified by hand against a real box score (Jonathan Taylor, week 11 2021):
// this endpoint's numbers matched espn.com exactly.
const BASE = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";

const gamelogCache = new Map(); // `${espnId}:${season}` -> Promise<gamelog|null>

// A player's full-season game log, keyed by ESPN athlete id. Cached
// indefinitely per process — a past season's box scores never change, same
// "no TTL, intentional" approach as lib/sleeper.js.
function fetchGamelog(espnId, season) {
  const key = `${espnId}:${season}`;
  if (gamelogCache.has(key)) return gamelogCache.get(key);
  const promise = fetch(`${BASE}/athletes/${espnId}/gamelog?season=${season}`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  gamelogCache.set(key, promise);
  return promise;
}

// Rate/per-average and "longest play" fields are noise in a short stat
// line — the counting stats (yards, TDs, attempts) are what tell the story.
const SKIP_FIELD_PATTERN = /^yardsPer|^long/i;

function formatStatLine(gamelog, match) {
  const groups = [];
  let idx = 0;
  for (const cat of gamelog.categories) {
    const parts = [];
    for (let i = 0; i < cat.count; i += 1, idx += 1) {
      const name = gamelog.names[idx];
      const label = gamelog.labels[idx];
      const raw = match.stats[idx];
      if (!raw || raw === "-" || raw === "0" || raw === "0.0" || SKIP_FIELD_PATTERN.test(name)) continue;
      parts.push(`${raw} ${label}`);
    }
    if (parts.length) groups.push(`${cat.displayName}: ${parts.join(", ")}`);
  }
  return groups.length ? groups.join(" · ") : null;
}

// Returns a short human stat line ("Rushing: 32 CAR, 185 YDS, 4 TD") for one
// player's specific week, or null if ESPN has nothing usable (unknown
// espn_id, team defenses, bye weeks, API hiccup — all non-fatal, callers
// just keep the points-only narrative).
export async function getStatLine(espnId, season, week) {
  if (!espnId) return null;
  const gamelog = await fetchGamelog(espnId, season);
  if (!gamelog) return null;

  const regularSeason = gamelog.seasonTypes?.find((t) => /regular/i.test(t.displayName));
  const events = regularSeason?.categories?.[0]?.events;
  if (!events) return null;

  const match = events.find((e) => gamelog.events?.[e.eventId]?.week === week);
  if (!match) return null;

  return formatStatLine(gamelog, match);
}
