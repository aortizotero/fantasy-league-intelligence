// Thin client + business logic over the public Sleeper API (no auth required).
// Docs: https://docs.sleeper.com/

import { getStatLine } from "./espn.js";

const BASE = "https://api.sleeper.app/v1";
const MAX_SEASONS = 25; // safety cap when walking previous_league_id chains

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Sleeper API error ${res.status} for ${url}`);
  }
  return res.json();
}

export function getLeague(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}`);
}

export function getLeagueUsers(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}/rosters`);
}

export function getMatchups(leagueId, week) {
  return fetchJSON(`${BASE}/league/${leagueId}/matchups/${week}`);
}

export function getWinnersBracket(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}/winners_bracket`);
}

export function getDrafts(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}/drafts`);
}

export function getDraftPicks(draftId) {
  return fetchJSON(`${BASE}/draft/${draftId}/picks`);
}

// `round` here is actually the week number, per Sleeper's (slightly
// misleadingly named) endpoint.
export function getTransactions(leagueId, week) {
  return fetchJSON(`${BASE}/league/${leagueId}/transactions/${week}`);
}

export function getTradedPicks(leagueId) {
  return fetchJSON(`${BASE}/league/${leagueId}/traded_picks`);
}

// Finds the championship match (p: 1 = "this match decides 1st place") and
// returns the winning roster_id, or null if the season has no finished
// bracket yet (in progress / not started).
export async function getSeasonChampionRosterId(leagueId) {
  let bracket;
  try {
    bracket = await getWinnersBracket(leagueId);
  } catch {
    return null;
  }
  if (!Array.isArray(bracket)) return null;
  const finalMatch = bracket.find((m) => m.p === 1);
  return finalMatch?.w ?? null;
}

// Walks league.previous_league_id backwards to build the full season history.
// Returns leagues ordered oldest -> newest.
export async function getLeagueChain(leagueId) {
  const chain = [];
  let currentId = leagueId;
  let guard = 0;

  while (currentId && currentId !== "0" && guard < MAX_SEASONS) {
    const league = await getLeague(currentId);
    chain.push(league);
    currentId = league.previous_league_id;
    guard += 1;
  }

  return chain.reverse();
}

// ---- Per-process cache -----------------------------------------------
// Everything below fans out from the same league chain within a single
// request (standings, H2H, GOAT all need rosters/users per season, and H2H
// additionally needs every week's matchups). A completed season's data never
// changes, so a simple in-memory cache avoids re-fetching the same league's
// rosters/users/matchups 3-4x per request. No eviction needed for v1 — the
// key space is bounded by how many distinct leagues get queried.
const rosterMapCache = new Map(); // league_id -> Promise<Map>
const matchupsCache = new Map(); // `${league_id}:${week}` -> Promise<matchups|null>

// Builds a roster_id -> { ownerId, displayName } map for a single season.
function buildRosterMap(league) {
  if (rosterMapCache.has(league.league_id)) return rosterMapCache.get(league.league_id);

  const promise = Promise.all([getLeagueUsers(league.league_id), getLeagueRosters(league.league_id)]).then(
    ([users, rosters]) => {
      const usersById = new Map(users.map((u) => [u.user_id, u]));
      const rosterMap = new Map();
      for (const roster of rosters) {
        const user = usersById.get(roster.owner_id);
        rosterMap.set(roster.roster_id, {
          ownerId: roster.owner_id || `orphan-${roster.roster_id}`,
          displayName: user?.display_name || user?.metadata?.team_name || `Roster ${roster.roster_id}`,
          roster,
        });
      }
      return rosterMap;
    }
  );

  rosterMapCache.set(league.league_id, promise);
  return promise;
}

function getMatchupsCached(leagueId, week) {
  const key = `${leagueId}:${week}`;
  if (matchupsCache.has(key)) return matchupsCache.get(key);
  const promise = getMatchups(leagueId, week).catch(() => null); // week not played / not available
  matchupsCache.set(key, promise);
  return promise;
}

// Standings for a single season, straight from Sleeper's own roster.settings
// (wins/losses/ties/points are tracked server-side, no need to recompute).
export async function getSeasonStandings(league) {
  const rosterMap = await buildRosterMap(league);
  const standings = [...rosterMap.values()].map(({ ownerId, displayName, roster }) => {
    const s = roster.settings || {};
    const wins = s.wins || 0;
    const losses = s.losses || 0;
    const ties = s.ties || 0;
    const games = wins + losses + ties;
    return {
      ownerId,
      displayName,
      wins,
      losses,
      ties,
      pointsFor: (s.fpts || 0) + (s.fpts_decimal || 0) / 100,
      pointsAgainst: (s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100,
      winPct: games > 0 ? wins / games : 0,
    };
  });

  standings.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  return { season: league.season, leagueId: league.league_id, standings };
}

export async function getHistoricalStandings(chain) {
  return Promise.all(chain.map(getSeasonStandings));
}

function canonicalPairKey(idA, idB) {
  return [idA, idB].sort().join("::");
}

// Head-to-head records between every pair of managers, across every regular
// season week of every season in the chain. Playoff weeks are excluded (we
// stop at settings.playoff_week_start - 1).
//
// All seasons are processed in parallel, and within a season all weeks are
// fetched in parallel too — this used to be N sequential awaits (seasons x
// weeks, ~80+ round trips for a 6-season league) and is now at most
// max(weeks-per-season) sequential rounds.
export async function computeH2H(chain) {
  const names = new Map(); // ownerId -> displayName (latest wins)

  const perSeasonPairRecords = await Promise.all(
    chain.map(async (league) => {
      const rosterMap = await buildRosterMap(league);
      for (const { ownerId, displayName } of rosterMap.values()) {
        names.set(ownerId, displayName);
      }

      const lastWeek = (league.settings?.playoff_week_start || 15) - 1;
      const weeks = Array.from({ length: Math.max(lastWeek, 0) }, (_, i) => i + 1);
      const weeklyMatchups = await Promise.all(weeks.map((week) => getMatchupsCached(league.league_id, week)));

      const seasonPairRecords = new Map(); // key -> { a, b, aWins, bWins, ties }

      for (const matchups of weeklyMatchups) {
        if (!matchups || matchups.length === 0) continue;

        const byMatchupId = new Map();
        for (const m of matchups) {
          if (m.matchup_id == null) continue;
          if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, []);
          byMatchupId.get(m.matchup_id).push(m);
        }

        for (const pair of byMatchupId.values()) {
          if (pair.length !== 2) continue; // bye week or malformed data
          const [m1, m2] = pair;
          const r1 = rosterMap.get(m1.roster_id);
          const r2 = rosterMap.get(m2.roster_id);
          if (!r1 || !r2) continue;

          const key = canonicalPairKey(r1.ownerId, r2.ownerId);
          if (!seasonPairRecords.has(key)) {
            seasonPairRecords.set(key, { a: r1.ownerId, b: r2.ownerId, aWins: 0, bWins: 0, ties: 0 });
          }
          const rec = seasonPairRecords.get(key);
          const p1IsA = r1.ownerId === rec.a;
          const pts1 = m1.points || 0;
          const pts2 = m2.points || 0;

          if (pts1 === pts2) {
            rec.ties += 1;
          } else if ((pts1 > pts2) === p1IsA) {
            rec.aWins += 1;
          } else {
            rec.bWins += 1;
          }
        }
      }

      return seasonPairRecords;
    })
  );

  // Merge every season's pair records into one running total, keyed
  // consistently regardless of which season first introduced the pair.
  const pairRecords = new Map();
  for (const seasonMap of perSeasonPairRecords) {
    for (const rec of seasonMap.values()) {
      const key = canonicalPairKey(rec.a, rec.b);
      if (!pairRecords.has(key)) {
        pairRecords.set(key, { a: rec.a, b: rec.b, aWins: 0, bWins: 0, ties: 0 });
      }
      const total = pairRecords.get(key);
      const sameOrientation = rec.a === total.a;
      total.aWins += sameOrientation ? rec.aWins : rec.bWins;
      total.bWins += sameOrientation ? rec.bWins : rec.aWins;
      total.ties += rec.ties;
    }
  }

  return [...pairRecords.values()].map((r) => ({
    managerA: { ownerId: r.a, displayName: names.get(r.a) || r.a },
    managerB: { ownerId: r.b, displayName: names.get(r.b) || r.b },
    aWins: r.aWins,
    bWins: r.bWins,
    ties: r.ties,
  }));
}

const championCache = new Map(); // league_id -> Promise<ownerId|null>

// Champion ownerId per season in the chain (parallel array to `chain` /
// `seasonStandings`), cached per league so GOAT and the narrative engine
// don't each re-fetch the same brackets.
export function getChampionsBySeasonIndex(chain) {
  return Promise.all(
    chain.map((league) => {
      if (championCache.has(league.league_id)) return championCache.get(league.league_id);
      const promise = Promise.all([buildRosterMap(league), getSeasonChampionRosterId(league.league_id)]).then(
        ([rosterMap, championRosterId]) =>
          championRosterId == null ? null : rosterMap.get(championRosterId)?.ownerId ?? null
      );
      championCache.set(league.league_id, promise);
      return promise;
    })
  );
}

// Career totals per manager across the whole chain, used to crown the GOAT.
// Accepts already-computed season standings so callers that already fetched
// them (server.js) don't pay for it twice.
export async function computeGOAT(chain, seasonStandings) {
  const standings = seasonStandings || (await getHistoricalStandings(chain));

  // Championships matter more than regular-season record for "GOAT" — pull
  // the actual bracket winner per season, not just who had the best record.
  const championsBySeasonIndex = await getChampionsBySeasonIndex(chain);

  const totals = new Map();

  for (let i = 0; i < standings.length; i += 1) {
    const { standings: seasonStandingsList } = standings[i];
    for (const s of seasonStandingsList) {
      if (!totals.has(s.ownerId)) {
        totals.set(s.ownerId, {
          ownerId: s.ownerId,
          displayName: s.displayName,
          seasons: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          championships: 0,
        });
      }
      const t = totals.get(s.ownerId);
      t.displayName = s.displayName; // keep the most recent season's name
      t.seasons += 1;
      t.wins += s.wins;
      t.losses += s.losses;
      t.ties += s.ties;
      t.pointsFor += s.pointsFor;
    }

    const championOwnerId = championsBySeasonIndex[i];
    if (championOwnerId && totals.has(championOwnerId)) {
      totals.get(championOwnerId).championships += 1;
    }
  }

  const career = [...totals.values()].map((t) => {
    const games = t.wins + t.losses + t.ties;
    return { ...t, winPct: games > 0 ? t.wins / games : 0 };
  });

  // Rings first — a championship-winning season outweighs a better regular
  // season record. Wins and win% are the tiebreakers among equally-ringed managers.
  career.sort((a, b) => b.championships - a.championships || b.wins - a.wins || b.winPct - a.winPct);
  return career;
}

const POSITION_COLUMNS = ["QB", "RB", "WR", "TE", "K", "DEF"];

// Current roster composition per manager — who's stacked at a position (a
// trade target) and who's thin. Uses the *current* season's rosters only
// (this is about "right now", not history), cross-referenced with
// playersMap for each player's position.
export async function computeRosterDepth(currentLeague, playersMap) {
  const rosterMap = await buildRosterMap(currentLeague);

  return [...rosterMap.values()].map(({ ownerId, displayName, roster }) => {
    const counts = Object.fromEntries(POSITION_COLUMNS.map((p) => [p, 0]));
    let other = 0;
    for (const playerId of roster.players || []) {
      const position = playersMap.get(playerId)?.position;
      if (position && counts[position] != null) counts[position] += 1;
      else other += 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + other;
    return { ownerId, displayName, counts, other, total };
  });
}

// Net future draft-pick capital per manager — how many MORE or FEWER picks
// they hold than their own natural one-per-round allotment, after every
// pick trade on record. A pick that was never traded simply never shows up
// in Sleeper's traded_picks list (it's still with its original owner by
// default), so this is a diff, not a full draft-inventory reconstruction.
export async function computeDraftPickCapital(currentLeague) {
  const rosterMap = await buildRosterMap(currentLeague);
  let tradedPicks;
  try {
    tradedPicks = await getTradedPicks(currentLeague.league_id);
  } catch {
    tradedPicks = [];
  }

  const netByRoster = new Map(); // roster_id -> { gained: [], lost: [] }
  const ensure = (rosterId) => {
    if (!netByRoster.has(rosterId)) netByRoster.set(rosterId, { gained: [], lost: [] });
    return netByRoster.get(rosterId);
  };

  for (const p of tradedPicks || []) {
    if (p.owner_id === p.roster_id) continue; // traded away and back — nets to zero
    ensure(p.owner_id).gained.push({ season: p.season, round: p.round });
    ensure(p.roster_id).lost.push({ season: p.season, round: p.round });
  }

  return [...rosterMap.values()]
    .map(({ ownerId, displayName, roster }) => {
      const { gained, lost } = netByRoster.get(roster.roster_id) || { gained: [], lost: [] };
      return { ownerId, displayName, netPicks: gained.length - lost.length, gained, lost };
    })
    .sort((a, b) => b.netPicks - a.netPicks);
}

// ---- Player-level narratives (v2) --------------------------------------
// Real player IDs and weekly fantasy points come straight from Sleeper's own
// matchup data (players_points/starters) — no external stats API needed for
// this part. Player *names* aren't in the matchup payload though, so they
// need the separate players/nfl directory below.
let playersMapPromise = null;

// Sleeper's full player directory (~5MB: every player_id it has ever
// tracked -> name/position/team). Global, not league-scoped, and
// effectively static, so it's fetched once per process and cached forever
// — same "no TTL, intentional" approach as the rest of this file, just at
// process scope instead of per-league.
export function getPlayersMap() {
  if (!playersMapPromise) {
    playersMapPromise = fetchJSON(`${BASE}/players/nfl`).then((raw) => {
      const map = new Map();
      for (const [id, p] of Object.entries(raw || {})) {
        if (!p) continue;
        const name = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
        if (!name) continue;
        map.set(id, { name, position: p.position || "", team: p.team || "FA", espnId: p.espn_id || null });
      }
      return map;
    });
  }
  return playersMapPromise;
}

const MIN_BENCH_REGRET = 5; // points — filters out trivial, not-a-real-story start/sit calls

// Walks every regular-season week of every season looking for two things:
// the single best individual scoring week by anyone in a starting lineup,
// and the single biggest "should've started him" bench mistake. Reuses the
// same cached weekly matchups computeH2H already fetched via
// getMatchupsCached, so this costs zero extra network calls when narratives
// run after H2H (which server.js already guarantees).
async function computePlayerNarratives(chain, playersMap) {
  let bestWeek = null; // { points, playerId, season, week, owner }
  let worstBenchCall = null; // { regret, ... }

  for (const league of chain) {
    const rosterMap = await buildRosterMap(league);
    const lastWeek = (league.settings?.playoff_week_start || 15) - 1;
    const weeks = Array.from({ length: Math.max(lastWeek, 0) }, (_, i) => i + 1);
    const weeklyMatchups = await Promise.all(weeks.map((week) => getMatchupsCached(league.league_id, week)));

    weeklyMatchups.forEach((matchups, weekIdx) => {
      if (!matchups) return;
      const week = weekIdx + 1;

      for (const m of matchups) {
        const owner = rosterMap.get(m.roster_id);
        if (!owner) continue;
        const points = m.players_points || {};
        const starters = (m.starters || []).filter((id) => id && id !== "0");
        const bench = (m.players || []).filter((id) => id && !starters.includes(id));
        if (!starters.length) continue;

        for (const id of starters) {
          const pts = points[id];
          if (pts == null) continue;
          if (!bestWeek || pts > bestWeek.points) {
            bestWeek = { points: pts, playerId: id, season: league.season, week, owner };
          }
        }

        if (!bench.length) continue;
        let worstStarter = null;
        for (const id of starters) {
          const pts = points[id] ?? 0;
          if (!worstStarter || pts < worstStarter.pts) worstStarter = { id, pts };
        }
        let bestBench = null;
        for (const id of bench) {
          const pts = points[id] ?? 0;
          if (!bestBench || pts > bestBench.pts) bestBench = { id, pts };
        }
        const regret = bestBench.pts - worstStarter.pts;
        if (regret >= MIN_BENCH_REGRET && (!worstBenchCall || regret > worstBenchCall.regret)) {
          worstBenchCall = {
            regret,
            season: league.season,
            week,
            owner,
            benchedId: bestBench.id,
            benchedPts: bestBench.pts,
            starterId: worstStarter.id,
            starterPts: worstStarter.pts,
          };
        }
      }
    });
  }

  const narratives = [];
  const playerName = (id) => playersMap.get(id)?.name || `Jugador ${id}`;
  // Real stat lines (yards, TDs, etc.) from ESPN — a nice-to-have layer on
  // top of the Sleeper-only points/starters mechanic above. Any failure
  // here (unknown espn_id, team defense, API hiccup) just means the
  // narrative stays points-only instead of breaking.
  const statLine = (id, season, week) => getStatLine(playersMap.get(id)?.espnId, season, week).catch(() => null);

  if (bestWeek) {
    const line = await statLine(bestWeek.playerId, bestWeek.season, bestWeek.week);
    narratives.push({
      icon: "🚀",
      title: "La Actuación del Año",
      headline: `${playerName(bestWeek.playerId)} — ${bestWeek.points.toFixed(1)} pts`,
      detail: `Semana ${bestWeek.week}, ${bestWeek.season}, en el roster titular de ${bestWeek.owner.displayName}.${line ? ` ${line}.` : ""} La mejor semana individual en la historia de la liga.`,
    });
  }

  if (worstBenchCall) {
    const [starterLine, benchLine] = await Promise.all([
      statLine(worstBenchCall.starterId, worstBenchCall.season, worstBenchCall.week),
      statLine(worstBenchCall.benchedId, worstBenchCall.season, worstBenchCall.week),
    ]);
    narratives.push({
      icon: "🪑",
      title: "El Peor Banquillo",
      headline: worstBenchCall.owner.displayName,
      detail: `Semana ${worstBenchCall.week}, ${worstBenchCall.season}: tituló a ${playerName(worstBenchCall.starterId)} (${worstBenchCall.starterPts.toFixed(1)} pts${starterLine ? ` — ${starterLine}` : ""}) con ${playerName(worstBenchCall.benchedId)} (${worstBenchCall.benchedPts.toFixed(1)} pts${benchLine ? ` — ${benchLine}` : ""}) sentado en la banca. ${worstBenchCall.regret.toFixed(1)} puntos perdidos por la alineación.`,
    });
  }

  return narratives;
}

// ---- Draft narratives ---------------------------------------------------
// Uses the league's own real draft order (Sleeper's pick_no) instead of any
// external ADP source — "steal"/"bust" is relative to how this specific
// league actually drafted, which is both more honest and needs no new API.
const MIN_DRAFT_REGRET = 20; // rank-position gap floor — filters out noise

async function computeDraftNarratives(chain, playersMap) {
  let bestSteal = null; // { regret, ... }
  let worstBust = null;

  for (const league of chain) {
    let draft;
    try {
      const drafts = await getDrafts(league.league_id);
      draft = drafts?.[0];
    } catch {
      continue;
    }
    if (!draft || draft.status !== "complete") continue; // in-progress / no draft on record

    let picks;
    try {
      picks = await getDraftPicks(draft.draft_id);
    } catch {
      continue;
    }
    const validPicks = (picks || []).filter((p) => p.player_id && p.roster_id != null);
    if (validPicks.length < 10) continue; // too few picks to rank meaningfully

    const rosterMap = await buildRosterMap(league);
    const lastWeek = (league.settings?.playoff_week_start || 15) - 1;
    const weeks = Array.from({ length: Math.max(lastWeek, 0) }, (_, i) => i + 1);
    const weeklyMatchups = await Promise.all(weeks.map((week) => getMatchupsCached(league.league_id, week)));

    // Points each player produced *for the roster that had them rostered
    // that week* — this naturally splits credit correctly across a
    // mid-season trade or drop, since a player who left a roster simply
    // stops appearing in that roster's weekly `players` list from then on.
    const valueByRosterPlayer = new Map(); // `${rosterId}:${playerId}` -> points
    for (const matchups of weeklyMatchups) {
      if (!matchups) continue;
      for (const m of matchups) {
        const points = m.players_points || {};
        for (const id of m.players || []) {
          const key = `${m.roster_id}:${id}`;
          valueByRosterPlayer.set(key, (valueByRosterPlayer.get(key) || 0) + (points[id] || 0));
        }
      }
    }

    const byPickNo = [...validPicks].sort((a, b) => a.pick_no - b.pick_no);
    const byValue = [...validPicks]
      .map((p) => ({ ...p, value: valueByRosterPlayer.get(`${p.roster_id}:${p.player_id}`) || 0 }))
      .sort((a, b) => b.value - a.value);

    const draftRank = new Map(byPickNo.map((p, i) => [`${p.roster_id}:${p.player_id}`, i + 1]));
    const perfRank = new Map(byValue.map((p, i) => [`${p.roster_id}:${p.player_id}`, i + 1]));

    for (const p of validPicks) {
      const key = `${p.roster_id}:${p.player_id}`;
      const dRank = draftRank.get(key);
      const pRank = perfRank.get(key);
      if (dRank == null || pRank == null) continue;
      const owner = rosterMap.get(p.roster_id);
      if (!owner) continue;

      const regret = dRank - pRank; // positive = outperformed draft slot
      const entry = {
        regret,
        season: league.season,
        pickNo: p.pick_no,
        round: p.round,
        playerId: p.player_id,
        owner,
        value: valueByRosterPlayer.get(key) || 0,
      };
      if (regret >= MIN_DRAFT_REGRET && (!bestSteal || regret > bestSteal.regret)) bestSteal = entry;
      if (-regret >= MIN_DRAFT_REGRET && (!worstBust || -regret > -worstBust.regret)) worstBust = entry;
    }
  }

  const narratives = [];
  const playerName = (id) => playersMap.get(id)?.name || `Jugador ${id}`;

  if (bestSteal) {
    narratives.push({
      icon: "💎",
      title: "El Robo del Draft",
      headline: `${playerName(bestSteal.playerId)} — Ronda ${bestSteal.round}, Pick ${bestSteal.pickNo}`,
      detail: `${bestSteal.owner.displayName} lo picó tarde en el draft ${bestSteal.season} y produjo ${bestSteal.value.toFixed(1)} pts esa temporada. El mejor valor-por-pick en la historia de la liga.`,
    });
  }

  if (worstBust) {
    narratives.push({
      icon: "🥴",
      title: "El Bust",
      headline: `${playerName(worstBust.playerId)} — Ronda ${worstBust.round}, Pick ${worstBust.pickNo}`,
      detail: `${worstBust.owner.displayName} lo picó temprano en el draft ${worstBust.season} y solo produjo ${worstBust.value.toFixed(1)} pts esa temporada. El peor retorno de un pick en la historia de la liga.`,
    });
  }

  return narratives;
}

// ---- Trade narratives ----------------------------------------------------
// Finds the single most lopsided 2-team, players-only trade in the league's
// history, by comparing how many points each side's newly-acquired players
// went on to produce *for the roster that received them* — same
// per-roster-per-week point accumulation as the draft narratives above, so
// a player traded again later (or dropped) naturally stops accruing value
// for a roster the moment they leave it.
const MIN_TRADE_VALUE_GAP = 30; // points — filters out roughly-even trades

async function computeTradeNarratives(chain, playersMap) {
  let mostLopsided = null; // { gap, season, winner: {owner, players, value}, loser: {...} }

  for (const league of chain) {
    const rosterMap = await buildRosterMap(league);
    const lastWeek = (league.settings?.playoff_week_start || 15) - 1;
    const weeks = Array.from({ length: Math.max(lastWeek, 0) }, (_, i) => i + 1);

    const weeklyMatchups = await Promise.all(weeks.map((week) => getMatchupsCached(league.league_id, week)));
    const valueByRosterPlayer = new Map(); // `${rosterId}:${playerId}` -> points
    for (const matchups of weeklyMatchups) {
      if (!matchups) continue;
      for (const m of matchups) {
        const points = m.players_points || {};
        for (const id of m.players || []) {
          const key = `${m.roster_id}:${id}`;
          valueByRosterPlayer.set(key, (valueByRosterPlayer.get(key) || 0) + (points[id] || 0));
        }
      }
    }

    let weeklyTransactions;
    try {
      weeklyTransactions = await Promise.all(weeks.map((week) => getTransactions(league.league_id, week)));
    } catch {
      continue;
    }

    for (const transactions of weeklyTransactions) {
      if (!transactions) continue;
      for (const t of transactions) {
        if (t.type !== "trade" || t.status !== "complete") continue;
        // Picks/FAAB carry value our points-only metric can't see — skip
        // anything but a clean players-for-players trade to keep the
        // comparison honest rather than mislabeling a fair trade as lopsided.
        if (t.draft_picks?.length || t.waiver_budget?.length) continue;
        if (!t.adds || Object.keys(t.adds).length < 2) continue;

        const sides = new Map(); // rosterId -> playerId[]
        for (const [playerId, rosterId] of Object.entries(t.adds)) {
          if (!sides.has(rosterId)) sides.set(rosterId, []);
          sides.get(rosterId).push(playerId);
        }
        if (sides.size !== 2) continue; // only straightforward 2-team trades

        const [[rosterA, playersA], [rosterB, playersB]] = [...sides.entries()];
        const ownerA = rosterMap.get(Number(rosterA));
        const ownerB = rosterMap.get(Number(rosterB));
        if (!ownerA || !ownerB) continue;

        const valueA = playersA.reduce((sum, id) => sum + (valueByRosterPlayer.get(`${rosterA}:${id}`) || 0), 0);
        const valueB = playersB.reduce((sum, id) => sum + (valueByRosterPlayer.get(`${rosterB}:${id}`) || 0), 0);
        const gap = Math.abs(valueA - valueB);
        if (gap < MIN_TRADE_VALUE_GAP) continue;

        const winnerIsA = valueA >= valueB;
        const entry = {
          gap,
          season: league.season,
          winner: { owner: winnerIsA ? ownerA : ownerB, players: winnerIsA ? playersA : playersB, value: winnerIsA ? valueA : valueB },
          loser: { owner: winnerIsA ? ownerB : ownerA, players: winnerIsA ? playersB : playersA, value: winnerIsA ? valueB : valueA },
        };
        if (!mostLopsided || gap > mostLopsided.gap) mostLopsided = entry;
      }
    }
  }

  if (!mostLopsided) return [];

  const playerName = (id) => playersMap.get(id)?.name || `Jugador ${id}`;
  const namesOf = (ids) => ids.map(playerName).join(", ");

  return [
    {
      icon: "🔄",
      title: "El Trade Más Lopsided",
      headline: `${mostLopsided.winner.owner.displayName} le ganó el trade a ${mostLopsided.loser.owner.displayName}`,
      detail: `${mostLopsided.season}: ${mostLopsided.winner.owner.displayName} recibió a ${namesOf(mostLopsided.winner.players)} (${mostLopsided.winner.value.toFixed(1)} pts producidos después del trade) a cambio de ${namesOf(mostLopsided.loser.players)} (${mostLopsided.loser.value.toFixed(1)} pts). ${mostLopsided.gap.toFixed(1)} puntos de diferencia — el trade más desigual en la historia de la liga.`,
    },
  ];
}

// Turns the same numbers everyone can already see in tables into the kind
// of storylines a league actually talks about. Every narrative here is a
// plain rule over data we've already computed — no invented flavor text
// stapled onto a stat, and nothing shows up unless the underlying data
// actually supports it (small sample sizes are filtered out rather than
// forced into a narrative).
export async function computeNarratives(chain, seasonStandings, h2h, goat, playersMap) {
  const narratives = [];
  const MIN_CAREER_GAMES = 15; // enough seasons for "best record" to mean something
  const MIN_RIVALRY_GAMES = 5; // enough matchups for a rivalry to be real, not noise

  // 1. La Maldición — best career record among managers with zero rings.
  const ringless = goat.filter((g) => g.championships === 0 && g.wins + g.losses + g.ties >= MIN_CAREER_GAMES);
  if (ringless.length > 0) {
    const cursed = ringless.reduce((best, g) => (g.winPct > best.winPct ? g : best));
    narratives.push({
      icon: "😤",
      title: "La Maldición",
      headline: cursed.displayName,
      detail: `El mejor récord histórico de la liga (${cursed.wins}-${cursed.losses}${cursed.ties ? `-${cursed.ties}` : ""}, ${(cursed.winPct * 100).toFixed(1)}%) y cero campeonatos. Favorito todos los años, campeón ninguno.`,
    });
  }

  // 2. El Verdugo — the single most lopsided rivalry in the league's history.
  const realRivalries = h2h.filter((r) => r.aWins + r.bWins + r.ties >= MIN_RIVALRY_GAMES);
  if (realRivalries.length > 0) {
    const mostLopsided = realRivalries.reduce((best, r) =>
      Math.abs(r.aWins - r.bWins) > Math.abs(best.aWins - best.bWins) ? r : best
    );
    const dominant = mostLopsided.aWins >= mostLopsided.bWins ? mostLopsided.managerA : mostLopsided.managerB;
    const dominated = mostLopsided.aWins >= mostLopsided.bWins ? mostLopsided.managerB : mostLopsided.managerA;
    const winsFor = Math.max(mostLopsided.aWins, mostLopsided.bWins);
    const winsAgainst = Math.min(mostLopsided.aWins, mostLopsided.bWins);
    narratives.push({
      icon: "🔨",
      title: "El Verdugo",
      headline: `${dominant.displayName} domina a ${dominated.displayName}`,
      detail: `${winsFor}-${winsAgainst}${mostLopsided.ties ? `-${mostLopsided.ties}` : ""} de por vida. La rivalidad más pareja... para uno solo de los dos.`,
    });
  }

  // 3. La Presa Eterna — someone who has never once beaten a specific rival.
  const neverWon = h2h
    .flatMap((r) => {
      const entries = [];
      if (r.aWins === 0 && r.bWins + r.ties >= 3) entries.push({ loser: r.managerA, winner: r.managerB, losses: r.bWins, ties: r.ties });
      if (r.bWins === 0 && r.aWins + r.ties >= 3) entries.push({ loser: r.managerB, winner: r.managerA, losses: r.aWins, ties: r.ties });
      return entries;
    })
    .sort((a, b) => b.losses - a.losses);
  if (neverWon.length > 0) {
    const worst = neverWon[0];
    narratives.push({
      icon: "👻",
      title: "La Presa Eterna",
      headline: `${worst.loser.displayName} nunca le ha ganado a ${worst.winner.displayName}`,
      detail: `0-${worst.losses}${worst.ties ? `-${worst.ties}` : ""} de por vida. Ni una sola vez.`,
    });
  }

  // 4. Título Más Dominante — the championship season with the best regular-season record.
  const championsBySeasonIndex = await getChampionsBySeasonIndex(chain);
  let bestTitle = null;
  for (let i = 0; i < seasonStandings.length; i += 1) {
    const championOwnerId = championsBySeasonIndex[i];
    if (!championOwnerId) continue;
    const seasonLine = seasonStandings[i].standings.find((s) => s.ownerId === championOwnerId);
    if (!seasonLine) continue;
    if (!bestTitle || seasonLine.winPct > bestTitle.line.winPct) {
      bestTitle = { line: seasonLine, season: seasonStandings[i].season };
    }
  }
  if (bestTitle) {
    narratives.push({
      icon: "👑",
      title: "Título Más Dominante",
      headline: `${bestTitle.line.displayName} — ${bestTitle.season}`,
      detail: `Campeón con ${bestTitle.line.wins}-${bestTitle.line.losses}${bestTitle.line.ties ? `-${bestTitle.line.ties}` : ""} (${(bestTitle.line.winPct * 100).toFixed(1)}%) en temporada regular. No solo ganó el título, dominó desde el inicio.`,
    });
  }

  // 5-6. Player-level stories (best individual week, worst start/sit call) —
  // only run if a players directory was supplied, since callers that don't
  // need them (or don't want the ~5MB fetch) can simply omit it.
  if (playersMap) {
    narratives.push(...(await computePlayerNarratives(chain, playersMap)));
    // 7-8. Draft stories (best steal, worst bust) — same playersMap gate.
    narratives.push(...(await computeDraftNarratives(chain, playersMap)));
    // 9. Most lopsided trade — same playersMap gate.
    narratives.push(...(await computeTradeNarratives(chain, playersMap)));
  }

  return narratives;
}
