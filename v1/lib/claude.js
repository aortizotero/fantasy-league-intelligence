import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

// Same "no TTL" convention as the rest of lib/sleeper.js — a finished trade's
// point totals never change, so a cached analysis never goes stale.
const analysisCache = new Map();

function cacheKey(trade, lang) {
  return `${trade.season}:${trade.week}:${trade.sideA.displayName}:${trade.sideB.displayName}:${lang}`;
}

// Asks for the full analysis AND a card-length summary in the same call —
// cheaper and more honest than trying to fit the full 3-4 sentence analysis
// into a fixed-size shareable card via CSS truncation/line-clamp. The card
// gets copy actually written to be short, not a clipped version of longer
// prose.
function buildPrompt({ season, week, sideA, sideB }, lang) {
  if (lang === "es") {
    return `Eres un analista de fantasy football escribiendo para los managers de una liga dinasty. Analiza este trade real de la temporada ${season}, semana ${week}:

${sideA.displayName} recibió: ${sideA.players} (produjeron ${sideA.value.toFixed(1)} puntos fantasy después del trade)
${sideB.displayName} recibió: ${sideB.players} (produjeron ${sideB.value.toFixed(1)} puntos fantasy después del trade)

Basándote SOLO en los puntos producidos que te di (si alguno de los dos lados incluye un pick de draft o FAAB, no un jugador, acláralo — esos puntos no aplican a ese elemento). No inventes lesiones, contexto ni datos que no aparecen arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"analysis": "<3-4 oraciones en español, tono de comentarista deportivo, evaluando quién ganó y por qué>", "summary": "<una sola oración corta y directa, menos de 100 caracteres, para una card compartible — el titular del análisis, no un resumen genérico>"}

Ambos campos van en español, sin encabezados ni markdown, solo texto plano.`;
  }
  return `You are a fantasy football analyst writing for the managers of a dynasty league. Analyze this real trade from the ${season} season, week ${week}:

${sideA.displayName} received: ${sideA.players} (produced ${sideA.value.toFixed(1)} fantasy points after the trade)
${sideB.displayName} received: ${sideB.players} (produced ${sideB.value.toFixed(1)} fantasy points after the trade)

Based ONLY on the points given above (if either side includes a draft pick or FAAB, not a player, call that out — the points number doesn't apply to it). Don't invent injuries, context, or data not shown above.

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"analysis": "<3-4 sentences in English, sports-commentator tone, evaluating who won and why>", "summary": "<one short, punchy sentence, under 100 characters, for a shareable card — the headline of the analysis, not a generic summary>"}

Both fields are in English, no headers or markdown, plain text only.`;
}

export async function analyzeTrade(trade, lang = "en") {
  const key = cacheKey(trade, lang);
  if (analysisCache.has(key)) return analysisCache.get(key);

  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 350,
    messages: [{ role: "user", content: buildPrompt(trade, lang) }],
  });

  const text = response.content.find((block) => block.type === "text")?.text?.trim() || "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let result;
  try {
    const parsed = JSON.parse(jsonText);
    result = {
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : text,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    };
  } catch {
    // Claude didn't return clean JSON — degrade to the raw text as the
    // analysis with no summary; the card falls back to line-clamping that
    // instead, same safety net as before.
    result = { analysis: text, summary: null };
  }

  analysisCache.set(key, result);
  return result;
}

// ---- Trade Analyzer (hypothetical, not-yet-made trades) -------------------
// Distinct from analyzeTrade above: that one narrates a real trade that
// already happened. This evaluates a proposed combination of players the
// user picked in the browser, and asks Claude to weigh value + points
// potential + roster need itself — Alex's own framing was "todo esto
// analizado por IA" (all of this analyzed by AI), so this deliberately does
// NOT hand-tune a scoring formula and have Claude just narrate it. Claude
// gets the real computed numbers (FantasyCalc dynasty value, season PPG,
// current position counts) and produces both the verdict and the writeup.
const simulationCache = new Map();

// Season PPG is only meaningful once real games have been played — early in
// a fresh season (or before it starts), computeSeasonPlayerPpg never sees a
// real week and every player's ppg defaults to 0. Feeding Claude a wall of
// "0.0 pts/game" reads as real production and gets narrated as such, so the
// caller passes seasonDataAvailable (derived from whether ANY manager has
// played a game yet — see roast.js/tradeAnalyzer.js/tradeSuggest.js) and
// this omits the ppg clause entirely when it's false, shared by every
// prompt builder below (analyzeTrade doesn't need this — it only ever
// narrates a completed past trade, whose points are historical fact).
function formatPickedPlayers(players, seasonDataAvailable = true) {
  return players
    .map((p) => {
      const base = `${p.name} (${p.position}, dynasty value ${Math.round(p.value)}`;
      return seasonDataAvailable ? `${base}, ${p.ppg.toFixed(1)} pts/game this season)` : `${base})`;
    })
    .join("; ");
}

function formatRosterCounts(counts) {
  return Object.entries(counts)
    .map(([pos, n]) => `${n} ${pos}`)
    .join(", ");
}

function simulationCacheKey({ offerTeam, requestTeam, seasonDataAvailable }, lang) {
  const side = (team) => `${team.displayName}|${team.players.map((p) => `${p.name}:${p.value}:${p.ppg}`).sort().join(",")}`;
  return `${side(offerTeam)}::${side(requestTeam)}::${seasonDataAvailable}::${lang}`;
}

const VALID_VERDICTS = new Set(["steal_for_you", "win_for_you", "fair", "win_for_them", "steal_for_them"]);

function buildSimulatePrompt({ offerTeam, requestTeam, seasonDataAvailable }, lang) {
  const factorsList = seasonDataAvailable
    ? lang === "es"
      ? `(1) el valor dynasty de cada lado, (2) los puntos por partido de esta temporada de cada jugador, y (3) si cada lado le ayuda al roster receptor en una posición donde tiene necesidad, o si le sobra profundidad ahí`
      : `(1) each side's dynasty trade value, (2) each player's points-per-game this season, and (3) whether each side helps the receiving roster at a position of need, or adds to a position they're already deep at`
    : lang === "es"
      ? `(1) el valor dynasty de cada lado, y (2) si cada lado le ayuda al roster receptor en una posición donde tiene necesidad, o si le sobra profundidad ahí. La temporada actual todavía no arranca, así que no hay puntos ni desempeño reciente que considerar — no lo menciones ni lo inventes`
      : `(1) each side's dynasty trade value, and (2) whether each side helps the receiving roster at a position of need, or adds to a position they're already deep at. The current season hasn't started yet, so there's no in-season performance to weigh — don't mention or invent any`;

  const shared =
    lang === "es"
      ? {
          intro: `Eres un analista de fantasy football dynasty ayudando a un manager a evaluar un trade PROPUESTO que todavía NO se ha hecho — es hipotético, no un hecho consumado.`,
          you: `Tú (${offerTeam.displayName}) ofrecerías`,
          them: `A cambio de (de ${requestTeam.displayName})`,
          yourRoster: `Tu roster actual`,
          theirRoster: `Roster actual de ${requestTeam.displayName}`,
          instructions: `Evalúa el trade usando SOLO estos factores: ${factorsList}. No inventes lesiones, contexto ni datos que no aparecen arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"verdict": "<una de: steal_for_you, win_for_you, fair, win_for_them, steal_for_them>", "interpretation": "<3-4 oraciones en español, tono de comentarista deportivo, explicando el veredicto>", "summary": "<una sola oración corta y directa, menos de 100 caracteres, para una card compartible>"}

"verdict" es SIEMPRE una de esas 5 claves en inglés exactas (no las traduzcas), evaluado desde el punto de vista de "${offerTeam.displayName}" (quien ofrece). "interpretation" y "summary" van en español.`,
        }
      : {
          intro: `You are a dynasty fantasy football analyst helping a manager evaluate a PROPOSED trade that has NOT happened yet — this is hypothetical, not a completed deal.`,
          you: `You (${offerTeam.displayName}) would offer`,
          them: `In exchange for (from ${requestTeam.displayName})`,
          yourRoster: `Your current roster`,
          theirRoster: `${requestTeam.displayName}'s current roster`,
          instructions: `Evaluate the trade using ONLY these factors: ${factorsList}. Don't invent injuries, context, or data not shown above.

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"verdict": "<one of: steal_for_you, win_for_you, fair, win_for_them, steal_for_them>", "interpretation": "<3-4 sentences in English, sports-commentator tone, explaining the verdict>", "summary": "<one short, punchy sentence, under 100 characters, for a shareable card>"}

"verdict" is ALWAYS one of those 5 exact English keys, evaluated from "${offerTeam.displayName}"'s (the offering side's) point of view. "interpretation" and "summary" are in English.`,
        };

  return `${shared.intro}

${shared.you}: ${formatPickedPlayers(offerTeam.players, seasonDataAvailable)}
${shared.them}: ${formatPickedPlayers(requestTeam.players, seasonDataAvailable)}

${shared.yourRoster}: ${formatRosterCounts(offerTeam.rosterCounts)}
${shared.theirRoster}: ${formatRosterCounts(requestTeam.rosterCounts)}

${shared.instructions}`;
}

// ---- Roast My Team ---------------------------------------------------
// Backlog item, not part of the original v1-v5 roadmap: evaluate a
// manager's CURRENT roster (dynasty value + season PPG per player, current
// position depth, net draft-pick capital — all already computed for
// Roster Value/Depth/Draft Capital, reused here rather than fetched again)
// and have Claude both grade it and roast it, same "Claude does the
// judgment, not a hand-tuned formula" posture as simulateTradeAnalysis.
const roastCache = new Map();
const VALID_GRADES = new Set(["A", "B", "C", "D", "F"]);

// Same formatter as formatPickedPlayers (Trade Analyzer) — roast/simulate
// used to carry two identical copies of this function; unified now that
// both need the same seasonDataAvailable conditional.
const formatRoastPlayers = formatPickedPlayers;

function formatDraftCapital(netPicks, gained, lost, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
  if (!gained.length && !lost.length) return tr("no picks traded either way", "sin picks tradeados en ningún sentido");
  const parts = [
    ...gained.map((p) => `+${p.season} R${p.round}`),
    ...lost.map((p) => `-${p.season} R${p.round}`),
  ];
  return `${netPicks >= 0 ? "+" : ""}${netPicks} ${tr("net picks", "picks netos")} (${parts.join(", ")})`;
}

function roastCacheKey({ displayName, players, rosterCounts, netPicks, leagueTeams, seasonDataAvailable }, lang) {
  const playersKey = players.map((p) => `${p.name}:${p.value}:${p.ppg}`).sort().join(",");
  const countsKey = Object.entries(rosterCounts).sort().map(([k, v]) => `${k}${v}`).join(",");
  const teamsKey = (leagueTeams || []).map((t) => t.displayName).sort().join(",");
  return `${displayName}|${playersKey}|${countsKey}|${netPicks}|${teamsKey}|${seasonDataAvailable}|${lang}`;
}

// One line per other roster in the league — top players by dynasty value
// (already trimmed client-side), position depth, and net draft capital, so
// Claude can name a REAL trade partner and a REAL player instead of
// suggesting a fabricated one. Optional: older callers / a league too small
// to have other teams just get an empty list, and the prompt below adapts.
function formatLeagueTeams(leagueTeams, lang, seasonDataAvailable) {
  const tr = (en, es) => (lang === "es" ? es : en);
  return leagueTeams
    .map(
      (t) =>
        `- ${t.displayName}: ${tr("top players", "mejores jugadores")} ${formatRoastPlayers(t.topPlayers, seasonDataAvailable)}; ${tr("depth", "profundidad")} ${formatRosterCounts(t.rosterCounts)}; ${t.netPicks >= 0 ? "+" : ""}${t.netPicks} ${tr("net picks", "picks netos")}`
    )
    .join("\n");
}

function buildRoastPrompt({ displayName, players, rosterCounts, netPicks, gained, lost, leagueTeams, seasonDataAvailable }, lang) {
  const shared =
    lang === "es"
      ? {
          intro: `Eres un comentarista de fantasy football dynasty haciendo un "roast" divertido y ácido del roster ACTUAL de un manager para el chat de su liga — es entretenimiento entre amigos, no un análisis serio ni un insulto personal.`,
          roster: `Roster actual de ${displayName}`,
          depth: `Profundidad por posición`,
          capital: `Capital de draft`,
          otherTeams: `Otros equipos de la liga (para sugerencias de trade)`,
          instructions: `Usa SOLO estos datos: el valor dynasty${seasonDataAvailable ? " y los puntos por partido" : ""} de cada jugador, la profundidad por posición, y el capital de draft neto — tanto de ${displayName} como de los demás equipos listados abajo.${
            seasonDataAvailable ? "" : " La temporada actual todavía no arranca, así que no hay puntos ni desempeño reciente que considerar — no lo menciones ni inventes cifras de 0 puntos, basa el roast solo en valor dynasty, profundidad y capital de draft."
          } No inventes lesiones, contexto, jugadores ni datos que no aparecen arriba. Burlate de la CONSTRUCCIÓN del roster (jugadores sobrevalorados, posiciones débiles, mala apuesta de draft picks), nunca de la persona — sin groserías ni ataques personales.${
            leagueTeams?.length
              ? ` Al menos UNA de las sugerencias debe ser un trade CONCRETO con un equipo real de la lista de abajo — nombra al equipo y a un jugador real suyo (de los que te di), no inventado, que le sirva a ${displayName} o le sirva a ellos a cambio de algo que ${displayName} tenga de sobra.`
              : ""
          }

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"grade": "<una letra: A, B, C, D, o F>", "roast": "<3-5 oraciones en español, tono de roast divertido pero fundamentado en los datos>", "suggestions": ["<sugerencia concreta 1>", "<sugerencia concreta 2>", "<sugerencia concreta 3>"], "summary": "<una sola oración corta y filosa, menos de 100 caracteres, para una card compartible — el titular del roast, no un resumen genérico>"}

"grade" es SIEMPRE una letra exacta en inglés (A/B/C/D/F, no la traduzcas). "roast", "suggestions" y "summary" van en español. Las sugerencias deben ser accionables (ej. "tradea a X mientras su valor está alto", "usa tu pick extra de 2027 para llenar RB", "ofrécele a [Equipo] tu exceso de WR a cambio de [Jugador real de ellos], que está enterrado en su banca").`,
        }
      : {
          intro: `You are a dynasty fantasy football commentator giving a fun, savage "roast" of a manager's CURRENT roster for their league group chat — this is entertainment among friends, not a serious analysis or a personal insult.`,
          roster: `${displayName}'s current roster`,
          depth: `Depth by position`,
          capital: `Draft capital`,
          otherTeams: `Other rosters in the league (for trade suggestions)`,
          instructions: `Use ONLY this data: each player's dynasty value${seasonDataAvailable ? " and points-per-game" : ""}, position depth, and net draft-pick capital — for ${displayName} AND for the other rosters listed below.${
            seasonDataAvailable ? "" : " The current season hasn't started yet, so there's no in-season performance to weigh — don't mention it or invent 0-point stat lines, base the roast only on dynasty value, depth, and draft capital."
          } Don't invent injuries, context, players, or data not shown above. Roast the roster's CONSTRUCTION (overvalued players, weak positions, bad draft-capital bets), never the person — no profanity, no personal attacks.${
            leagueTeams?.length
              ? ` At least ONE suggestion must be a CONCRETE trade with a real team from the list below — name the team and a real player of theirs (from what you were given), not a made-up one, that would help ${displayName} or help them in exchange for something ${displayName} has a surplus of.`
              : ""
          }

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"grade": "<one letter: A, B, C, D, or F>", "roast": "<3-5 sentences in English, fun roast tone but grounded in the data>", "suggestions": ["<concrete suggestion 1>", "<concrete suggestion 2>", "<concrete suggestion 3>"], "summary": "<one short, sharp sentence, under 100 characters, for a shareable card — the headline of the roast, not a generic summary>"}

"grade" is ALWAYS one exact letter (A/B/C/D/F). "roast", "suggestions", and "summary" are in English. Suggestions should be actionable (e.g. "trade X while their value is high", "use your extra 2027 pick to address RB", "offer [Team] your extra WR depth for [their real player], who's buried on their bench").`,
        };

  const otherTeamsBlock = leagueTeams?.length ? `\n\n${shared.otherTeams}:\n${formatLeagueTeams(leagueTeams, lang, seasonDataAvailable)}` : "";

  return `${shared.intro}

${shared.roster}: ${formatRoastPlayers(players, seasonDataAvailable)}

${shared.depth}: ${formatRosterCounts(rosterCounts)}

${shared.capital}: ${formatDraftCapital(netPicks, gained, lost, lang)}${otherTeamsBlock}

${shared.instructions}`;
}

export async function roastTeam(team, lang = "en") {
  const key = roastCacheKey(team, lang);
  if (roastCache.has(key)) return roastCache.get(key);

  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: buildRoastPrompt(team, lang) }],
  });

  const text = response.content.find((block) => block.type === "text")?.text?.trim() || "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let result;
  try {
    const parsed = JSON.parse(jsonText);
    result = {
      grade: VALID_GRADES.has(parsed.grade) ? parsed.grade : "C",
      roast: typeof parsed.roast === "string" ? parsed.roast : text,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === "string").slice(0, 4) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    };
  } catch {
    result = { grade: "C", roast: text, suggestions: [], summary: null };
  }

  roastCache.set(key, result);
  return result;
}

export async function simulateTradeAnalysis(trade, lang = "en") {
  const key = simulationCacheKey(trade, lang);
  if (simulationCache.has(key)) return simulationCache.get(key);

  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 350,
    messages: [{ role: "user", content: buildSimulatePrompt(trade, lang) }],
  });

  const text = response.content.find((block) => block.type === "text")?.text?.trim() || "";

  // Haiku sometimes wraps the JSON in a ```json ... ``` fence despite being
  // told not to — strip it before parsing rather than failing the request.
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let result;
  try {
    const parsed = JSON.parse(jsonText);
    result = {
      verdict: VALID_VERDICTS.has(parsed.verdict) ? parsed.verdict : "fair",
      interpretation: typeof parsed.interpretation === "string" ? parsed.interpretation : text,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    };
  } catch {
    // Claude didn't return clean JSON — degrade gracefully rather than
    // failing the request, same ethos as the rest of the project.
    result = { verdict: "fair", interpretation: text, summary: null };
  }

  simulationCache.set(key, result);
  return result;
}

// ---- Trade Suggester ("What should I offer them?") ------------------------
// Distinct from simulateTradeAnalysis: that one grades a trade the user
// already assembled by hand. This one starts from just a target manager and
// has Claude propose the trade itself (or say it's not worth pursuing) —
// weighing the target's dynasty value, their roster needs, and (when the
// season has actually started) their record, same "Claude does the
// judgment, don't hand-tune a formula" posture as the rest of v3.
const suggestCache = new Map();
const VALID_RECOMMENDATIONS = new Set(["propose", "pass"]);

function formatRecord(record, lang) {
  if (!record) return null;
  const tr = (en, es) => (lang === "es" ? es : en);
  const tieText = record.ties ? `-${record.ties}` : "";
  return `${record.wins}-${record.losses}${tieText} (${record.pointsFor.toFixed(1)} ${tr("pts for", "pts a favor")})`;
}

function suggestCacheKey({ yourTeam, targetTeam, seasonDataAvailable }, lang) {
  const side = (team) => `${team.displayName}|${team.players.map((p) => `${p.name}:${p.value}:${p.ppg}`).sort().join(",")}`;
  const recordKey = targetTeam.record ? `${targetTeam.record.wins}-${targetTeam.record.losses}-${targetTeam.record.ties}-${targetTeam.record.pointsFor}` : "none";
  return `${side(yourTeam)}::${side(targetTeam)}::${recordKey}::${seasonDataAvailable}::${lang}`;
}

function buildSuggestPrompt({ yourTeam, targetTeam, seasonDataAvailable }, lang) {
  const recordLine = seasonDataAvailable ? formatRecord(targetTeam.record, lang) : null;

  const factorsList = seasonDataAvailable
    ? lang === "es"
      ? `(1) el valor dynasty de cada jugador, (2) la profundidad/necesidad de posición de cada roster, y (3) el desempeño de ${targetTeam.displayName} esta temporada — un equipo contendiente es menos probable que suelte a sus mejores jugadores, mientras uno con mal récord puede estar más abierto a cambiar veteranos por valor futuro`
      : `(1) each player's dynasty trade value, (2) each roster's positional depth/need, and (3) ${targetTeam.displayName}'s performance this season — a contending team is less likely to trade away difference-makers, while a struggling team may be more open to moving veterans for future value`
    : lang === "es"
      ? `(1) el valor dynasty de cada jugador, y (2) la profundidad/necesidad de posición de cada roster. La temporada actual todavía no arranca, así que no hay récord ni desempeño reciente que considerar — no lo menciones ni inventes cifras`
      : `(1) each player's dynasty trade value, and (2) each roster's positional depth/need. The current season hasn't started yet, so there's no record or in-season performance to weigh — don't mention it or invent any`;

  const shared =
    lang === "es"
      ? {
          intro: `Eres un asesor de trades de fantasy football dynasty. Un manager quiere saber si vale la pena intentar un trade con otro manager de su liga, y si sí, qué ofrecerle.`,
          yourRoster: `Roster actual del manager que pregunta`,
          yourNeeds: `Su profundidad por posición`,
          targetRoster: `Roster actual de ${targetTeam.displayName} (el objetivo)`,
          targetNeeds: `Profundidad por posición de ${targetTeam.displayName}`,
          targetRecord: `Récord de ${targetTeam.displayName} esta temporada`,
          instructions: `Decide si un trade con ${targetTeam.displayName} vale la pena ahora mismo, usando SOLO estos factores: ${factorsList}. No inventes lesiones, contexto ni datos que no aparecen arriba.

Si existe un trade justo y sensato para ambos lados, propón UN paquete concreto: jugadores reales del roster del manager que pregunta para ofrecer, a cambio de jugadores reales del roster de ${targetTeam.displayName} — nunca inventes un jugador que no esté en las listas de arriba, y nunca incluyas picks de draft ni FAAB (solo jugadores). Si ningún trade tiene sentido ahora mismo (no hay nada que ganar, o la diferencia de valor es demasiado grande), dilo en vez de forzar un trato.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"recommendation": "<propose o pass>", "offerPlayers": ["<jugador real 1 del manager que pregunta>", "..."], "requestPlayers": ["<jugador real 1 de ${targetTeam.displayName}>", "..."], "reasoning": "<3-5 oraciones en español, tono de comentarista deportivo, explicando la recomendación>", "summary": "<una sola oración corta y directa, menos de 100 caracteres, para una card compartible>"}

"recommendation" es SIEMPRE "propose" o "pass" en inglés exacto (no lo traduzcas). Si es "pass", "offerPlayers" y "requestPlayers" deben ser arreglos vacíos. "reasoning" y "summary" van en español.`,
        }
      : {
          intro: `You are a dynasty fantasy football trade advisor. A manager wants to know if it's worth trying to trade with another manager in their league, and if so, what to offer.`,
          yourRoster: `The asking manager's current roster`,
          yourNeeds: `Their depth by position`,
          targetRoster: `${targetTeam.displayName}'s current roster (the target)`,
          targetNeeds: `${targetTeam.displayName}'s depth by position`,
          targetRecord: `${targetTeam.displayName}'s record this season`,
          instructions: `Decide whether a trade with ${targetTeam.displayName} is worth pursuing right now, using ONLY these factors: ${factorsList}. Don't invent injuries, context, or data not shown above.

If a fair trade that makes sense for both sides exists, propose ONE concrete package: real players from the asking manager's own roster to offer, in exchange for real players from ${targetTeam.displayName}'s roster — never invent a player not listed above, and never include draft picks or FAAB (players only). If no trade makes sense right now (nothing to gain, or the value gap is too large), say so instead of forcing a deal.

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"recommendation": "<propose or pass>", "offerPlayers": ["<real player 1 from the asking manager>", "..."], "requestPlayers": ["<real player 1 from ${targetTeam.displayName}>", "..."], "reasoning": "<3-5 sentences in English, sports-commentator tone, explaining the recommendation>", "summary": "<one short, punchy sentence, under 100 characters, for a shareable card>"}

"recommendation" is ALWAYS exactly "propose" or "pass" in English. If "pass", "offerPlayers" and "requestPlayers" must be empty arrays. "reasoning" and "summary" are in English.`,
        };

  const recordBlock = recordLine ? `\n\n${shared.targetRecord}: ${recordLine}` : "";

  return `${shared.intro}

${shared.yourRoster}: ${formatPickedPlayers(yourTeam.players, seasonDataAvailable)}

${shared.yourNeeds}: ${formatRosterCounts(yourTeam.rosterCounts)}

${shared.targetRoster}: ${formatPickedPlayers(targetTeam.players, seasonDataAvailable)}

${shared.targetNeeds}: ${formatRosterCounts(targetTeam.rosterCounts)}${recordBlock}

${shared.instructions}`;
}

export async function suggestTrade(payload, lang = "en") {
  const key = suggestCacheKey(payload, lang);
  if (suggestCache.has(key)) return suggestCache.get(key);

  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: buildSuggestPrompt(payload, lang) }],
  });

  const text = response.content.find((block) => block.type === "text")?.text?.trim() || "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let result;
  try {
    const parsed = JSON.parse(jsonText);
    const recommendation = VALID_RECOMMENDATIONS.has(parsed.recommendation) ? parsed.recommendation : "pass";
    result = {
      recommendation,
      offerPlayers: recommendation === "propose" && Array.isArray(parsed.offerPlayers) ? parsed.offerPlayers.filter((s) => typeof s === "string").slice(0, 6) : [],
      requestPlayers: recommendation === "propose" && Array.isArray(parsed.requestPlayers) ? parsed.requestPlayers.filter((s) => typeof s === "string").slice(0, 6) : [],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : text,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    };
  } catch {
    result = { recommendation: "pass", offerPlayers: [], requestPlayers: [], reasoning: text, summary: null };
  }

  suggestCache.set(key, result);
  return result;
}
