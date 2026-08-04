# CLAUDE.md — Fantasy League Intelligence

## Objetivo

Proyecto personal/portafolio para demostrar progresión de habilidades técnicas (parte del roadmap de aprendizaje de Alex hacia AI Solutions Consultant: Git ✅, JavaScript ✅, Node.js ✅, APIs REST → en curso con este proyecto).

Analiza una liga de fantasy football (Sleeper) y va agregando capas de complejidad técnica versión a versión. Sin ambigüedad con trabajo de clientes — es un proyecto personal/comunidad.

## Roadmap de versiones

### v1 — API Integration (base)
Conectar Sleeper API, mostrar standings históricos, record H2H entre managers, "GOAT de la liga".
**Demuestra:** consumo de REST APIs, manejo de datos JSON, frontend básico.

### v2 — Multi-source data
Cruzar los player IDs de Sleeper con una NFL stats API (ESPN o nfl.com unofficial) para enriquecer datos de jugadores con stats reales.
**Demuestra:** integración multi-API, normalización de datos entre plataformas.

### v3 — AI layer
Conectar Claude API para generar análisis de trades en lenguaje natural (ej. "Este trade históricamente beneficia al equipo A porque...").
**Demuestra:** integración de LLMs, prompt engineering, combinar datos estructurados con AI.

### v4 — Notifications / platform connections
Webhooks a Discord o Slack cuando hay un trade en la liga, waiver relevante, o alerta de jugador trending.
**Demuestra:** event-driven integrations, webhooks, conectar plataformas de mensajería.

### v5 — MCP / agentic layer
Convertir el proyecto en un MCP server propio para que un agente pueda consultar el estado de la liga vía lenguaje natural.
**Demuestra:** arquitectura de agentes, MCP, el ciclo completo de construir una herramienta agentic.

**Por qué este arco:** cada versión agrega una capa de integración distinta — REST → multi-API → AI → event platforms → agentic — construyendo sobre la anterior en vez de ser ejercicios sueltos.

## Stack

**v1:** Node.js + Express (backend), JS/HTML/CSS plano sin framework (frontend, a propósito — v1 es sobre la integración de API). Sin autenticación, la API de Sleeper es pública y de solo lectura.

## Convenciones

- Cache en memoria (`Map`) para rosters/usuarios/matchups dentro de `lib/sleeper.js` — evita refetch repetido de la misma liga en un mismo request. Sin TTL/eviction en v1, es intencional (dataset acotado).
- Las narrativas automáticas (`computeNarratives`) solo se muestran si el dato real las soporta (umbrales mínimos de partidos/temporadas) — nunca forzar una historia sin evidencia suficiente.
- GOAT ranking: campeonatos primero, récord como desempate — no solo win/loss.

## Estado actual

**v1 shipped** — repo: [github.com/aortizotero/fantasy-league-intelligence](https://github.com/aortizotero/fantasy-league-intelligence), código en `~/Proyectos/Fantasy/v1/`.

Incluye: standings históricos, matriz H2H (con abreviaciones anti-colisión), GOAT ranking ponderado por campeonatos (vía `winners_bracket` de Sleeper), y narrativas automáticas generadas por reglas sobre los datos (La Maldición, El Verdugo, Título Más Dominante, etc.) — sin LLM todavía, eso es v3.

Probado en vivo contra la liga real de Alex ("Dominators Dinasty", 6 temporadas, League ID `1342746115425964032`).

**Stat cards compartibles** también shipped sobre v1 (`public/cards.js`, `public/vendor/html-to-image.js`): 4 tipos de card (GOAT, H2H, resumen de temporada, narrativa individual), generadas en cliente con `html-to-image` (card renderizada a 320px, exportada a `pixelRatio: 3` para ~1080px real) y compartidas vía Web Share API con fallback a descarga en desktop. Se activan haciendo clic directo sobre la fila/celda/card correspondiente en la UI existente (sin controles nuevos separados). `html-to-image` está vendored localmente en `public/vendor/` (no es dependencia de npm — solo se usó para extraer el build UMD), para no depender de un CDN en runtime.

**v2 fase 1 shipped** — dos narrativas nuevas a nivel jugador en `computeNarratives` (v. `computePlayerNarratives` en `lib/sleeper.js`): "La Actuación del Año" (mejor semana individual de un titular en la historia de la liga) y "El Peor Banquillo" (mayor diferencia de puntos entre el titular más flojo y el banca más productivo de una misma semana, mínimo 5 pts para filtrar casos triviales). Ambas usan `players_points`/`starters` que Sleeper ya regresa en cada matchup — **sin ninguna API externa todavía**, ese fue el hallazgo clave: el cruce con ESPN/nfl.com solo hace falta para enriquecer con stat lines reales (yardas, TDs), no para la mecánica base. Nombres de jugadores vía `getPlayersMap()` (dump completo `/v1/players/nfl` de Sleeper, ~5MB, cacheado una sola vez por proceso — es data global, no por liga). Cero cambios en frontend: las cards y la lista de narrativas son genéricas sobre `{icon, title, headline, detail}`, así que las nuevas narrativas aparecen y son compartibles automáticamente.

Verificado en vivo: encontró que a `alexortizotero` le anotó la defensa de Dallas (1.0 pts) mientras tenía a De'Von Achane (49.3 pts) en la banca (semana 3, 2023) — 48.3 puntos perdidos por la alineación.

**Próximo paso:** v2 fase 2 — cruzar con ESPN's hidden API (`site.api.espn.com`, sin auth) vía el `espn_id` que ya trae el dump de jugadores de Sleeper, para enriquecer estas narrativas con stat lines reales en vez de solo puntos.

## Notas

_Este archivo se debe actualizar a mano con decisiones y contexto duradero del proyecto. El progreso sesión a sesión se guarda automáticamente en el sistema de memoria de Claude Code cuando la sesión se abre con esta carpeta como directorio de trabajo._
