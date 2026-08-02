# Fantasy League Intelligence

🇬🇧 [Read this in English](README.md)

Herramienta de analítica de fantasy football que arranca como una integración simple de API y va creciendo, versión por versión, hasta convertirse en un agente con IA — cada versión es un salto deliberado de complejidad técnica, construido como registro público de esa progresión.

**[→ v1 ya está funcionando: standings, historial de enfrentamientos, ranking GOAT, e historias generadas automáticamente](v1/)**

## El arco

Cada versión agrega un tipo de integración genuinamente distinto, no solo más features sobre el mismo stack:

| Versión | Agrega | Demuestra |
|---|---|---|
| **v1 — API Integration** ✅ | Integración con la [API de Sleeper](https://docs.sleeper.com/): standings históricos, récord head-to-head a través de todas las temporadas, ranking GOAT (con campeonatos, no solo récord), e historias generadas automáticamente ("mejor récord regular de la historia de la liga, cero campeonatos") | Consumo de REST APIs, modelado de datos JSON, un frontend real |
| **v2 — Multi-source data** | Cruzar los player IDs de Sleeper con una API de stats de NFL (ESPN / nfl.com no oficial) para enriquecer datos de jugadores con stats reales | Integración multi-API, normalización de datos entre plataformas |
| **v3 — Capa de IA** | Claude API genera análisis de trades en lenguaje natural ("este trade históricamente beneficia al equipo A porque...") | Integración de LLMs, prompt engineering, combinar datos estructurados con razonamiento de IA |
| **v4 — Notificaciones** | Webhooks a Discord/Slack para trades, waivers relevantes, y alertas de jugadores en tendencia | Integraciones event-driven, webhooks, APIs de plataformas de mensajería |
| **v5 — Capa MCP / agéntica** | Todo el proyecto se convierte en su propio servidor MCP, para que cualquier agente de IA pueda consultar el estado de la liga en lenguaje natural | Arquitectura de agentes, MCP, el ciclo completo de construir una herramienta agéntica |

## Lo destacado de v1

- **Ranking GOAT con campeonatos primero** — el mejor récord de temporada regular no te hace automáticamente "el mejor manager de la historia." Un manager puede tener el mejor porcentaje de victorias de la liga y quedar *por debajo* de alguien con menos victorias pero varios títulos. El ranking refleja eso a propósito.
- **Matriz de head-to-head**, no una lista plana — la forma estándar para este tipo de dato, con encabezados de columna abreviados a prueba de colisiones (dos managers cuyo nombre empieza con las mismas tres letras no terminan con columnas idénticas y ambiguas).
- **Historias generadas automáticamente** — un pequeño motor de reglas convierte estadísticas crudas en historias reales ("La Maldición": mejor récord de la historia, cero anillos; "El Verdugo": la rivalidad más desigual de la liga) sin necesitar todavía un LLM — para eso está v3.
- Cada request se resuelve en paralelo (no secuencial) contra la API de Sleeper, con cache en memoria para no volver a pedir los rosters/matchups de la misma liga tres veces por carga de página.

## Stack (v1)

Node.js + Express, frontend en JS/HTML/CSS plano (sin framework todavía, a propósito — v1 es sobre la integración de API, no sobre la capa de UI). Sin autenticación: la API de Sleeper es completamente pública y de solo lectura.

## Estado

v1 lanzado y corriendo contra una liga dinasty real de 6 temporadas. v2 en adelante, sin empezar todavía.
