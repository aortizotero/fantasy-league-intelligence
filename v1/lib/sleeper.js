// Thin client + business logic over the public Sleeper API (no auth required).
// Docs: https://docs.sleeper.com/

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
function getChampionsBySeasonIndex(chain) {
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
        map.set(id, { name, position: p.position || "", team: p.team || "FA" });
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

  if (bestWeek) {
    narratives.push({
      icon: "🚀",
      title: "La Actuación del Año",
      headline: `${playerName(bestWeek.playerId)} — ${bestWeek.points.toFixed(1)} pts`,
      detail: `Semana ${bestWeek.week}, ${bestWeek.season}, en el roster titular de ${bestWeek.owner.displayName}. La mejor semana individual en la historia de la liga.`,
    });
  }

  if (worstBenchCall) {
    narratives.push({
      icon: "🪑",
      title: "El Peor Banquillo",
      headline: worstBenchCall.owner.displayName,
      detail: `Semana ${worstBenchCall.week}, ${worstBenchCall.season}: tituló a ${playerName(worstBenchCall.starterId)} (${worstBenchCall.starterPts.toFixed(1)} pts) con ${playerName(worstBenchCall.benchedId)} (${worstBenchCall.benchedPts.toFixed(1)} pts) sentado en la banca. ${worstBenchCall.regret.toFixed(1)} puntos perdidos por la alineación.`,
    });
  }

  return narratives;
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
  }

  return narratives;
}
