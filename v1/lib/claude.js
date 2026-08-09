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

Escribe un análisis breve (3-4 oraciones) en español, en tono de comentarista deportivo, evaluando quién ganó el trade y por qué, basándote SOLO en los puntos producidos que te di. No inventes lesiones, contexto ni datos que no aparecen arriba. No uses encabezados ni markdown, solo texto plano.`;
  }
  return `You are a fantasy football analyst writing for the managers of a dynasty league. Analyze this real trade from the ${season} season, week ${week}:

${sideA.displayName} received: ${sideA.players} (produced ${sideA.value.toFixed(1)} fantasy points after the trade)
${sideB.displayName} received: ${sideB.players} (produced ${sideB.value.toFixed(1)} fantasy points after the trade)

Write a brief analysis (3-4 sentences) in English, in a sports-commentator tone, evaluating who won the trade and why, based ONLY on the points given above. Don't invent injuries, context, or data not shown above. No headers or markdown, plain text only.`;
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
