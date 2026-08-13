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

function buildPrompt({ season, week, sideA, sideB }, lang) {
  if (lang === "es") {
    return `Eres un analista de fantasy football escribiendo para los managers de una liga dinasty. Analiza este trade real de la temporada ${season}, semana ${week}:

${sideA.displayName} recibió: ${sideA.players} (produjeron ${sideA.value.toFixed(1)} puntos fantasy después del trade)
${sideB.displayName} recibió: ${sideB.players} (produjeron ${sideB.value.toFixed(1)} puntos fantasy después del trade)

Escribe un análisis breve (3-4 oraciones) en español, en tono de comentarista deportivo, evaluando quién ganó el trade y por qué, basándote SOLO en los puntos producidos que te di. Si alguno de los dos lados incluye un pick de draft o FAAB (no un jugador), acláralo — esos puntos de producción no aplican a ese elemento, solo a los jugadores. No inventes lesiones, contexto ni datos que no aparecen arriba. No uses encabezados ni markdown, solo texto plano.`;
  }
  return `You are a fantasy football analyst writing for the managers of a dynasty league. Analyze this real trade from the ${season} season, week ${week}:

${sideA.displayName} received: ${sideA.players} (produced ${sideA.value.toFixed(1)} fantasy points after the trade)
${sideB.displayName} received: ${sideB.players} (produced ${sideB.value.toFixed(1)} fantasy points after the trade)

Write a brief analysis (3-4 sentences) in English, in a sports-commentator tone, evaluating who won the trade and why, based ONLY on the points given above. If either side includes a draft pick or FAAB (not a player), call that out — the points production number doesn't apply to it, only to the players. Don't invent injuries, context, or data not shown above. No headers or markdown, plain text only.`;
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
    max_tokens: 300,
    messages: [{ role: "user", content: buildPrompt(trade, lang) }],
  });

  const text = response.content.find((block) => block.type === "text")?.text?.trim() || "";
  analysisCache.set(key, text);
  return text;
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

function formatPickedPlayers(players) {
  return players.map((p) => `${p.name} (${p.position}, dynasty value ${Math.round(p.value)}, ${p.ppg.toFixed(1)} pts/game this season)`).join("; ");
}

function formatRosterCounts(counts) {
  return Object.entries(counts)
    .map(([pos, n]) => `${n} ${pos}`)
    .join(", ");
}

function simulationCacheKey({ offerTeam, requestTeam }, lang) {
  const side = (team) => `${team.displayName}|${team.players.map((p) => `${p.name}:${p.value}:${p.ppg}`).sort().join(",")}`;
  return `${side(offerTeam)}::${side(requestTeam)}::${lang}`;
}

const VALID_VERDICTS = new Set(["steal_for_you", "win_for_you", "fair", "win_for_them", "steal_for_them"]);

function buildSimulatePrompt({ offerTeam, requestTeam }, lang) {
  const shared =
    lang === "es"
      ? {
          intro: `Eres un analista de fantasy football dynasty ayudando a un manager a evaluar un trade PROPUESTO que todavía NO se ha hecho — es hipotético, no un hecho consumado.`,
          you: `Tú (${offerTeam.displayName}) ofrecerías`,
          them: `A cambio de (de ${requestTeam.displayName})`,
          yourRoster: `Tu roster actual`,
          theirRoster: `Roster actual de ${requestTeam.displayName}`,
          instructions: `Evalúa el trade usando SOLO estos tres factores: (1) el valor dynasty de cada lado, (2) los puntos por partido de esta temporada de cada jugador, y (3) si cada lado le ayuda al roster receptor en una posición donde tiene necesidad, o si le sobra profundidad ahí. No inventes lesiones, contexto ni datos que no aparecen arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"verdict": "<una de: steal_for_you, win_for_you, fair, win_for_them, steal_for_them>", "interpretation": "<3-4 oraciones en español, tono de comentarista deportivo, explicando el veredicto>"}

"verdict" es SIEMPRE una de esas 5 claves en inglés exactas (no las traduzcas), evaluado desde el punto de vista de "${offerTeam.displayName}" (quien ofrece). "interpretation" va en español.`,
        }
      : {
          intro: `You are a dynasty fantasy football analyst helping a manager evaluate a PROPOSED trade that has NOT happened yet — this is hypothetical, not a completed deal.`,
          you: `You (${offerTeam.displayName}) would offer`,
          them: `In exchange for (from ${requestTeam.displayName})`,
          yourRoster: `Your current roster`,
          theirRoster: `${requestTeam.displayName}'s current roster`,
          instructions: `Evaluate the trade using ONLY these three factors: (1) each side's dynasty trade value, (2) each player's points-per-game this season, and (3) whether each side helps the receiving roster at a position of need, or adds to a position they're already deep at. Don't invent injuries, context, or data not shown above.

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"verdict": "<one of: steal_for_you, win_for_you, fair, win_for_them, steal_for_them>", "interpretation": "<3-4 sentences in English, sports-commentator tone, explaining the verdict>"}

"verdict" is ALWAYS one of those 5 exact English keys, evaluated from "${offerTeam.displayName}"'s (the offering side's) point of view. "interpretation" is in English.`,
        };

  return `${shared.intro}

${shared.you}: ${formatPickedPlayers(offerTeam.players)}
${shared.them}: ${formatPickedPlayers(requestTeam.players)}

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

function formatRoastPlayers(players) {
  return players.map((p) => `${p.name} (${p.position}, dynasty value ${Math.round(p.value)}, ${p.ppg.toFixed(1)} pts/game this season)`).join("; ");
}

function formatDraftCapital(netPicks, gained, lost, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
  if (!gained.length && !lost.length) return tr("no picks traded either way", "sin picks tradeados en ningún sentido");
  const parts = [
    ...gained.map((p) => `+${p.season} R${p.round}`),
    ...lost.map((p) => `-${p.season} R${p.round}`),
  ];
  return `${netPicks >= 0 ? "+" : ""}${netPicks} ${tr("net picks", "picks netos")} (${parts.join(", ")})`;
}

function roastCacheKey({ displayName, players, rosterCounts, netPicks, leagueTeams }, lang) {
  const playersKey = players.map((p) => `${p.name}:${p.value}:${p.ppg}`).sort().join(",");
  const countsKey = Object.entries(rosterCounts).sort().map(([k, v]) => `${k}${v}`).join(",");
  const teamsKey = (leagueTeams || []).map((t) => t.displayName).sort().join(",");
  return `${displayName}|${playersKey}|${countsKey}|${netPicks}|${teamsKey}|${lang}`;
}

// One line per other roster in the league — top players by dynasty value
// (already trimmed client-side), position depth, and net draft capital, so
// Claude can name a REAL trade partner and a REAL player instead of
// suggesting a fabricated one. Optional: older callers / a league too small
// to have other teams just get an empty list, and the prompt below adapts.
function formatLeagueTeams(leagueTeams, lang) {
  const tr = (en, es) => (lang === "es" ? es : en);
  return leagueTeams
    .map(
      (t) =>
        `- ${t.displayName}: ${tr("top players", "mejores jugadores")} ${formatRoastPlayers(t.topPlayers)}; ${tr("depth", "profundidad")} ${formatRosterCounts(t.rosterCounts)}; ${t.netPicks >= 0 ? "+" : ""}${t.netPicks} ${tr("net picks", "picks netos")}`
    )
    .join("\n");
}

function buildRoastPrompt({ displayName, players, rosterCounts, netPicks, gained, lost, leagueTeams }, lang) {
  const shared =
    lang === "es"
      ? {
          intro: `Eres un comentarista de fantasy football dynasty haciendo un "roast" divertido y ácido del roster ACTUAL de un manager para el chat de su liga — es entretenimiento entre amigos, no un análisis serio ni un insulto personal.`,
          roster: `Roster actual de ${displayName}`,
          depth: `Profundidad por posición`,
          capital: `Capital de draft`,
          otherTeams: `Otros equipos de la liga (para sugerencias de trade)`,
          instructions: `Usa SOLO estos datos: el valor dynasty y los puntos por partido de cada jugador, la profundidad por posición, y el capital de draft neto — tanto de ${displayName} como de los demás equipos listados abajo. No inventes lesiones, contexto, jugadores ni datos que no aparecen arriba. Burlate de la CONSTRUCCIÓN del roster (jugadores sobrevalorados, posiciones débiles, mala apuesta de draft picks), nunca de la persona — sin groserías ni ataques personales.${
            leagueTeams?.length
              ? ` Al menos UNA de las sugerencias debe ser un trade CONCRETO con un equipo real de la lista de abajo — nombra al equipo y a un jugador real suyo (de los que te di), no inventado, que le sirva a ${displayName} o le sirva a ellos a cambio de algo que ${displayName} tenga de sobra.`
              : ""
          }

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta forma exacta:
{"grade": "<una letra: A, B, C, D, o F>", "roast": "<3-5 oraciones en español, tono de roast divertido pero fundamentado en los datos>", "suggestions": ["<sugerencia concreta 1>", "<sugerencia concreta 2>", "<sugerencia concreta 3>"]}

"grade" es SIEMPRE una letra exacta en inglés (A/B/C/D/F, no la traduzcas). "roast" y "suggestions" van en español. Las sugerencias deben ser accionables (ej. "tradea a X mientras su valor está alto", "usa tu pick extra de 2027 para llenar RB", "ofrécele a [Equipo] tu exceso de WR a cambio de [Jugador real de ellos], que está enterrado en su banca").`,
        }
      : {
          intro: `You are a dynasty fantasy football commentator giving a fun, savage "roast" of a manager's CURRENT roster for their league group chat — this is entertainment among friends, not a serious analysis or a personal insult.`,
          roster: `${displayName}'s current roster`,
          depth: `Depth by position`,
          capital: `Draft capital`,
          otherTeams: `Other rosters in the league (for trade suggestions)`,
          instructions: `Use ONLY this data: each player's dynasty value and points-per-game, position depth, and net draft-pick capital — for ${displayName} AND for the other rosters listed below. Don't invent injuries, context, players, or data not shown above. Roast the roster's CONSTRUCTION (overvalued players, weak positions, bad draft-capital bets), never the person — no profanity, no personal attacks.${
            leagueTeams?.length
              ? ` At least ONE suggestion must be a CONCRETE trade with a real team from the list below — name the team and a real player of theirs (from what you were given), not a made-up one, that would help ${displayName} or help them in exchange for something ${displayName} has a surplus of.`
              : ""
          }

Respond ONLY with a valid JSON object, no markdown or extra text, in exactly this shape:
{"grade": "<one letter: A, B, C, D, or F>", "roast": "<3-5 sentences in English, fun roast tone but grounded in the data>", "suggestions": ["<concrete suggestion 1>", "<concrete suggestion 2>", "<concrete suggestion 3>"]}

"grade" is ALWAYS one exact letter (A/B/C/D/F). "roast" and "suggestions" are in English. Suggestions should be actionable (e.g. "trade X while their value is high", "use your extra 2027 pick to address RB", "offer [Team] your extra WR depth for [their real player], who's buried on their bench").`,
        };

  const otherTeamsBlock = leagueTeams?.length ? `\n\n${shared.otherTeams}:\n${formatLeagueTeams(leagueTeams, lang)}` : "";

  return `${shared.intro}

${shared.roster}: ${formatRoastPlayers(players)}

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
    };
  } catch {
    result = { grade: "C", roast: text, suggestions: [] };
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
    };
  } catch {
    // Claude didn't return clean JSON — degrade gracefully rather than
    // failing the request, same ethos as the rest of the project.
    result = { verdict: "fair", interpretation: text };
  }

  simulationCache.set(key, result);
  return result;
}
