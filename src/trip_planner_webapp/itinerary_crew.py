"""
Sub-crew especializado en crear itinerarios día a día.

3 agentes en secuencia:
1. Blog Reader — crawlea los blogs seleccionados y extrae actividades/rutas
2. Experience Curator — selecciona las imprescindibles, descarta duplicados
3. Route Planner — organiza el timetable con drives, tiempos y coordenadas GPS
"""

from crewai import Agent, Crew, Process, Task

from .tools import (
    crawl_itinerary_blog,
    search_activities,
    search_activity_image,
    web_search,
)


def create_itinerary_crew(
    blog_urls: list[str],
    destination: str,
    days: int,
    flight_info: str = "",
) -> Crew:
    """Creates a specialized crew for itinerary planning."""

    # --- Agent 1: Blog Reader ---
    blog_reader = Agent(
        role="Lector y Extractor de Blogs de Viaje",
        goal=(
            f"Leer los blogs proporcionados sobre {destination} y extraer "
            "TODAS las actividades, lugares, rutas y tiempos mencionados. "
            "Organizar la información por día como aparece en cada blog."
        ),
        backstory=(
            "Eres un analista de contenido especializado en blogs de viaje. "
            "Tu trabajo es leer artículos completos y extraer información "
            "estructurada: qué visitar, cuánto tiempo, en qué orden, y "
            "cualquier consejo práctico mencionado."
        ),
        tools=[crawl_itinerary_blog],
        verbose=True,
        allow_delegation=False,
    )

    # --- Agent 2: Experience Curator ---
    curator = Agent(
        role="Curador de Experiencias Imprescindibles",
        goal=(
            f"De todas las actividades extraídas de los blogs, seleccionar "
            f"las IMPRESCINDIBLES para un viaje de {days} días en {destination}. "
            "Eliminar duplicados, actividades menores, y quedarse solo con "
            "lo que realmente merece la pena. Verificar precios actuales."
        ),
        backstory=(
            "Eres un viajero experimentado que ha visitado cientos de destinos. "
            "Sabes distinguir lo imprescindible de lo prescindible. Tu criterio: "
            "si solo tuvieras un día en cada zona, ¿qué harías? Eso es lo imprescindible. "
            "También verificas precios y horarios actualizados."
        ),
        tools=[search_activities, web_search],
        verbose=True,
        allow_delegation=False,
    )

    # --- Agent 3: Route Planner ---
    planner = Agent(
        role="Planificador de Rutas con Timetable",
        goal=(
            f"Organizar las actividades seleccionadas en un itinerario de {days} días "
            "con timetable preciso. Incluir desplazamientos en coche con tiempos "
            "y distancias, coordenadas GPS de cada punto, y tiempos de visita. "
            "El plan debe ser realista y no saturar ningún día."
        ),
        backstory=(
            "Eres un planificador logístico con conocimiento detallado de las "
            "carreteras y distancias del destino. Organizas jornadas con horarios "
            "realistas, contemplando paradas, comidas y descansos. Conoces las "
            "coordenadas de todos los puntos turísticos principales del mundo."
        ),
        tools=[search_activity_image, web_search],
        verbose=True,
        allow_delegation=False,
    )

    # --- Task 1: Read blogs ---
    blog_urls_text = "\n".join(f"- {url}" for url in blog_urls)
    read_task = Task(
        description=(
            f"Lee los siguientes blogs sobre {destination} y extrae TODA la información "
            "de actividades, rutas y tiempos:\n\n"
            f"{blog_urls_text}\n\n"
            "Para cada blog, usa la herramienta 'Blog crawl' con la URL.\n"
            "Extrae: nombre de cada lugar/actividad, descripción, tiempo estimado, "
            "precio si se menciona, y el orden/día en que se recomienda.\n\n"
            "FORMATO: JSON con estructura:\n"
            '{"blogs_read": [{"url": "...", "activities_found": [{"name": "...", '
            '"description": "...", "day_suggested": N, "duration_minutes": N, '
            '"price": N or null, "zone": "..."}]}]}'
        ),
        expected_output="JSON con actividades extraídas de todos los blogs",
        agent=blog_reader,
    )

    # --- Task 2: Curate experiences ---
    curate_task = Task(
        description=(
            f"De las actividades extraídas de los blogs, selecciona las IMPRESCINDIBLES "
            f"para un viaje de {days} días en {destination}.\n\n"
            "INSTRUCCIONES:\n"
            "1. Elimina duplicados (mismo lugar mencionado en varios blogs).\n"
            "2. Agrupa por zona geográfica.\n"
            "3. Marca como 'imprescindible' solo lo que aparece en 2+ blogs o es icónico.\n"
            "4. Separa en 'gratuitas' y 'de pago'.\n"
            "5. Usa 'Activities search' para verificar precios actuales de las de pago.\n"
            f"6. Selecciona máximo 3-4 actividades por día para {days} días.\n\n"
            "FORMATO: JSON con:\n"
            '{"curated": [{"name": "...", "zone": "...", "type": "free/paid", '
            '"duration_minutes": N, "price_per_person": N, "must_see": true/false, '
            '"mentioned_in_blogs": N, "best_time_of_day": "morning/afternoon/evening"}]}'
        ),
        expected_output="JSON con actividades curadas y priorizadas",
        agent=curator,
        context=[read_task],
    )

    # --- Task 3: Plan route with timetable ---
    flight_context = f"\nINFO VUELOS: {flight_info}\n" if flight_info else ""
    plan_task = Task(
        description=(
            f"Organiza las actividades curadas en un itinerario de {days} días "
            f"en {destination} con timetable preciso.\n"
            f"{flight_context}\n"
            "REGLAS:\n"
            "1. Agrupa actividades por proximidad geográfica para minimizar conducción.\n"
            "2. Incluye 'drives' entre cada punto con origen, destino, duración, "
            "distancia en km, y coordenadas GPS (from_lat/from_lng, to_lat/to_lng).\n"
            "3. Cada actividad necesita: start_time, duration_minutes, walking_time_minutes, "
            "lat, lng, y image_url (usa 'Activity image search').\n"
            "4. Intercala drives y actividades por orden cronológico.\n"
            "5. Primer día: actividades solo después de llegar (si hay info de vuelo).\n"
            "6. Último día: actividades solo hasta 3h antes del vuelo de vuelta.\n"
            "7. No saturar: max 3-4 actividades por día + drives.\n"
            "8. Incluye paradas para comer.\n\n"
            "FORMATO: Responde SOLO con JSON válido:\n"
            "{\n"
            '  "source_blogs": ["url1", "url2"],\n'
            '  "days": [{\n'
            '    "day": 1, "title": "...", "type": "active/rest",\n'
            '    "drives": [{"from": "...", "from_lat": N, "from_lng": N, '
            '"to": "...", "to_lat": N, "to_lng": N, "duration_minutes": N, '
            '"distance_km": N, "start_time": "HH:MM"}],\n'
            '    "free_activities": [{"name": "...", "description": "...", '
            '"location": "...", "lat": N, "lng": N, "start_time": "HH:MM", '
            '"duration_minutes": N, "walking_time_minutes": N, "image_url": "...", '
            '"tip": "..."}],\n'
            '    "paid_activities": [{"name": "...", "description": "...", '
            '"location": "...", "lat": N, "lng": N, "start_time": "HH:MM", '
            '"duration_minutes": N, "walking_time_minutes": N, '
            '"price_per_person": N, "image_url": "...", "tip": "..."}]\n'
            "  }],\n"
            '  "totals": {"driving_hours": N, "walking_hours": N, '
            '"free_time_hours": N, "paid_time_hours": N, "budget_per_person": N}\n'
            "}"
        ),
        expected_output="JSON con itinerario completo con drives, coordenadas y timetable",
        agent=planner,
        context=[curate_task],
        human_input=True,
    )

    return Crew(
        agents=[blog_reader, curator, planner],
        tasks=[read_task, curate_task, plan_task],
        process=Process.sequential,
        verbose=True,
    )
