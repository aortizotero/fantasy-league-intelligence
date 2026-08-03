# 🏈 Roadmap de Producto: Plataforma de Analítica Fantasy para Sleeper

🇬🇧 [Ver en inglés](ROADMAP.md)

Un plan por fases para diseñar, desarrollar y monetizar una herramienta web interactiva orientada al ecosistema de ligas de **Sleeper**, priorizando la viralidad, la experiencia de usuario (UI/UX) y múltiples flujos de ingresos.

---

```
[ Fase 1: MVP Viral ] ➔ [ Fase 2: Engagement ] ➔ [ Fase 3: Monetización ] ➔ [ Fase 4: Escala ]
(Agosto - Sept)          (Octubre - Nov)         (Pretemporada/Lanzamiento)    (Expansión)
```

---

## 🔎 Evaluación del roadmap

**Lo que funciona bien:**
- El loop viral está bien pensado: cero fricción de registro en Fase 1 + cards exportables para el chat de liga es el canal de distribución correcto (Sleeper no tiene su propio feed social, así que el chat de liga *es* el feed).
- La secuencia de monetización es sana: primero tráfico (afiliados DFS de bajo esfuerzo), luego retención (recap semanal), y solo *después* pides tarjeta de crédito (Fase 3). Cobrar antes de demostrar valor recurrente mataría la adopción.
- v1 de este repo ya resuelve parte de la Fase 1 (fetch paralelo + cache en memoria contra la API de Sleeper), así que la "Sincronización Ultra Rápida" no arranca de cero.

**Riesgos y huecos a corregir:**
1. **Localización en Fase 4 es tarde.** Si el diferenciador clave es "100% en español para LatAm/México/España", ese es un valor de Fase 1, no un lujo de expansión — compite directo con ESPN/Yahoo/Sleeper mismo, que son 100% en inglés. Recomendación: UI en español desde el MVP; Fase 4 pasa a ser *más* idiomas (portugués para Brasil, etc.), no el primero.
2. **VORP y proyecciones necesitan una fuente de datos que Sleeper no da.** La API de Sleeper no expone proyecciones de jugadores — el Draft Assistant (Fase 3) y cualquier ranking "más fuerte/más débil" necesitan un segundo proveedor (FantasyPros, ESPN no oficial). Esto ya está contemplado como v2 en el roadmap técnico del repo ("Multi-source data") — hay que jalarlo antes de comprometer el Draft Assistant a Fase 3.
3. **El draft en vivo de Sleeper no tiene websocket público.** El "Live Draft Assistant" tendría que hacer *polling* agresivo al endpoint de picks durante el draft, no push en tiempo real. Vale la pena dimensionarlo como riesgo técnico antes de venderlo como pase pago.
4. **CTAs de afiliados DFS en Fase 1 pueden chocar con la promesa de "cero fricción".** Mejor como banner discreto o slot en la card exportada, nunca como interstitial.
5. **Falta un gancho de retención entre semanas** (no solo el recap post-jornada): alertas de waiver deadline / lineup lock son baratas de construir y dan una razón para volver *antes* de que empiece la semana, no solo después.

---

## 🎨 Fase 1: MVP & Hook Viral (Sincronización + Reportes Sociales)
> **Objetivo:** Captar tráfico masivo sin fricción de registro y fomentar la difusión orgánica en chats de liga.

### 1. Sincronización Ultra Rápida (Sleeper API)
* Consulta directa a la API pública de Sleeper mediante `username` o `league_id`.
* Detección automática del formato de liga: **Redraft**, **Dynasty**, **Superflex**, **PPR**, **TE Premium** y **IDP**.
* UI 100% en español desde el día uno (movido desde Fase 4 — ver Evaluación).

### 2. Generador de Cards & Reportes para Chats de Liga (El Hook Social)
* **Power Rankings Visuales:** Tarjetas gráficas modernas, limpias y listas para exportar en formato PNG/JPG.
* **Métrica de "Suerte" (Luck Index):** Comparativa entre el récord real vs. el récord esperado si el equipo se hubiera enfrentado a todos los rivales cada semana.
* **🆕 Proyección de récord de temporada:** al estilo del widget que traía la app oficial de la NFL — con el calendario restante de cada equipo, proyecta el récord final probable de fin de temporada (basado en fuerza de rival y desempeño reciente). Comparte tabla con la Luck Index pero mira hacia adelante en vez de hacia atrás.
* **Botonera de Compartir:** Integración de copiar al portapapeles en 1 solo clic para pegar la imagen o enlace directamente en la app de Sleeper.

### 3. Monetización Básica Integrada
* Enlaces y llamadas a la acción (*CTA*) contextuales con códigos de **afiliados DFS** (*Underdog Fantasy*, *PrizePicks*, *Sleeper Picks*), en formato discreto (no intersticial).

---

## 📊 Fase 2: Engagement y Analítica Semanal
> **Objetivo:** Convertir visitas casuales en usuarios recurrentes cada semana durante la temporada regular de la NFL.

### 1. Evaluador de Rosters & Salud del Equipo
* Diagnóstico de balance por posición (Puntos fuertes, debilidades y profundidad de banca).
* Clasificación automática de la ventana de competencia: **Contender** (Candidato al título) vs. **Rebuilder** (En reestructuración).
* **🆕 Ranking de fuerza/debilidad por posición a nivel liga:** no solo "¿cómo está mi equipo?", sino "¿quién es el más fuerte y el más débil de la liga en QB/RB/WR/TE?" — la vista comparativa entre los N equipos de la liga, posición por posición.
* **🆕 Buscador de excedentes por posición:** dado que quieres reforzar una posición (ej. RB), la herramienta identifica qué equipo(s) de la liga tienen sobreoferta ahí (profundidad de banca por encima del umbral de titular) — el punto de partida natural para salir a negociar.

### 2. Módulo de Transacciones (Trade Analyzer)
* Calculadora de *trades* ajustada según los parámetros específicos de anotación (*scoring settings*) de la liga.
* Evaluación de **Rookie Picks futuros** (indispensable para ligas Dynasty).
* **🆕 Generador de propuesta de trade ideal:** seleccionas un jugador del roster de otro equipo que quieres conseguir, y el motor arma automáticamente una propuesta balanceada usando tus propios activos (jugadores + picks), basada en valor y necesidad de ambos rosters — conecta directo con el buscador de excedentes de arriba.

### 3. Reporte de Recap Semanal (Matchup Recap)
* Generación de contenido "social":
  * *El error de alineación de la semana* (puntos dejados en la banca).
  * *La paliza de la jornada*.
  * *El MVP de la semana*.
* **🆕 Alertas de "antes de la jornada":** recordatorio de waiver deadline y de alineaciones incompletas/con jugador en bye, para dar una razón de volver *antes* del kickoff, no solo un recap después.

---

## 💳 Fase 3: Arquitectura Pro & Monetización Directa
> **Objetivo:** Implementar pasarelas de pago y funciones avanzadas antes del pico de drafts de la temporada.

### 1. Infraestructura de Usuarios & Pagos
* Autenticación ligera (Email, Google Sign-In) para guardar ligas favoritas y preferencias.
* Integración de pasarela de pagos con **Stripe** para suscripciones recurrentes y cobros únicos.

### 2. Módulo Pro: Live Draft Assistant (Pago Único / Pase Anual)
* Tablero interactivo sincronizado en tiempo real durante el *Draft* en vivo de Sleeper (vía *polling* al endpoint de picks — Sleeper no expone websocket público de draft, dimensionar la frecuencia de polling con cuidado).
* Sugerencias de selección turno a turno basadas en **VORP** (*Value Over Replacement Player*) y necesidades del *roster* — requiere una fuente externa de proyecciones (ver punto 2 de la Evaluación).

### 3. Módulo Pro: Multi-League Dashboard (Suscripción Mensual)
* Dashboard consolidado para usuarios *hardcore* que gestionan 5, 10 o más ligas simultáneamente.
* Vista unificada de agentes libres (*Waiver Wire*) y alertas de alineación incompleta entre todas las ligas.

---

## 🚀 Fase 4: Escala, Internacionalización y Alianzas
> **Objetivo:** Posicionar la plataforma como la herramienta de referencia en el mercado hispanohablante y crear alianzas.

### 1. Localización Adicional
* Expansión a más variantes/idiomas (ej. portugués para Brasil) — el español ya es nativo desde la Fase 1.

### 2. Exportador para Creadores de Contenido
* Módulo para que podcasters, analistas y *commissioners* generen reportes personalizados con el logotipo de sus proyectos o ligas.

### 3. Patrocinio Directo de Módulos
* Venta de espacios de patrocinio discreto en la interfaz (ej. *"Calculadora de Trades presentada por [Marca]"*).

---

## 🛠️ Stack Tecnológico Recomendado

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend** | Next.js / React + Tailwind CSS | Interfaz ultra rápida, responsiva y optimizada para móviles. |
| **Generación Visual** | `@vercel/og` / `html-to-image` | Conversión de componentes React a imágenes exportables al instante. |
| **Backend & DB** | Node.js + Supabase / Firebase | Autenticación ligera y almacenamiento de perfiles/ligas. |
| **Pasarela de Pagos** | Stripe API | Gestión de suscripciones Pro y venta de pases de temporada. |
| **Fuente de Datos** | Sleeper API (`api.sleeper.app`) | Consumo de datos de ligas, plantillas, transacciones y borrador. |
| **Fuente de Proyecciones** | FantasyPros / ESPN (no oficial) | Necesaria para VORP, ranking de fuerza por posición y proyección de récord — Sleeper no expone proyecciones. |

---

## 💡 Ideas incorporadas de la retro con Chafi

| Idea original | Dónde quedó |
| :--- | :--- |
| "Arma la proyección del récord de la temporada como en la app de NFL" | Fase 1 → Generador de Cards, *Proyección de récord de temporada* |
| "¿Quién está más fuerte y más débil en cada posición?" | Fase 2 → Evaluador de Rosters, *Ranking de fuerza/debilidad por posición a nivel liga* |
| "A quién le sobran corredores (o cualquier posición), para buscarlo" | Fase 2 → Evaluador de Rosters, *Buscador de excedentes por posición* |
| "Poner un jugador del otro equipo y que arme una propuesta de trade ideal" | Fase 2 → Trade Analyzer, *Generador de propuesta de trade ideal* |
