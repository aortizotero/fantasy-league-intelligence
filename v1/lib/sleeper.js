// Thin client + business logic over the public Sleeper API (no auth required).
// Docs: https://docs.sleeper.com/

import { getStatLine } from "./espn.js";
import { getValuesBySleeperId } from "./fantasycalc.js";
import { getProjectionsCached, projectionScoringField } from "./projections.js";

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

const bracketCache = new Map(); // league_id -> Promise<bracket|null>

// The bracket is small and reused by several features (champion, runner-up,
// the bracket visualization itself) — fetch it once per league.
function getWinnersBracketCached(leagueId) {
  if (bracketCache.has(leagueId)) return bracketCache.get(leagueId);
  const promise = getWinnersBracket(leagueId).catch(() => null);
  bracketCache.set(leagueId, promise);
  return promise;
}

// The championship match (p: 1 = "this match decides 1st place"). Winner
// (`w`) is the champion, loser (`l`) is the runner-up. Returns nulls if the
// season has no finished bracket yet (in progress / not started).
async function getFinalMatch(leagueId) {
  const bracket = await getWinnersBracketCached(leagueId);
  if (!Array.isArray(bracket)) return null;
  return bracket.find((m) => m.p === 1) ?? null;
}

export async function getSeasonChampionRosterId(leagueId) {
  const finalMatch = await getFinalMatch(leagueId);
  return finalMatch?.w ?? null;
}

export async function getSeasonRunnerUpRosterId(leagueId) {
  const finalMatch = await getFinalMatch(leagueId);
  return finalMatch?.l ?? null;
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
const transactionsCache = new Map(); // `${league_id}:${week}` -> Promise<transactions|null>

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
          displayName: user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`,
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

// Shared by the trade narrative and the full Trade Tracker list, so
// switching between them (or a single request needing both) doesn't pay
// for the same per-week transaction fetch twice.
function getTransactionsCached(leagueId, week) {
  const key = `${leagueId}:${week}`;
  if (transactionsCache.has(key)) return transactionsCache.get(key);
  const promise = getTransactions(leagueId, week).catch(() => null);
  transactionsCache.set(key, promise);
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

const VALUE_POSITIONS = ["QB", "RB", "WR", "TE"]; // FantasyCalc doesn't price K/DEF

// Superflex leagues value QBs roughly 2x a 1QB league, and PPR scoring
// shifts RB/WR value — both change the FantasyCalc numbers materially, so
// they're derived from the league's actual settings rather than hardcoded.
function deriveNumQbs(rosterPositions = []) {
  const qbSlots = rosterPositions.filter((p) => p === "QB").length || 1;
  return rosterPositions.includes("SUPER_FLEX") ? qbSlots + 1 : qbSlots;
}

// Current dynasty trade value of each manager's roster, broken down by
// position — "who's actually stacked at a position" in trade-value terms,
// not just player count (that's computeRosterDepth). Values come from
// FantasyCalc (see lib/fantasycalc.js), matched to the roster via each
// player's sleeperId. Returns null if FantasyCalc is unreachable — the
// section just doesn't render rather than failing the whole league load,
// same as how a missing ESPN stat line degrades gracefully.
export async function computeRosterValue(currentLeague, playersMap) {
  const rosterMap = await buildRosterMap(currentLeague);
  const numQbs = deriveNumQbs(currentLeague.roster_positions);
  const numTeams = currentLeague.total_rosters || rosterMap.size;
  const ppr = currentLeague.scoring_settings?.rec ?? 0;

  let valuesBySleeperId;
  try {
    valuesBySleeperId = await getValuesBySleeperId({ numQbs, numTeams, ppr });
  } catch {
    return null;
  }

  return [...rosterMap.values()].map(({ ownerId, displayName, roster }) => {
    const byPosition = Object.fromEntries(VALUE_POSITIONS.map((p) => [p, 0]));
    let total = 0;
    for (const playerId of roster.players || []) {
      const position = playersMap.get(playerId)?.position;
      if (!position || byPosition[position] == null) continue;
      const value = valuesBySleeperId.get(playerId) || 0;
      byPosition[position] += value;
      total += value;
    }
    return { ownerId, displayName, byPosition, total };
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

// ---- Shared weekly results for the current season --------------------
// Season Trend, Luck Index, and Power Rankings all need the same thing:
// "how many points did each roster score, and did they win, each played
// week of the current season" — computed once, from matchups already
// cached by H2H.
async function getWeeklySeasonResults(league) {
  const rosterMap = await buildRosterMap(league);
  const lastWeek = (league.settings?.playoff_week_start || 15) - 1;
  const weeks = Array.from({ length: Math.max(lastWeek, 0) }, (_, i) => i + 1);
  const weeklyMatchups = await Promise.all(weeks.map((week) => getMatchupsCached(league.league_id, week)));

  const byRoster = new Map(); // roster_id -> [{ week, points, won }]
  weeklyMatchups.forEach((matchups, weekIdx) => {
    if (!matchups || !matchups.length) return;
    // Sleeper pre-generates the week's matchup shells (real matchup_id,
    // real pairings) before it's actually played — every roster shows 0
    // points. Same "ghost week" check as findLastPlayedWeek: without it, a
    // season that hasn't started yet looks like it has a full 0-0 record.
    if (!matchups.some((m) => (m.points || 0) > 0)) return;
    const week = weekIdx + 1;
    const byMatchupId = new Map();
    for (const m of matchups) {
      if (m.matchup_id == null) continue;
      if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, []);
      byMatchupId.get(m.matchup_id).push(m);
    }
    for (const pair of byMatchupId.values()) {
      if (pair.length !== 2) continue;
      const [m1, m2] = pair;
      const p1 = m1.points || 0;
      const p2 = m2.points || 0;
      if (!byRoster.has(m1.roster_id)) byRoster.set(m1.roster_id, []);
      if (!byRoster.has(m2.roster_id)) byRoster.set(m2.roster_id, []);
      byRoster.get(m1.roster_id).push({ week, points: p1, won: p1 > p2 });
      byRoster.get(m2.roster_id).push({ week, points: p2, won: p2 > p1 });
    }
  });

  return { rosterMap, byRoster };
}

// Points For by week, per manager — the raw series for the Season Trend
// sparkline. No smoothing/interpolation, just what actually happened.
export async function computeSeasonTrend(currentLeague) {
  const { rosterMap, byRoster } = await getWeeklySeasonResults(currentLeague);
  return [...rosterMap.values()]
    .map(({ ownerId, displayName, roster }) => ({
      ownerId,
      displayName,
      weeks: (byRoster.get(roster.roster_id) || []).map((r) => ({ week: r.week, points: r.points })).sort((a, b) => a.week - b.week),
    }))
    .filter((t) => t.weeks.length > 0);
}

const MIN_LUCK_GAMES = 3; // enough played weeks for "luck" to mean something, not noise

// "All-play" schedule luck: each week, compare a team's score against every
// OTHER team's score that week (not just their one actual opponent) to get
// an expected win total — then diff it against their real record. A team
// with a much better all-play record than real record has been playing
// tough opponents; a team with a worse one has been getting bailed out by
// a weak schedule.
export async function computeLuckIndex(currentLeague) {
  const { rosterMap, byRoster } = await getWeeklySeasonResults(currentLeague);

  const scoresByWeek = new Map(); // week -> [{ rosterId, points }]
  for (const [rosterId, results] of byRoster.entries()) {
    for (const r of results) {
      if (!scoresByWeek.has(r.week)) scoresByWeek.set(r.week, []);
      scoresByWeek.get(r.week).push({ rosterId, points: r.points });
    }
  }

  const rows = [...rosterMap.values()]
    .map(({ ownerId, displayName, roster }) => {
      const results = byRoster.get(roster.roster_id) || [];
      let actualWins = 0;
      let allPlayWins = 0;
      let allPlayLosses = 0;
      let allPlayTies = 0;
      for (const r of results) {
        if (r.won) actualWins += 1;
        for (const other of scoresByWeek.get(r.week) || []) {
          if (other.rosterId === roster.roster_id) continue;
          if (r.points > other.points) allPlayWins += 1;
          else if (r.points < other.points) allPlayLosses += 1;
          else allPlayTies += 1;
        }
      }
      const games = results.length;
      const allPlayGames = allPlayWins + allPlayLosses + allPlayTies;
      const allPlayWinPct = allPlayGames > 0 ? (allPlayWins + allPlayTies * 0.5) / allPlayGames : 0;
      const expectedWins = Math.round(allPlayWinPct * games * 10) / 10;
      return {
        ownerId,
        displayName,
        games,
        actualWins,
        actualLosses: games - actualWins,
        expectedWins,
        luckDelta: Math.round((actualWins - expectedWins) * 10) / 10,
      };
    })
    .filter((r) => r.games >= MIN_LUCK_GAMES);

  rows.sort((a, b) => a.luckDelta - b.luckDelta); // most unlucky first
  return rows;
}

// Week-over-week ranking blending record and points-for (not just
// standings order), so it can show real movement — a team can slide in
// Power Rankings even after a win, if their point total is thinning out
// relative to the league.
export async function computePowerRankings(currentLeague) {
  const { rosterMap, byRoster } = await getWeeklySeasonResults(currentLeague);
  const playedWeeks = [...new Set([...byRoster.values()].flatMap((results) => results.map((r) => r.week)))].sort((a, b) => a - b);
  if (!playedWeeks.length) return [];

  function rankThroughWeek(uptoWeek) {
    const rosterIds = [...byRoster.keys()];
    const cumulative = new Map(
      rosterIds.map((rosterId) => {
        const results = (byRoster.get(rosterId) || []).filter((r) => r.week <= uptoWeek);
        const wins = results.filter((r) => r.won).length;
        const points = results.reduce((sum, r) => sum + r.points, 0);
        return [rosterId, { wins, points }];
      })
    );
    const byWins = [...rosterIds].sort((a, b) => cumulative.get(b).wins - cumulative.get(a).wins);
    const byPoints = [...rosterIds].sort((a, b) => cumulative.get(b).points - cumulative.get(a).points);
    const winRank = new Map(byWins.map((id, i) => [id, i + 1]));
    const pointsRank = new Map(byPoints.map((id, i) => [id, i + 1]));
    const combinedRank = rosterIds
      .map((id) => [id, winRank.get(id) + pointsRank.get(id)])
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
    return new Map(combinedRank.map((id, i) => [id, i + 1]));
  }

  const latestWeek = playedWeeks[playedWeeks.length - 1];
  const previousWeek = playedWeeks.length > 1 ? playedWeeks[playedWeeks.length - 2] : null;
  const currentRank = rankThroughWeek(latestWeek);
  const previousRank = previousWeek != null ? rankThroughWeek(previousWeek) : null;

  return [...rosterMap.values()]
    .map(({ ownerId, displayName, roster }) => {
      const rank = currentRank.get(roster.roster_id);
      const prevRank = previousRank?.get(roster.roster_id) ?? null;
      return { ownerId, displayName, rank, movement: prevRank != null ? prevRank - rank : null };
    })
    .sort((a, b) => a.rank - b.rank);
}

// ---- Trophy Case & Playoff Bracket ------------------------------------
const runnerUpCache = new Map(); // league_id -> Promise<ownerId|null>

function getRunnerUpsBySeasonIndex(chain) {
  return Promise.all(
    chain.map((league) => {
      if (runnerUpCache.has(league.league_id)) return runnerUpCache.get(league.league_id);
      const promise = Promise.all([buildRosterMap(league), getSeasonRunnerUpRosterId(league.league_id)]).then(
        ([rosterMap, runnerUpRosterId]) => (runnerUpRosterId == null ? null : rosterMap.get(runnerUpRosterId)?.ownerId ?? null)
      );
      runnerUpCache.set(league.league_id, promise);
      return promise;
    })
  );
}

// Per-season awards beyond just the champion: runner-up, who scored the
// most points that season (not necessarily the #1 seed), and the Wooden
// Spoon (last place by the same record+points sort already used everywhere
// else). Only includes seasons whose bracket has actually resolved.
export async function computeTrophyCase(chain, historicalStandings) {
  const championsBySeasonIndex = await getChampionsBySeasonIndex(chain);
  const runnerUpsBySeasonIndex = await getRunnerUpsBySeasonIndex(chain);

  const trophies = [];
  for (let i = 0; i < historicalStandings.length; i += 1) {
    const championOwnerId = championsBySeasonIndex[i];
    if (!championOwnerId) continue;
    const { season, standings } = historicalStandings[i];
    if (!standings.length) continue;

    const champion = standings.find((s) => s.ownerId === championOwnerId);
    const runnerUpOwnerId = runnerUpsBySeasonIndex[i];
    const runnerUp = runnerUpOwnerId ? standings.find((s) => s.ownerId === runnerUpOwnerId) ?? null : null;
    const mostPoints = [...standings].sort((a, b) => b.pointsFor - a.pointsFor)[0];
    const woodenSpoon = standings[standings.length - 1];

    trophies.push({ season, champion, runnerUp, mostPoints, woodenSpoon });
  }
  return trophies.reverse(); // most recent season first
}

// Raw bracket for the current season, with roster_ids resolved to display
// names — text-and-line rendering happens client-side.
export async function computePlayoffBracket(currentLeague) {
  const bracket = await getWinnersBracketCached(currentLeague.league_id);
  if (!Array.isArray(bracket) || !bracket.length) return null;

  const rosterMap = await buildRosterMap(currentLeague);
  const nameFor = (rosterId) => (rosterId != null ? rosterMap.get(rosterId)?.displayName ?? null : null);

  return bracket.map((m) => ({
    match: m.m,
    round: m.r,
    place: m.p ?? null,
    team1: nameFor(m.t1),
    team2: nameFor(m.t2),
    winner: nameFor(m.w),
  }));
}

// ---- Week recap -----------------------------------------------------------
// Results, biggest blowout, and closest game for the most recently played
// week of the *current* season. Searches backward from a generous cap
// (NFL fantasy seasons rarely run past week 18, playoffs included) rather
// than trusting any single "current week" field, since that's proven
// inconsistent across league settings/seasons in practice.
const WEEK_SEARCH_CAP = 18;

async function findLastPlayedWeek(league) {
  for (let week = WEEK_SEARCH_CAP; week >= 1; week -= 1) {
    const matchups = await getMatchupsCached(league.league_id, week);
    // Sleeper can return trailing weeks with live-scoring leftovers (real
    // points, but matchup_id: null — no actual fantasy matchup happened)
    // once a season's last real week has passed. Require a real matchup_id,
    // not just a nonzero score, or a played-out season falsely "finds" one
    // extra ghost week past its actual finale.
    if (matchups && matchups.length && matchups.some((m) => m.matchup_id != null && (m.points || 0) > 0)) {
      return { week, matchups };
    }
  }
  return null;
}

export async function computeWeekRecap(currentLeague, playersMap) {
  const found = await findLastPlayedWeek(currentLeague);
  if (!found) return null; // nothing played yet this season

  const rosterMap = await buildRosterMap(currentLeague);
  const byMatchupId = new Map();
  for (const m of found.matchups) {
    if (m.matchup_id == null) continue;
    if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, []);
    byMatchupId.get(m.matchup_id).push(m);
  }

  const results = [];
  for (const pair of byMatchupId.values()) {
    if (pair.length !== 2) continue; // bye week / malformed data
    const [m1, m2] = pair;
    const r1 = rosterMap.get(m1.roster_id);
    const r2 = rosterMap.get(m2.roster_id);
    if (!r1 || !r2) continue;
    const teamA = { ownerId: r1.ownerId, displayName: r1.displayName, points: m1.points || 0 };
    const teamB = { ownerId: r2.ownerId, displayName: r2.displayName, points: m2.points || 0 };
    results.push({ teamA, teamB, margin: Math.abs(teamA.points - teamB.points) });
  }
  if (!results.length) return null;

  results.sort((a, b) => b.teamA.points + b.teamB.points - (a.teamA.points + a.teamB.points));
  const blowout = [...results].sort((a, b) => b.margin - a.margin)[0];
  const tightest = [...results].sort((a, b) => a.margin - b.margin)[0];

  // Bench Blunder — same "worst starter vs best bench" mechanic as the
  // all-time "Worst Bench Call" narrative, scoped to just this one week's
  // matchups (already fetched above, no extra network cost).
  let benchBlunder = null;
  if (playersMap) {
    for (const m of found.matchups) {
      const owner = rosterMap.get(m.roster_id);
      if (!owner) continue;
      const points = m.players_points || {};
      const starters = (m.starters || []).filter((id) => id && id !== "0");
      const bench = (m.players || []).filter((id) => id && !starters.includes(id));
      if (!starters.length || !bench.length) continue;

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
      if (regret >= MIN_BENCH_REGRET && (!benchBlunder || regret > benchBlunder.regret)) {
        benchBlunder = { owner, regret, benchedId: bestBench.id, benchedPts: bestBench.pts, starterId: worstStarter.id, starterPts: worstStarter.pts };
      }
    }
    if (benchBlunder) {
      const playerName = (id) => playersMap.get(id)?.name || `Player ${id}`;
      benchBlunder = {
        displayName: benchBlunder.owner.displayName,
        starterName: playerName(benchBlunder.starterId),
        starterPts: benchBlunder.starterPts,
        benchedName: playerName(benchBlunder.benchedId),
        benchedPts: benchBlunder.benchedPts,
        regret: benchBlunder.regret,
      };
    }
  }

  return { season: currentLeague.season, week: found.week, results, blowout, tightest, benchBlunder };
}

const REPORT_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

// Actual vs. projected points for the last played week, by position, in
// three scopes: starters only, starters + full bench, and starters + just
// the single best-projected bench player at each position ("primary
// backup") — a middle ground between the other two, not full bench depth.
// Reuses findLastPlayedWeek's matchups (same week Week Recap uses) instead
// of a second week-search pass.
export async function computePositionPointsReport(currentLeague, playersMap) {
  const found = await findLastPlayedWeek(currentLeague);
  if (!found) return null;

  let projections;
  try {
    projections = await getProjectionsCached(currentLeague.season, found.week);
  } catch {
    projections = new Map(); // degrade to projected: 0 rather than failing the whole section
  }
  const field = projectionScoringField(currentLeague.scoring_settings);
  const projectedPoints = (playerId) => projections.get(playerId)?.[field] || 0;

  const rosterMap = await buildRosterMap(currentLeague);
  const emptyScope = () => Object.fromEntries(REPORT_POSITIONS.map((p) => [p, { actual: 0, projected: 0 }]));

  const teams = [];
  for (const m of found.matchups) {
    const roster = rosterMap.get(m.roster_id);
    if (!roster) continue;

    const starters = new Set((m.starters || []).filter((id) => id && id !== "0"));
    const actualPoints = m.players_points || {};
    const starterScope = emptyScope();
    const benchScope = emptyScope();
    const backupScope = emptyScope();
    // Best-projected bench player per position — the "primary backup" added
    // to backupScope once, not the whole bench (that's benchScope's job).
    const bestBackup = Object.fromEntries(REPORT_POSITIONS.map((p) => [p, null]));

    for (const playerId of m.players || []) {
      const position = playersMap.get(playerId)?.position;
      if (!position || !starterScope[position]) continue;
      const actual = actualPoints[playerId] || 0;
      const projected = projectedPoints(playerId);

      benchScope[position].actual += actual;
      benchScope[position].projected += projected;

      if (starters.has(playerId)) {
        starterScope[position].actual += actual;
        starterScope[position].projected += projected;
        backupScope[position].actual += actual;
        backupScope[position].projected += projected;
      } else {
        const current = bestBackup[position];
        if (!current || projected > current.projected) bestBackup[position] = { actual, projected };
      }
    }

    for (const position of REPORT_POSITIONS) {
      const backup = bestBackup[position];
      if (backup) {
        backupScope[position].actual += backup.actual;
        backupScope[position].projected += backup.projected;
      }
    }

    teams.push({
      ownerId: roster.ownerId,
      displayName: roster.displayName,
      starters: starterScope,
      startersAndBench: benchScope,
      startersAndBackup: backupScope,
    });
  }

  return { week: found.week, season: currentLeague.season, teams };
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
async function computePlayerNarratives(chain, playersMap, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
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
  const playerName = (id) => playersMap.get(id)?.name || tr(`Player ${id}`, `Jugador ${id}`);
  // Real stat lines (yards, TDs, etc.) from ESPN — a nice-to-have layer on
  // top of the Sleeper-only points/starters mechanic above. Any failure
  // here (unknown espn_id, team defense, API hiccup) just means the
  // narrative stays points-only instead of breaking.
  const statLine = (id, season, week) => getStatLine(playersMap.get(id)?.espnId, season, week).catch(() => null);

  if (bestWeek) {
    const line = await statLine(bestWeek.playerId, bestWeek.season, bestWeek.week);
    narratives.push({
      icon: "🚀",
      title: tr("Performance of the Year", "La Actuación del Año"),
      headline: `${playerName(bestWeek.playerId)} — ${bestWeek.points.toFixed(1)} pts`,
      detail: tr(
        `Week ${bestWeek.week}, ${bestWeek.season}, starting for ${bestWeek.owner.displayName}.${line ? ` ${line}.` : ""} The best individual week in league history.`,
        `Semana ${bestWeek.week}, ${bestWeek.season}, en el roster titular de ${bestWeek.owner.displayName}.${line ? ` ${line}.` : ""} La mejor semana individual en la historia de la liga.`
      ),
    });
  }

  if (worstBenchCall) {
    const [starterLine, benchLine] = await Promise.all([
      statLine(worstBenchCall.starterId, worstBenchCall.season, worstBenchCall.week),
      statLine(worstBenchCall.benchedId, worstBenchCall.season, worstBenchCall.week),
    ]);
    narratives.push({
      icon: "🪑",
      title: tr("The Worst Bench Call", "El Peor Banquillo"),
      headline: worstBenchCall.owner.displayName,
      detail: tr(
        `Week ${worstBenchCall.week}, ${worstBenchCall.season}: started ${playerName(worstBenchCall.starterId)} (${worstBenchCall.starterPts.toFixed(1)} pts${starterLine ? ` — ${starterLine}` : ""}) while ${playerName(worstBenchCall.benchedId)} (${worstBenchCall.benchedPts.toFixed(1)} pts${benchLine ? ` — ${benchLine}` : ""}) sat on the bench. ${worstBenchCall.regret.toFixed(1)} points lost to the lineup.`,
        `Semana ${worstBenchCall.week}, ${worstBenchCall.season}: tituló a ${playerName(worstBenchCall.starterId)} (${worstBenchCall.starterPts.toFixed(1)} pts${starterLine ? ` — ${starterLine}` : ""}) con ${playerName(worstBenchCall.benchedId)} (${worstBenchCall.benchedPts.toFixed(1)} pts${benchLine ? ` — ${benchLine}` : ""}) sentado en la banca. ${worstBenchCall.regret.toFixed(1)} puntos perdidos por la alineación.`
      ),
    });
  }

  return narratives;
}

// ---- Draft narratives ---------------------------------------------------
// Uses the league's own real draft order (Sleeper's pick_no) instead of any
// external ADP source — "steal"/"bust" is relative to how this specific
// league actually drafted, which is both more honest and needs no new API.
const MIN_DRAFT_REGRET = 20; // rank-position gap floor — filters out noise

async function computeDraftNarratives(chain, playersMap, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
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
  const playerName = (id) => playersMap.get(id)?.name || tr(`Player ${id}`, `Jugador ${id}`);

  if (bestSteal) {
    narratives.push({
      icon: "💎",
      title: tr("The Draft Steal", "El Robo del Draft"),
      headline: `${playerName(bestSteal.playerId)} — ${tr("Round", "Ronda")} ${bestSteal.round}, Pick ${bestSteal.pickNo}`,
      detail: tr(
        `${bestSteal.owner.displayName} picked him late in the ${bestSteal.season} draft and he produced ${bestSteal.value.toFixed(1)} pts that season. The best value-per-pick in league history.`,
        `${bestSteal.owner.displayName} lo picó tarde en el draft ${bestSteal.season} y produjo ${bestSteal.value.toFixed(1)} pts esa temporada. El mejor valor-por-pick en la historia de la liga.`
      ),
    });
  }

  if (worstBust) {
    narratives.push({
      icon: "🥴",
      title: tr("The Bust", "El Bust"),
      headline: `${playerName(worstBust.playerId)} — ${tr("Round", "Ronda")} ${worstBust.round}, Pick ${worstBust.pickNo}`,
      detail: tr(
        `${worstBust.owner.displayName} picked him early in the ${worstBust.season} draft and he only produced ${worstBust.value.toFixed(1)} pts that season. The worst return on a pick in league history.`,
        `${worstBust.owner.displayName} lo picó temprano en el draft ${worstBust.season} y solo produjo ${worstBust.value.toFixed(1)} pts esa temporada. El peor retorno de un pick en la historia de la liga.`
      ),
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
const MIN_TRADE_VALUE_GAP = 30; // points — filters out roughly-even trades, for the NARRATIVE only

// Every straightforward 2-team, players-only completed trade across the
// chain, each side's post-trade production already computed. No gap
// filtering here — that's specific to "is this worth telling as a
// narrative", not to whether a trade counts for a full trade log. Shared by
// computeTradeNarratives (single most lopsided) and computeTradeTracker
// (the full list), so the per-week transaction fetch only happens once.
async function collectTrades(chain) {
  const trades = []; // { season, week, winner: {owner, players, value}, loser: {...}, gap }

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

    const weeklyTransactions = await Promise.all(weeks.map((week) => getTransactionsCached(league.league_id, week)));

    weeklyTransactions.forEach((transactions, weekIdx) => {
      if (!transactions) return;
      const week = weekIdx + 1;

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

        const winnerIsA = valueA >= valueB;
        trades.push({
          season: league.season,
          week,
          gap,
          winner: { owner: winnerIsA ? ownerA : ownerB, players: winnerIsA ? playersA : playersB, value: winnerIsA ? valueA : valueB },
          loser: { owner: winnerIsA ? ownerB : ownerA, players: winnerIsA ? playersB : playersA, value: winnerIsA ? valueB : valueA },
        });
      }
    });
  }

  return trades;
}

// Full trade log for the Trade Tracker section — every trade found, most
// recent first, with player names resolved for display.
export async function computeTradeTracker(chain, playersMap) {
  const trades = await collectTrades(chain);
  const playerName = (id) => playersMap.get(id)?.name || `Player ${id}`;
  const namesOf = (ids) => ids.map(playerName).join(", ");

  return trades
    .sort((a, b) => (b.season === a.season ? b.week - a.week : b.season.localeCompare(a.season)))
    .map((t) => ({
      season: t.season,
      week: t.week,
      sideA: { ownerId: t.winner.owner.ownerId, displayName: t.winner.owner.displayName, players: namesOf(t.winner.players), value: t.winner.value },
      sideB: { ownerId: t.loser.owner.ownerId, displayName: t.loser.owner.displayName, players: namesOf(t.loser.players), value: t.loser.value },
    }));
}

async function computeTradeNarratives(chain, playersMap, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
  const trades = await collectTrades(chain);
  const mostLopsided = trades.filter((t) => t.gap >= MIN_TRADE_VALUE_GAP).reduce((best, t) => (!best || t.gap > best.gap ? t : best), null);

  if (!mostLopsided) return [];

  const playerName = (id) => playersMap.get(id)?.name || tr(`Player ${id}`, `Jugador ${id}`);
  const namesOf = (ids) => ids.map(playerName).join(", ");

  return [
    {
      icon: "🔄",
      title: tr("The Most Lopsided Trade", "El Trade Más Lopsided"),
      headline: tr(
        `${mostLopsided.winner.owner.displayName} won a trade against ${mostLopsided.loser.owner.displayName}`,
        `${mostLopsided.winner.owner.displayName} le ganó el trade a ${mostLopsided.loser.owner.displayName}`
      ),
      detail: tr(
        `${mostLopsided.season}: ${mostLopsided.winner.owner.displayName} got ${namesOf(mostLopsided.winner.players)} (${mostLopsided.winner.value.toFixed(1)} pts produced after the trade) for ${namesOf(mostLopsided.loser.players)} (${mostLopsided.loser.value.toFixed(1)} pts). A ${mostLopsided.gap.toFixed(1)}-point gap — the most unequal trade in league history.`,
        `${mostLopsided.season}: ${mostLopsided.winner.owner.displayName} recibió a ${namesOf(mostLopsided.winner.players)} (${mostLopsided.winner.value.toFixed(1)} pts producidos después del trade) a cambio de ${namesOf(mostLopsided.loser.players)} (${mostLopsided.loser.value.toFixed(1)} pts). ${mostLopsided.gap.toFixed(1)} puntos de diferencia — el trade más desigual en la historia de la liga.`
      ),
    },
  ];
}

// Turns the same numbers everyone can already see in tables into the kind
// of storylines a league actually talks about. Every narrative here is a
// plain rule over data we've already computed — no invented flavor text
// stapled onto a stat, and nothing shows up unless the underlying data
// actually supports it (small sample sizes are filtered out rather than
// forced into a narrative).
export async function computeNarratives(chain, seasonStandings, h2h, goat, playersMap, lang = "en") {
  const tr = (en, es) => (lang === "es" ? es : en);
  const narratives = [];
  const MIN_CAREER_GAMES = 15; // enough seasons for "best record" to mean something
  const MIN_RIVALRY_GAMES = 5; // enough matchups for a rivalry to be real, not noise

  // 1. La Maldición / The Curse — best career record among managers with zero rings.
  const ringless = goat.filter((g) => g.championships === 0 && g.wins + g.losses + g.ties >= MIN_CAREER_GAMES);
  if (ringless.length > 0) {
    const cursed = ringless.reduce((best, g) => (g.winPct > best.winPct ? g : best));
    narratives.push({
      icon: "😤",
      title: tr("The Curse", "La Maldición"),
      headline: cursed.displayName,
      detail: tr(
        `The best regular-season record in league history (${cursed.wins}-${cursed.losses}${cursed.ties ? `-${cursed.ties}` : ""}, ${(cursed.winPct * 100).toFixed(1)}%) and zero championships. Favorite every year, champion of none.`,
        `El mejor récord histórico de la liga (${cursed.wins}-${cursed.losses}${cursed.ties ? `-${cursed.ties}` : ""}, ${(cursed.winPct * 100).toFixed(1)}%) y cero campeonatos. Favorito todos los años, campeón ninguno.`
      ),
    });
  }

  // 2. El Verdugo / The Executioner — the single most lopsided rivalry in the league's history.
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
      title: tr("The Executioner", "El Verdugo"),
      headline: tr(`${dominant.displayName} dominates ${dominated.displayName}`, `${dominant.displayName} domina a ${dominated.displayName}`),
      detail: tr(
        `${winsFor}-${winsAgainst}${mostLopsided.ties ? `-${mostLopsided.ties}` : ""} all-time. The most one-sided rivalry in the league... for one of them, anyway.`,
        `${winsFor}-${winsAgainst}${mostLopsided.ties ? `-${mostLopsided.ties}` : ""} de por vida. La rivalidad más pareja... para uno solo de los dos.`
      ),
    });
  }

  // 3. La Presa Eterna / The Eternal Prey — someone who has never once beaten a specific rival.
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
      title: tr("The Eternal Prey", "La Presa Eterna"),
      headline: tr(
        `${worst.loser.displayName} has never beaten ${worst.winner.displayName}`,
        `${worst.loser.displayName} nunca le ha ganado a ${worst.winner.displayName}`
      ),
      detail: tr(
        `0-${worst.losses}${worst.ties ? `-${worst.ties}` : ""} all-time. Not once.`,
        `0-${worst.losses}${worst.ties ? `-${worst.ties}` : ""} de por vida. Ni una sola vez.`
      ),
    });
  }

  // 4. Título Más Dominante / Most Dominant Title — the championship season with the best regular-season record.
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
      title: tr("Most Dominant Title", "Título Más Dominante"),
      headline: `${bestTitle.line.displayName} — ${bestTitle.season}`,
      detail: tr(
        `Champion with a ${bestTitle.line.wins}-${bestTitle.line.losses}${bestTitle.line.ties ? `-${bestTitle.line.ties}` : ""} (${(bestTitle.line.winPct * 100).toFixed(1)}%) regular season. Didn't just win the title — dominated from the start.`,
        `Campeón con ${bestTitle.line.wins}-${bestTitle.line.losses}${bestTitle.line.ties ? `-${bestTitle.line.ties}` : ""} (${(bestTitle.line.winPct * 100).toFixed(1)}%) en temporada regular. No solo ganó el título, dominó desde el inicio.`
      ),
    });
  }

  // 5-6. Player-level stories (best individual week, worst start/sit call) —
  // only run if a players directory was supplied, since callers that don't
  // need them (or don't want the ~5MB fetch) can simply omit it.
  if (playersMap) {
    narratives.push(...(await computePlayerNarratives(chain, playersMap, lang)));
    // 7-8. Draft stories (best steal, worst bust) — same playersMap gate.
    narratives.push(...(await computeDraftNarratives(chain, playersMap, lang)));
    // 9. Most lopsided trade — same playersMap gate.
    narratives.push(...(await computeTradeNarratives(chain, playersMap, lang)));
  }

  return narratives;
}
