# Fantasy League Intelligence

🇬🇧 [Read this in English](README.md)

Herramienta de analítica de fantasy football que arranca como una integración simple de API y va creciendo, versión por versión, hasta convertirse en un agente con IA — cada versión es un salto deliberado de complejidad técnica, construido como registro público de esa progresión.

**[🔴 En vivo: storyofmyleague.com](https://www.storyofmyleague.com)** — standings, historial head-to-head, ranking GOAT, historias de jugadores/draft/trades, y stat cards compartibles. Código en [`v1/`](v1/).

**[→ Roadmap de producto: fases de MVP viral, engagement, monetización y escala](ROADMAP.es.md)**

## El arco

Cada versión agrega un tipo de integración genuinamente distinto, no solo más features sobre el mismo stack:

| Versión | Agrega | Demuestra |
|---|---|---|
| **v1 — API Integration** ✅ | Integración con la [API de Sleeper](https://docs.sleeper.com/): standings históricos, récord head-to-head a través de todas las temporadas, ranking GOAT (con campeonatos, no solo récord), e historias generadas automáticamente ("mejor récord regular de la historia de la liga, cero campeonatos") | Consumo de REST APIs, modelado de datos JSON, un frontend real |
| **v2 — Multi-source data** ✅ | Cruza los datos de jugadores/draft/transacciones de Sleeper con la API de stats de ESPN para enriquecer las historias a nivel jugador (mejor semana individual, peor banquillo, mejor/peor pick de draft, trade más desigual) con stat lines reales en vez de solo puntos fantasy | Integración multi-API, normalización de datos entre plataformas |
| **v3 — Capa de IA** | Claude API genera análisis de trades en lenguaje natural ("este trade históricamente beneficia al equipo A porque...") | Integración de LLMs, prompt engineering, combinar datos estructurados con razonamiento de IA |
| **v4 — Notificaciones** | Webhooks a Discord/Slack para trades, waivers relevantes, y alertas de jugadores en tendencia | Integraciones event-driven, webhooks, APIs de plataformas de mensajería |
| **v5 — Capa MCP / agéntica** | Todo el proyecto se convierte en su propio servidor MCP, para que cualquier agente de IA pueda consultar el estado de la liga en lenguaje natural | Arquitectura de agentes, MCP, el ciclo completo de construir una herramienta agéntica |

## Lo destacado

- **Ranking GOAT con campeonatos primero** — el mejor récord de temporada regular no te hace automáticamente "el mejor manager de la historia." Un manager puede tener el mejor porcentaje de victorias de la liga y quedar *por debajo* de alguien con menos victorias pero varios títulos. El ranking refleja eso a propósito.
- **Matriz de head-to-head**, no una lista plana — la forma estándar para este tipo de dato, con encabezados de columna abreviados a prueba de colisiones (dos managers cuyo nombre empieza con las mismas tres letras no terminan con columnas idénticas y ambiguas).
- **9 narrativas automáticas de liga** — un motor de reglas convierte estadísticas crudas en historias reales ("La Maldición": mejor récord de la historia, cero anillos; "El Verdugo": la rivalidad más desigual de la liga; "El Robo del Draft", "El Trade Más Lopsided", etc.) sin necesitar todavía un LLM — para eso está v3. Las que son a nivel jugador vienen enriquecidas con stat lines reales de ESPN ("Rushing: 32 CAR, 185 YDS, 4 TD").
- **Stat cards compartibles** — cualquier fila/celda de la app (GOAT, H2H, una temporada, una narrativa, un trofeo) se renderiza a PNG del lado del cliente y se comparte vía Web Share API, sin ida y vuelta al servidor.
- **Herramientas de roster** — profundidad por posición y capital neto de draft por manager, para saber a quién ofrecerle un trade.
- **Vitrina de Trofeos, Bracket de Playoffs, Power Rankings, Tendencia de Temporada, Índice de Suerte (récord all-play esperado), Historial de Trades** — una segunda capa completa de historia/análisis más allá del roadmap base, construida contra una liga dinasty real de 6 temporadas.
- **Toggle inglés/español** (default inglés) y tema claro/oscuro, ambos persistidos del lado del cliente, ambos cubriendo también el texto de las narrativas generadas en el servidor, no solo el chrome de la UI.
- Cada request se resuelve en paralelo (no secuencial) contra la API de Sleeper, con cache en memoria para no volver a pedir los rosters/matchups de la misma liga tres veces por carga de página.

## Stack

Node.js + Express, frontend en JS/HTML/CSS plano (sin framework, a propósito — el punto de v1 era la integración de API, no un framework de UI, y así se quedó). Sin autenticación: la API de Sleeper es completamente pública y de solo lectura.

## Estado

v1 y v2 lanzados y en vivo en [storyofmyleague.com](https://www.storyofmyleague.com), corriendo contra una liga dinasty real de 6 temporadas. v3 (capa de IA) es lo siguiente, sin empezar todavía.
