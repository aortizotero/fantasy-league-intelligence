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

**v3:** `@anthropic-ai/sdk` (oficial) para las llamadas a Claude — ver `lib/claude.js`.

## Convenciones

- Cache en memoria (`Map`) para rosters/usuarios/matchups dentro de `lib/sleeper.js` — evita refetch repetido de la misma liga en un mismo request. Sin TTL/eviction en v1, es intencional (dataset acotado).
- Las narrativas automáticas (`computeNarratives`) solo se muestran si el dato real las soporta (umbrales mínimos de partidos/temporadas) — nunca forzar una historia sin evidencia suficiente.
- GOAT ranking: campeonatos primero, récord como desempate — no solo win/loss.
- `public/*.js` son `<script>` clásicos (sin `type="module"`), a propósito (v1 es sin build step). Efecto secundario: todos comparten el mismo scope léxico global, así que un `let`/`const` de nivel superior con el mismo nombre en dos archivos tira un `SyntaxError` silencioso que mata uno de los dos scripts completo. Ya pasó dos veces (`currentData` en cards.js/myteam.js, `currentLeagueId` en app.js/myteam.js) — revisar nombres contra los demás archivos antes de declarar una variable nueva a nivel superior.

## Estado actual

**v1 shipped** — repo: [github.com/aortizotero/fantasy-league-intelligence](https://github.com/aortizotero/fantasy-league-intelligence), código en `~/Proyectos/Fantasy/v1/`.

Incluye: standings históricos, matriz H2H (con abreviaciones anti-colisión), GOAT ranking ponderado por campeonatos (vía `winners_bracket` de Sleeper), y narrativas automáticas generadas por reglas sobre los datos (La Maldición, El Verdugo, Título Más Dominante, etc.) — sin LLM todavía, eso es v3.

Probado en vivo contra la liga real de Alex ("Dominators Dinasty", 6 temporadas, League ID `1342746115425964032`).

**Stat cards compartibles** también shipped sobre v1 (`public/cards.js`, `public/vendor/html-to-image.js`): 4 tipos de card (GOAT, H2H, resumen de temporada, narrativa individual), generadas en cliente con `html-to-image` (card renderizada a 320px, exportada a `pixelRatio: 3` para ~1080px real) y compartidas vía Web Share API con fallback a descarga en desktop. Se activan haciendo clic directo sobre la fila/celda/card correspondiente en la UI existente (sin controles nuevos separados). `html-to-image` está vendored localmente en `public/vendor/` (no es dependencia de npm — solo se usó para extraer el build UMD), para no depender de un CDN en runtime.

**v2 fase 1 shipped** — dos narrativas nuevas a nivel jugador en `computeNarratives` (v. `computePlayerNarratives` en `lib/sleeper.js`): "La Actuación del Año" (mejor semana individual de un titular en la historia de la liga) y "El Peor Banquillo" (mayor diferencia de puntos entre el titular más flojo y el banca más productivo de una misma semana, mínimo 5 pts para filtrar casos triviales). Ambas usan `players_points`/`starters` que Sleeper ya regresa en cada matchup — **sin ninguna API externa todavía**, ese fue el hallazgo clave: el cruce con ESPN/nfl.com solo hace falta para enriquecer con stat lines reales (yardas, TDs), no para la mecánica base. Nombres de jugadores vía `getPlayersMap()` (dump completo `/v1/players/nfl` de Sleeper, ~5MB, cacheado una sola vez por proceso — es data global, no por liga). Cero cambios en frontend: las cards y la lista de narrativas son genéricas sobre `{icon, title, headline, detail}`, así que las nuevas narrativas aparecen y son compartibles automáticamente.

Verificado en vivo: encontró que a `alexortizotero` le anotó la defensa de Dallas (1.0 pts) mientras tenía a De'Von Achane (49.3 pts) en la banca (semana 3, 2023) — 48.3 puntos perdidos por la alineación.

**v2 fase 2 shipped** — `lib/espn.js`: cruce con la API no oficial de ESPN (`site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_id}/gamelog?season={year}`, sin auth) vía el `espn_id` que ya trae el dump de jugadores de Sleeper. Enriquece "La Actuación del Año" y "El Peor Banquillo" con el stat line real de esa semana (ej. "Rushing: 32 CAR, 185 YDS, 4 TD") en vez de solo puntos fantasy. Verificado a mano contra un box score real (Jonathan Taylor, semana 11 2021 vs. Buffalo — 32 acarreos, 185 yardas, 4 TDs terrestres, coincide exacto con espn.com). Cachea el game log completo por `espnId:season` indefinidamente (mismo criterio "sin TTL" que el resto del proyecto — un box score pasado no cambia).

Falla con gracia cuando ESPN no tiene el dato: equipos de defensa (ej. "Dallas Cowboys") no son "athletes" reales en ESPN, y no todos los jugadores traen `espn_id` poblado en el dump de Sleeper (De'Von Achane no lo tenía al momento de probar) — en esos casos la narrativa simplemente se queda en solo-puntos, sin romper nada.

**En vivo:** [storyofmyleague.com](https://storyofmyleague.com) — deploy vía Coolify (self-hosted, VPS propio de Alex) usando `v1/Dockerfile` (Base Directory `/v1`, sin Nixpacks). DNS en GoDaddy (registro A en `@` apuntando al servidor, `www` como CNAME al root). SSL automático vía Let's Encrypt (lo maneja Coolify solo). Sleeper, ESPN y FantasyCalc son APIs públicas sin auth — la única variable de entorno que existe en el proyecto es `ANTHROPIC_API_KEY` (v3, opcional — ver abajo), configurada en las variables de entorno de la app en Coolify.

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

**i18n shipped (inglés por default, español opcional)** — toggle EN/ES en la esquina superior del header, persistido en `localStorage` (`fli:lang`), sin scope por liga (es una preferencia global, a diferencia de "mi equipo"). Dos capas separadas:

- **UI estática y contenido dinámico del cliente** (`public/i18n.js`): diccionario plano `{en: {...}, es: {...}}` con un helper `t(key, ...args)` — soporta tanto strings simples como funciones para las que llevan datos interpolados (ej. `seasonSummary(season, n)`). Markup estático se traduce vía atributos `data-i18n`/`data-i18n-placeholder`; el HTML generado dinámicamente (`app.js`, `cards.js`, `myteam.js`) llama `t()` directo al construir cada string.
- **Narrativas del servidor** (`lib/sleeper.js`): las 9 narrativas de liga (`computeNarratives`, `computePlayerNarratives`, `computeDraftNarratives`, `computeTradeNarratives`) ahora reciben un parámetro `lang` y usan un helper local `tr(en, es)` en cada `title`/`headline`/`detail` — no es un dato-separado-de-presentación, sigue siendo texto ya armado, pero bilingüe. `server.js` lee `?lang=` del query string (default `"en"`) y lo pasa hacia abajo; el frontend re-fetchea `/api/league/:id?lang=xx` completo cada vez que cambias de idioma (no solo swapea texto client-side), porque las narrativas viven en el servidor.
- Los stat lines de ESPN (`lib/espn.js`, ej. "Rushing: 32 CAR, 185 YDS") se quedan en inglés siempre — vienen tal cual de la API de ESPN, que no ofrece labels en español. Es una inconsistencia menor y aceptada, no vale la pena parchearla.

Bug real encontrado y arreglado en el camino (van dos veces con el mismo patrón): `app.js` y `myteam.js` declaraban ambos `let currentLeagueId` a nivel superior — misma colisión de scope léxico global entre `<script>` clásicos que ya nos había pasado con `currentData` en `cards.js`/`myteam.js`. Renombrado a `activeLeagueId` en `app.js`. **Nota para el futuro:** cualquier variable nueva a nivel superior en estos archivos debe revisarse contra las demás antes de nombrarla — no hay aislamiento de módulos aquí.

**Design system pulled + aplicado (v1.1 visual)** — Alex trajo un design-system reference (`Story of My League - Design System.dc.html` + zip en la raíz del repo, generado por una herramienta externa con sync a GitHub) que extrajo los tokens del CSS ya shippeado y además propuso componentes nuevos mapeados a los huecos del roadmap (v3/v4 marcados como "gap" en su propio audit). Se aplicó todo excepto lo directamente atado a v2 (ya shippeado, no se tocó) y v3 (AI-tag — no aplica, no hay contenido de IA todavía que etiquetar).

- **Consistencia de tokens:** radios normalizados a 3 valores (`--radius-control` 8px / `--radius-card` 12px / `--radius-pill` 20px — antes había 5 valores distintos sin razón), H1 explícito a 34px/800, focus ring (glow de accent al 25%) + estado de error real en el input de League ID (rojo — el único lugar donde se usa ese color en toda la app, nunca para pérdidas/stats negativos).
- **Modo claro** (`public/theme.js`): toggle 🌙/☀️ junto al de idioma, tokens exactos del doc (`#f7f8fa`/`#fff`/`#1a1d24`/`#00a05a`), default a preferencia del SO, persistido en localStorage, aplicado antes del primer paint (script inline en `<head>`) para evitar flash del tema incorrecto. Las stat cards compartibles quedaron deliberadamente **fuera** del theming — son un asset de marca (se comparten a WhatsApp/Instagram), así que `.stat-card` sombrea los tokens de la página con valores oscuros fijos sin importar el tema activo.
- **Onboarding coachmark:** burbuja sólida de accent (única vez que se usa fill sólido en vez de tinte) mostrando "toca una fila para compartir", una sola vez vía localStorage, se descarta sola al hacer clic en cualquier `data-card`.
- **6 secciones nuevas:** Trophy Case (campeón/subcampeón/más puntos/cuchara de palo por temporada — subcampeón requirió cachear el bracket completo en vez de solo el ganador), Playoff Bracket (árbol texto-y-líneas de la temporada actual), Power Rankings (ranking semana-a-semana que combina posición en standings + posición en puntos, con flechas de movimiento — rojo desaturado es el único otro lugar con color no-accent, y es explícitamente distinto del rojo de error), Season Trend (sparkline SVG de puntos por semana, sin librería de charts), Luck Index (récord "all-play" esperado vs. real — comparando cada semana contra *todos* los rivales, no solo el oponente real — mismo shell visual que una narrativa, "es una historia de datos, no un componente nuevo"), y Trade Tracker (lista completa de trades, no solo el más lopsided — `computeTradeNarratives` se refactorizó para compartir el mismo collector, y las transacciones ahora tienen su propia cache igual que los matchups).
- **Weekly Awards Row del doc NO se construyó tal cual:** "Closest Call" ya existía (duplicaba Partido Más Cerrado de Week Recap), "Comeback of the Week" no es construible (Sleeper no da progreso in-game, solo score final) — en vez de eso se agregó "🪑 Bench Blunder" como 3er callout dentro de Week Recap (mismo mecanismo que "El Peor Banquillo" pero acotado a la última semana jugada, reusa los matchups ya fetcheados).
- Bug real encontrado en el camino: para una temporada sin empezar, Sleeper pre-genera los matchups de todas las semanas con `matchup_id` real pero `points: 0` — el helper compartido de Season Trend/Luck Index/Power Rankings los contaba como "semanas jugadas" (mostraba 13 semanas de 0-0 para la liga 2026 que ni ha arrancado). Mismo criterio que ya se había resuelto para Week Recap (exigir `points > 0`, no solo `matchup_id`), aplicado también aquí.

**Branding movido al dominio** — las 5 referencias a "Fantasy League Intelligence" en la app (title, H1, footer de las stat cards, título del Web Share, log de arranque) ahora dicen `www.storyofmyleague.com`, a pedido explícito de Alex — las stat cards son la razón principal, ese footer viaja con la imagen a donde sea que se comparta.

**SEO audit + quick wins shipped** (vía `/marketing:seo-audit`) — el sitio no tenía meta description, Open Graph, robots.txt, sitemap.xml, favicon, structured data, ni contenido estático indexable (SPA: todo el contenido real requiere JS + interacción). Se agregaron los 6: meta description + OG/Twitter tags + canonical, JSON-LD `WebApplication`, favicon vía data-URI del emoji 🏈 (sin asset nuevo), `robots.txt`/`sitemap.xml`, y una sección `#about-section` con copy estático (siempre visible, no depende de JS) listando las features — le da a los crawlers y a visitantes fríos algo real que leer antes de meter un League ID.

**Nota de diseño:** el `<title>` del `<head>` SÍ quedó distinto del H1 — el H1 sigue diciendo literalmente "www.storyofmyleague.com" (como pidió Alex), pero el `<title>` (lo que ve Google/la pestaña) es "Story of My League — Fantasy Football League History, Stats & GOAT Tracker", con keywords, porque un `<title>` que es solo el dominio pelón es activamente malo para SEO/CTR. Son dos elementos con trabajos distintos, no una contradicción de la instrucción original.

**Pendiente, no bloqueante:** `og:image`/`twitter:image` no se agregaron — no hay un asset de preview real todavía (requeriría generar una imagen estática, y el proyecto evita agregar Puppeteer/headless-browser al servidor a propósito). Investigar Search Console una vez que el dominio esté indexado.

**v3 (capa de AI) fase 1 shipped — análisis de trades on-demand con Claude** — botón "🤖 Analizar con IA" en cada fila del Trade Tracker que llama a Claude Haiku 4.5 (`lib/claude.js`) para generar un veredicto en lenguaje natural de quién ganó el trade, usando *solo* los mismos datos de puntos-producidos que ya calcula `collectTrades` (el prompt no inventa contexto que no le dimos — lesiones, motivos, etc.). Decisión deliberada de modelo: Haiku 4.5 en vez de un modelo más caro, porque el volumen es bajísimo (análisis bajo demanda, no en cada carga de página) — el costo por narrativa es fracciones de centavo incluso con un modelo más grande, pero Haiku ya es suficiente para un párrafo corto de 3-4 oraciones.

- **On-demand, no generado para cada trade al cargar la página** — es una llamada pagada por trade, así que solo se genera cuando el usuario hace clic. Resultado cacheado en memoria (`Map`, mismo criterio "sin TTL" que el resto de `lib/sleeper.js` — un trade ya jugado no cambia de valor) para que recargar la página o volver a hacer clic no vuelva a facturar.
- **Endpoint `POST /api/trade-analysis`** en `server.js`: valida forma/longitud del payload (no confía en el cliente — este endpoint le pega directo a Claude y no tiene rate-limiting, así que se limitan tipos, longitudes de string y rango de semana antes de construir el prompt).
- **Degrada con gracia sin `ANTHROPIC_API_KEY`**: `lib/claude.js` regresa un error tipado (`AI_NOT_CONFIGURED`) que el endpoint traduce a 503 con mensaje bilingüe — el resto de la app funciona igual sin la key, la IA simplemente no está disponible.
- Verificado en vivo por Alex corriendo el server local con su propia key (`node server.js` + `$env:ANTHROPIC_API_KEY`) contra la liga real — narrativa coherente, botón se reemplaza por el resultado tras generarse, funciona en ambos idiomas.

**Trade Tracker: limitado a los últimos 5, con scope por equipo** — mismo día, extensión pedida sobre el feature anterior. Antes mostraba el historial completo de trades; ahora muestra los 5 más recientes de toda la liga por default, o los 5 más recientes que involucran al manager seleccionado en "Mi equipo" (si cualquiera de los dos lados del trade es ese manager). 100% client-side, reusa `data.tradeTracker` ya cargado — mismo espíritu que las rivalidades personalizadas (ningún llamado nuevo al API). `computeTradeTracker` ahora expone `ownerId` en `sideA`/`sideB` (antes solo mandaba `displayName`) para que el frontend pueda filtrar. `myteam.js` dispara `window.renderTradeTracker(ownerId, displayName)` desde `applyHighlight()` cada vez que cambia la selección, reusando el `displayName` que esa función ya resuelve — un hint arriba de la lista ("Últimos 5 trades de [equipo]" / "Last 5 league trades") deja claro qué se está mostrando.

**Valor de Roster shipped (`lib/fantasycalc.js`)** — nueva sección "💰 Roster Value": valor de trade dynasty actual de cada roster, desglosado por posición (QB/RB/WR/TE) y comparable entre managers (ordenado por valor total descendente, a diferencia de Profundidad de Roster que no tiene un orden natural). Fuente: `api.fantasycalc.com/values/current`, API pública sin auth — investigado antes de usarla porque KeepTradeCut (la alternativa más conocida) prohíbe explícitamente el scraping en su ToS, mientras que FantasyCalc no tiene esa restricción y su propio fundador publicó un tutorial enseñando a consumir la API, señal de que es de uso público intencional. FantasyPros tampoco sirvió: su API oficial (con key) no incluye el trade value chart, solo rankings/proyecciones/ADP.

- **Match limpio vía `sleeperId`**: cada entrada de FantasyCalc ya trae el `sleeperId` del jugador, así que no hace falta fuzzy-matching de nombres entre plataformas (el riesgo real de este tipo de integración) — se cruza directo contra `roster.players`.
- **`numQbs`/`numTeams`/`ppr` derivados de la liga real**, no hardcodeados — importa mucho: un QB en Superflex vale ~2x lo que vale en 1QB. `numQbs` se deriva de `roster_positions` (cuenta slots `"QB"`, +1 si hay `"SUPER_FLEX"`), `ppr` de `scoring_settings.rec`, `numTeams` de `total_rosters`. Verificado en vivo contra la liga real (Superflex, half-PPR, 10 equipos): Josh Allen pasa de 5291 a 9974 puntos de valor entre 1QB y Superflex — la diferencia esperada.
- **Única fuente de datos del proyecto con TTL** (12h) — a diferencia del resto de `lib/sleeper.js` (cache sin TTL, es historia inmutable), los valores de trade sí cambian semana a semana.
- **Degrada con gracia**: si FantasyCalc no responde, `computeRosterValue` regresa `null` y la sección simplemente no se muestra (mismo patrón que ESPN en v2), no rompe el resto de la carga de la liga.
- Reusa `data-owner-id` de "Mi equipo" para resaltarse solo. Verificado en vivo: máximos por columna y orden por valor total coinciden con los datos crudos de la API.

**Próximo paso:** reporte de puntos proyectados vs. reales por posición (con splits titulares / titulares+banca / titular+backup principal) — 100% Sleeper, ya se confirmó que existe `api.sleeper.com/projections/nfl/{season}/{week}` con el mismo shape que los puntos reales que ya usa el proyecto. Sin empezar todavía.

## Notas

_Este archivo se debe actualizar a mano con decisiones y contexto duradero del proyecto. El progreso sesión a sesión se guarda automáticamente en el sistema de memoria de Claude Code cuando la sesión se abre con esta carpeta como directorio de trabajo._
