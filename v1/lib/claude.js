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
