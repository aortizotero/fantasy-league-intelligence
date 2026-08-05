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

**v2 fase 2 shipped** — `lib/espn.js`: cruce con la API no oficial de ESPN (`site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_id}/gamelog?season={year}`, sin auth) vía el `espn_id` que ya trae el dump de jugadores de Sleeper. Enriquece "La Actuación del Año" y "El Peor Banquillo" con el stat line real de esa semana (ej. "Rushing: 32 CAR, 185 YDS, 4 TD") en vez de solo puntos fantasy. Verificado a mano contra un box score real (Jonathan Taylor, semana 11 2021 vs. Buffalo — 32 acarreos, 185 yardas, 4 TDs terrestres, coincide exacto con espn.com). Cachea el game log completo por `espnId:season` indefinidamente (mismo criterio "sin TTL" que el resto del proyecto — un box score pasado no cambia).

Falla con gracia cuando ESPN no tiene el dato: equipos de defensa (ej. "Dallas Cowboys") no son "athletes" reales en ESPN, y no todos los jugadores traen `espn_id` poblado en el dump de Sleeper (De'Von Achane no lo tenía al momento de probar) — en esos casos la narrativa simplemente se queda en solo-puntos, sin romper nada.

**En vivo:** [storyofmyleague.com](https://storyofmyleague.com) — deploy vía Coolify (self-hosted, VPS propio de Alex) usando `v1/Dockerfile` (Base Directory `/v1`, sin Nixpacks). DNS en GoDaddy (registro A en `@` apuntando al servidor, `www` como CNAME al root). Sin variables de entorno — Sleeper y ESPN son APIs públicas sin auth. SSL automático vía Let's Encrypt (lo maneja Coolify solo).

**Card de Campeón + narrativas de draft shipped** (post-v2, mismo espíritu de "exprimir lo que ya tenemos antes de saltar a v3"):
- 5ª stat card: **Campeón de Temporada** — distinta de la card de "resumen de temporada" (que muestra top-3 por récord regular sin afirmar quién ganó, a propósito). Esta sí usa el campeón real del bracket de playoffs (`getChampionsBySeasonIndex`, ya existía internamente para GOAT/narrativas, ahora expuesto en el response del API como `champions[]`, paralelo a `historicalStandings[]`). Botón "🏆 Campeón" solo aparece en temporadas con bracket ya resuelto.
- Dos narrativas de draft en `computeDraftNarratives` (`lib/sleeper.js`): **"El Robo del Draft"** y **"El Bust"** — usan el draft real de Sleeper (`/v1/league/{id}/drafts` + `/v1/draft/{id}/picks`, `pick_no` real de la liga) cruzado con puntos producidos por jugador *mientras estuvo en el roster que lo draftió* (mismo patrón de acumulación semana-a-semana que "El Peor Banquillo" — reparte el crédito correctamente si el jugador fue tradeado o cortado a media temporada). Sin ADP externo — decisión deliberada, ADP real requeriría una fuente de datos que no tenemos y el ranking por posición-de-pick-vs-posición-de-desempeño dentro de la propia liga es más honesto para este proyecto (100% retrospectivo, no predictivo).
- Verificado en vivo: Aaron Rodgers (pick 112, ronda 12, 2021) produjo 223.3 pts para `alexcuate` — el mejor robo. Saquon Barkley (pick 5, ronda 1, 2021) solo 97.8 pts para `ferbds` — el peor bust. Ambos coinciden con la realidad de esa temporada (Rodgers MVP, Barkley lesionado).

**Selector "Mi equipo" shipped** — `public/myteam.js`: dropdown para elegir tu manager, resalta tus filas en standings/GOAT/H2H vía un atributo compartido `data-owner-id`, y marca (borde/glow) las narrativas que te mencionan por nombre. 100% client-side, cero llamadas nuevas al API (el dato ya estaba cargado) — persiste la selección en `localStorage` por liga. Bug encontrado y arreglado en el camino: `myteam.js` y `cards.js` declaraban ambos `let currentData` a nivel superior; como son `<script>` clásicos (no módulos), comparten el mismo scope léxico global y la redeclaración tiraba un `SyntaxError` que mataba `myteam.js` completo en silencio — renombrado a `myTeamData`.

**Narrativa de trades shipped** — `computeTradeNarratives` en `lib/sleeper.js`: cruza `/v1/league/{id}/transactions/{week}` (tipo `trade`, status `complete`) con el mismo cálculo de "puntos producidos por jugador en el roster que lo tiene" que ya usaba la narrativa de draft. Encuentra el trade 2-equipos, solo-jugadores (sin picks ni FAAB de por medio, para que la comparación sea justa) más desigual de la historia de la liga, comparando cuánto produjo cada lado de lo que recibió. Verificado en vivo: JorgeGBXI le ganó un trade a Fedesalazar10 en 2023 — recibió a Courtland Sutton + DeVonta Smith (305.6 pts) a cambio de Matthew Stafford (191.3 pts), 114.3 pts de diferencia.

**Herramientas de roster shipped** — dos secciones nuevas, no narrativas sino datos accionables ("a quién le ofrezco un trade"):
- **Profundidad de Roster** (`computeRosterDepth`): cuenta jugadores por posición (QB/RB/WR/TE/K/DEF) del roster *actual* de cada manager, cruzando `roster.players` (ya lo trae `/v1/league/{id}/rosters`) con `playersMap`. La celda más alta de cada columna se resalta — así se ve de un vistazo quién está stacked en una posición.
- **Capital de Draft** (`computeDraftPickCapital`): usa `/v1/league/{id}/traded_picks` para calcular picks netos ganados/perdidos por trade (no reconstruye el inventario completo del draft, solo el diff vs. lo que cada quien tendría "de forma natural" — un pick nunca tradeado simplemente no aparece en la lista). Verificado que la suma neta de toda la liga da exactamente 0 (zero-sum, como debe ser en un intercambio de picks).
- Ambas reusan el `data-owner-id` del selector "Mi equipo", así que también se resaltan solas si seleccionas tu equipo.

**Rivalidades personalizadas shipped** — "Tu Némesis" (a quién le tienes peor récord) y "Tu Víctima" (a quién más dominas), calculadas 100% client-side en `myteam.js` a partir del `h2h` que ya está cargado, en cuanto seleccionas tu equipo en "Mi equipo". No son narrativas del servidor (dependen de quién esté viendo, no son un hecho fijo de la liga), así que viven aparte de `data.narratives` — pero se comparten igual: `cards.js` ganó un tipo `"personal"` que arma la card directo desde los atributos `data-*` del botón en vez de buscar por índice en un arreglo. Verificado en vivo: alexortizotero tiene 1-6-1 contra carlos1rvp (némesis) y 7-2-1 contra Fedesalazar10 (víctima) — coincide exacto con la matriz H2H.

**Resumen de la Semana shipped** — nueva sección arriba del todo (justo debajo del nombre de la liga): resultados de la última semana jugada de la temporada actual, más dos callouts ("💥 Golpe de la Semana" y "😰 Partido Más Cerrado"), y un 6º tipo de stat card compartible. `computeWeekRecap` en `lib/sleeper.js` busca hacia atrás desde la semana 18 hasta encontrar la última con matchups reales — reusa los matchups semanales ya cacheados por el H2H, cero llamadas nuevas.

Bug real encontrado y arreglado en el camino: Sleeper puede regresar una semana "fantasma" después de terminada la temporada (`matchup_id: null` pero `points` con datos reales — parece ser scoring en vivo residual de la NFL sin partido de fantasy asociado). La búsqueda original solo validaba `points > 0` y encontraba esa semana fantasma en vez de la última real. Ahora también exige `matchup_id != null`. Verificado en vivo contra la temporada 2025 ya jugada: encontró correctamente la semana 17 (la final — alexcuate 158.2 vs JorgeGBXI 120.5, coincide con el campeón real de esa temporada).

Con esto la liga ya tiene 9 narrativas automáticas de liga, 2 narrativas personales, 6 tipos de stat card, 2 herramientas de roster, y un resumen semanal — probablemente el punto natural para pausar el "exprimir lo que ya tenemos" y decidir el siguiente salto real.

**Próximo paso:** v3 (capa de AI/Claude) es lo siguiente en el roadmap versionado — sin decidir todavía, preguntar antes de asumir.

## Notas

_Este archivo se debe actualizar a mano con decisiones y contexto duradero del proyecto. El progreso sesión a sesión se guarda automáticamente en el sistema de memoria de Claude Code cuando la sesión se abre con esta carpeta como directorio de trabajo._
