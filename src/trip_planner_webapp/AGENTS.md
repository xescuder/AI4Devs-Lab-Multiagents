# Arquitectura Multi-Agente — Trip Planner

## Resumen

El sistema utiliza **CrewAI** para orquestar 6 agentes especializados que planifican un viaje completo de forma colaborativa, con intervención humana (HITL) en cada fase crítica.

---

## Patrón de Orquestación: Secuencial con HITL

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROCESO SECUENCIAL (CrewAI)                       │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  Flight  │───▶│  Blog    │───▶│  Route   │───▶│Accommodation │  │
│  │ Specialist│   │  Reader  │    │ Planner  │    │   Curator    │  │
│  └────┬─────┘    └──────────┘    └────┬─────┘    └──────┬───────┘  │
│       │ HITL                          │ HITL            │ HITL     │
│       ▼                               ▼                 ▼          │
│  ┌──────────┐                                     ┌──────────────┐ │
│  │Transport │◀────────────────────────────────────│  Coordinator │ │
│  │Coordinator│                                    │ (Compilation)│ │
│  └────┬─────┘                                     └──────────────┘ │
│       │ HITL                                                        │
└───────┼─────────────────────────────────────────────────────────────┘
        ▼
   ✅ Plan completo
```

**Patrón elegido: `Process.sequential`**

Cada tarea se ejecuta una tras otra. La salida de una tarea alimenta el contexto de las siguientes. Esto garantiza que:
- Los vuelos aprobados definen las fechas reales del itinerario
- El itinerario aprobado define las zonas de alojamiento
- El transporte se adapta a los horarios de vuelo + ruta del itinerario

---

## Patrones de Diseño Aplicados

### 1. Pipeline Secuencial con Dependencias de Contexto

```
flight_task ──────────┐
                      ├──▶ route_plan_task ──▶ accommodation_task
blog_read_task ───────┘          │
                                 └──────────▶ transport_task
                                                    │
flight_task + route_plan_task + accommodation_task + transport_task
                                 │
                                 └──▶ trip_compilation_task
```

Cada tarea declara su `context=[]` explícitamente:
- `route_plan_task` recibe: vuelos aprobados + blogs leídos
- `accommodation_task` recibe: itinerario aprobado (overnight_zones)
- `transport_task` recibe: vuelos + itinerario (fechas y ruta)
- `compilation_task` recibe: todo lo anterior

### 2. Human-In-The-Loop (HITL)

**Patrón**: Aprobación humana entre fases críticas.

4 de las 6 tareas tienen `human_input: true`. Cuando una tarea genera su propuesta:
1. El backend envía la propuesta al frontend vía WebSocket
2. El usuario puede **aprobar** o **pedir cambios**
3. Si pide cambios, el agente re-ejecuta con el feedback como contexto adicional
4. Solo cuando se aprueba, la siguiente tarea comienza

Esto implementa un **loop de refinamiento** dentro de cada paso:
```
Agente genera → Usuario revisa → [Aprobado] → Siguiente tarea
                     ↑                ↓
                     └── [Cambios] ──→ Agente re-ejecuta
```

### 3. Especialización de Agentes (Single Responsibility)

Cada agente tiene un rol único con herramientas específicas:

| Agente | Rol | Herramientas |
|--------|-----|-------------|
| Flight Specialist | Buscar vuelos reales | `crawl_kayak_flights` |
| Blog Reader | Investigar itinerarios en blogs/PDFs | `search_itinerary_blogs`, `crawl_itinerary_blog`, `extract_pdf_content` |
| Route Planner | Organizar actividades en timetable | `web_search` |
| Accommodation Curator | Buscar alojamientos por zona | `search_accommodation`, `crawl_airbnb`, `web_search` |
| Transport Coordinator | Buscar alquiler de coches | `search_rentalcars` |
| Trip Coordinator | Compilar plan final | `web_search` |

### 4. Delegación Controlada

- `allow_delegation: false` en todos los especialistas (evita loops infinitos)
- `allow_delegation: true` solo en el Coordinator (puede pedir a otros que rehagan algo)

### 5. Sub-Pipeline de Investigación (Fan-out / Merge)

El itinerario usa un patrón de **investigación → síntesis**:

```
[Búsqueda Google] ──▶ [Crawl Blog 1] ──┐
                      [Crawl Blog 2] ──┼──▶ [Route Planner combina todo]
                      [PDF Extract]  ──┘
```

El Blog Reader hace fan-out (múltiples crawls) y produce un JSON consolidado. El Route Planner consume ese JSON + los vuelos y produce el itinerario final.

### 6. Zona-Based Deduplication (Alojamientos)

En lugar de buscar alojamiento para cada noche individualmente (N búsquedas paralelas que colgaban), se aplica:
1. Extraer zonas únicas del itinerario (`overnight_zone`)
2. Buscar UNA vez por zona
3. Reutilizar resultados para noches consecutivas en la misma zona

Esto convierte N llamadas paralelas (propensas a timeout) en M llamadas secuenciales (M << N).

---

## Agentes — Detalle

### 1. Especialista en Vuelos (`flight_specialist`)
- **Input**: Origen, destino, fechas, flexibilidad, preferencias horarias
- **Proceso**: Crawl Kayak.es con Playwright, extrae precios reales
- **Output**: JSON con opciones de vuelo (precio, horarios, escalas)
- **HITL**: Usuario selecciona vuelo preferido

### 2. Investigador de Itinerarios (`blog_reader`)
- **Input**: Destino, número de días, PDFs opcionales
- **Proceso**: Busca blogs via Serper API → Crawl con Crawl4AI → Extrae actividades
- **Output**: JSON con actividades organizadas por blog y día
- **HITL**: No (alimenta directamente al Route Planner)

### 3. Planificador de Rutas (`route_planner`)
- **Input**: Vuelos aprobados + actividades de blogs
- **Proceso**: Cura, prioriza, organiza en timetable con drives GPS
- **Output**: JSON con itinerario día a día (actividades, drives, coordenadas)
- **HITL**: Usuario aprueba/modifica itinerario

### 4. Curador de Alojamientos (`airbnb_curator`)
- **Input**: Itinerario aprobado (overnight_zones)
- **Proceso**: Crawl Airbnb por zona única, busca opciones
- **Output**: JSON con opciones por noche
- **HITL**: Usuario selecciona alojamientos

### 5. Coordinador de Transporte (`transport_coordinator`)
- **Input**: Vuelos + itinerario (para fechas de recogida/devolución)
- **Proceso**: Busca precios de alquiler de coches vía Serper
- **Output**: JSON con opciones de vehículo
- **HITL**: Usuario selecciona vehículo

### 6. Coordinador General (`trip_coordinator`)
- **Input**: Todos los resultados aprobados
- **Proceso**: Valida coherencia, calcula presupuesto total
- **Output**: JSON resumen ejecutivo
- **HITL**: No (es la compilación final)

---

## Herramientas (Tools)

### Crawling (Playwright headless)
- **Kayak Flight Crawl**: Renderiza Kayak.es, extrae vuelos con JS
- **Blog Crawl**: Lee blogs de viaje, extrae texto + imágenes
- **Airbnb Crawl**: Busca alojamientos con filtros (precio, amenities)
- **Rentalcars Search**: Busca precios de coches via Google

### Búsqueda (Serper API)
- **Itinerary Blog Search**: Busca blogs con itinerarios (filtro por días)
- **Web Search**: Búsqueda genérica
- **Accommodation Search/Image**: Busca y obtiene imágenes de alojamientos

### Extracción
- **PDF Content Extract**: PyMuPDF para extraer texto de PDFs subidos

### Caché
Todas las herramientas usan caché en disco (`.cache/`) para evitar re-crawls costosos dentro de la misma sesión.

---

## Memoria

El sistema implementa **dos capas de memoria** con propósitos distintos:

### 1. Memoria Persistente de Preferencias (Unified Memory)

```python
# crew.py
user_memory = Memory(
    root_scope="user_preferences",
    storage=str(MEMORY_DIR),        # .memory/ — persiste en disco (LanceDB)
    semantic_weight=0.6,
    recency_weight=0.2,
    importance_weight=0.2,
    recency_half_life_days=90,
)
```

**Qué es**: Memoria persistente entre sesiones que captura preferencias del usuario a partir de su feedback HITL. Usa CrewAI `Memory` (Unified Memory) con LanceDB como backend vectorial en `.memory/`.

**Cómo funciona — Ciclo de aprendizaje**:

```
┌──────────────────────────────────────────────────────────────────┐
│                  CICLO DE PREFERENCIAS                             │
│                                                                   │
│  1. CAPTURA (server.py → HITL feedback)                          │
│     Usuario escribe: "prefiero vuelos matutinos"                  │
│         │                                                         │
│         ▼                                                         │
│     gpt-4o-mini clasifica: ¿es preferencia general?               │
│         │ Sí                                                      │
│         ▼                                                         │
│     memory.remember("prefiero vuelos matutinos",                  │
│                     scope="preference_flight",                    │
│                     importance=0.8)                                │
│                                                                   │
│  2. INYECCIÓN (crew.py → al crear tareas)                        │
│     Al iniciar nueva planificación, por cada tarea HITL:          │
│         │                                                         │
│         ▼                                                         │
│     prefs = memory.recall("preferencias para flight",             │
│                           scope="preference_flight", limit=5)     │
│         │                                                         │
│         ▼                                                         │
│     Se añaden al description de esa tarea:                        │
│     "PREFERENCIAS DEL USUARIO (de viajes anteriores):             │
│      - prefiero vuelos matutinos antes de las 10"                 │
│                                                                   │
│  3. RECALL (server.py → antes de cada propuesta)                 │
│     Antes de enviar propuesta al usuario:                         │
│         │                                                         │
│         ▼                                                         │
│     Log: "🧠 Preferencias recordadas: prefiero vuelos matutinos"  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Clasificación inteligente**: No todo feedback es una preferencia. El sistema usa `gpt-4o-mini` para distinguir:
- ✅ Preferencias generales: "prefiero hoteles céntricos", "no me gustan museos", "busco vuelos directos"
- ❌ Cambios puntuales: "añade la Torre Eiffel", "cambia la fecha al 15", "pon 3 actividades más"

**Señales de recall** (ponderadas):
- `semantic_weight: 0.6` — Prioriza preferencias relevantes al paso actual (vuelos, itinerario, etc.)
- `recency_weight: 0.2` — Decaimiento exponencial (half-life 90 días) — las preferencias no caducan rápido
- `importance_weight: 0.2` — Todas se guardan con importancia alta (0.8)

**Persistencia**: Los datos viven en `.memory/` (LanceDB local). Sobreviven entre sesiones. El usuario acumula un perfil de viajero que mejora con cada planificación.

### 2. Caché de Herramientas (Disco)

```python
# tools/search_tools.py
CACHE_DIR = Path(__file__).parent.parent / ".cache"

TTL_HOURS = {
    "flights": 24,        # Vuelos: 1 día (precios cambian)
    "crawl_flights": 24,
    "car": 24,            # Coches: 1 día
    "activities": 168,    # Actividades: 1 semana
    "itinerary_blogs": 720,  # Blogs: 30 días (contenido estable)
    "crawl_blog": 720,
    "accommodation": 24,  # Alojamientos: 1 día (precios cambian)
    "crawl_airbnb": 24,
}
```

**Qué es**: Caché en disco con TTL (Time-To-Live) por tipo de dato. Cada resultado de herramienta se persiste como JSON en `.cache/` con hash MD5 de la query como nombre.

**Cómo funciona**:
```
Herramienta recibe query
    │
    ├──▶ _cache_get(prefix, query)
    │       └── ¿Existe archivo .cache/{prefix}_{md5}.json?
    │           └── ¿cached_at + TTL > ahora? → Sí → Devolver resultado cacheado
    │                                          → No → Cache expirada
    │
    └── Si no hay cache válida:
        ├── Ejecutar crawl/búsqueda real
        └── _cache_set(prefix, query, result) → Guardar en disco
```

**Para qué sirve**:
- **Rendimiento**: Evita repetir crawls costosos (Kayak tarda ~15s, blogs ~3s)
- **Ahorro de API**: No repite llamadas a Serper (búsquedas Google)
- **Resilencia**: Si el usuario reinicia la planificación con los mismos parámetros, los resultados previos se reutilizan
- **TTL diferenciado**: Datos volátiles (precios) expiran en 24h; datos estables (blogs) duran 30 días

### Comparativa de las dos capas

| | Memoria de Preferencias (CrewAI) | Caché de Herramientas |
|---|---|---|
| **Almacenamiento** | LanceDB vectorial (`.memory/`) | JSON en disco (`.cache/`) |
| **Granularidad** | Preferencias del usuario (conceptos) | Resultados completos de herramienta |
| **Acceso** | Recall semántico al iniciar crew + antes de cada propuesta | Hash exacto antes de ejecutar herramienta |
| **Persistencia** | Permanente entre sesiones (half-life 90 días) | Disco con TTL configurable (1-30 días) |
| **Propósito** | Personalización progresiva del viajero | Evitar re-ejecución costosa |
| **Inteligencia** | LLM clasifica feedback + recall ponderado | Hash MD5 (misma query = cache hit) |

---

## Decisiones de Diseño

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Secuencial (no paralelo) | Agentes en paralelo | Las dependencias de contexto son estrictas (vuelos → itinerario → alojamiento) |
| HITL por WebSocket | Polling HTTP | Comunicación bidireccional en tiempo real para feedback iterativo |
| 1 agente de alojamiento (secuencial por zona) | N agentes en paralelo por noche | Los crawls paralelos a Airbnb fallaban por rate-limiting |
| Blog Reader + Route Planner separados | 1 solo agente "itinerario" | Separar investigación de planificación reduce alucinaciones |
| 2 blogs máximo | 3-5 blogs | Evitar error 431 (contexto LLM demasiado grande) |
| Crawl4AI (Playwright) | APIs oficiales | No hay API pública de Kayak/Airbnb; crawling con browser real |
