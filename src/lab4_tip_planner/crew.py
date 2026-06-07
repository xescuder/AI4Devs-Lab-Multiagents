"""
Agencia de Viajes Inteligente — Crew Assembly.

Flujo: vuelos → transporte → blogs → (read blogs → curate → plan route) → alojamiento
El itinerario se crea con 3 agentes especializados en sub-pipeline.
"""

import yaml
from pathlib import Path
from crewai import Agent, Crew, Process, Task
from crewai.memory.unified_memory import Memory

from .tools import (
    search_accommodation,
    search_accommodation_image,
    search_activities,
    search_itinerary_blogs,
    web_search,
    crawl_kayak_flights,
    crawl_kayak_cars,
    crawl_itinerary_blog,
    crawl_airbnb,
)

CONFIG_DIR = Path(__file__).parent / "config"
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


def _load_yaml(filename: str) -> dict:
    with open(CONFIG_DIR / filename, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class TripPlannerCrew:

    def __init__(self):
        self._agents_config = _load_yaml("agents.yaml")
        self._tasks_config = _load_yaml("tasks.yaml")

    def crew(self, numero_dias: int = 7) -> Crew:
        # --- Coordinator ---
        coordinator = Agent(
            **self._agents_config["trip_coordinator"],
            tools=[web_search],
            verbose=True,
        )

        # --- Specialists ---
        flight_agent = Agent(
            **self._agents_config["flight_specialist"],
            tools=[crawl_kayak_flights],
            verbose=True,
        )
        transport_agent = Agent(
            **self._agents_config["transport_coordinator"],
            tools=[crawl_kayak_cars],
            verbose=True,
        )

        # --- Itinerary sub-pipeline: 3 specialized agents ---
        blog_reader = Agent(
            role="Investigador de Itinerarios de Viaje",
            goal=(
                "Buscar los mejores blogs con itinerarios del destino "
                "y extraer TODAS las actividades, rutas, tiempos y precios."
            ),
            backstory=(
                "Investigador de viajes que busca, selecciona y analiza blogs. "
                "Lees artículos completos y extraes información estructurada."
            ),
            tools=[search_itinerary_blogs, crawl_itinerary_blog],
            verbose=True,
            allow_delegation=False,
        )

        experience_curator = Agent(
            role="Curador de Experiencias Imprescindibles",
            goal=(
                "De todas las actividades extraídas de los blogs, seleccionar "
                "las IMPRESCINDIBLES. Eliminar duplicados, verificar precios."
            ),
            backstory=(
                "Viajero experimentado que sabe distinguir lo imprescindible. "
                "Si solo tuvieras un día en cada zona, ¿qué harías? Eso es lo que seleccionas."
            ),
            tools=[search_activities, web_search],
            verbose=True,
            allow_delegation=False,
        )

        route_planner = Agent(
            role="Planificador de Rutas con Timetable y Mapa",
            goal=(
                "Organizar las actividades en un itinerario con timetable preciso, "
                "drives con tiempos/distancias, y coordenadas GPS para cada punto."
            ),
            backstory=(
                "Planificador logístico que conoce las carreteras del destino. "
                "Organizas jornadas realistas con paradas, comidas y descansos. "
                "Conoces las coordenadas GPS de los lugares turísticos del mundo."
            ),
            tools=[web_search],
            verbose=True,
            allow_delegation=False,
        )

        # --- Accommodation ---
        accommodation_agent = Agent(
            **self._agents_config["airbnb_curator"],
            tools=[search_accommodation, search_accommodation_image, crawl_airbnb, web_search],
            verbose=True,
            max_iter=15,
        )

        # =====================================================================
        # TASKS
        # =====================================================================

        flight_task = Task(
            **self._tasks_config["flight_search_task"],
            agent=flight_agent,
        )

        # --- Itinerary sub-pipeline (3 tasks, all automatic) ---
        blog_read_task = Task(
            **self._tasks_config["blog_read_task"],
            agent=blog_reader,
        )

        curate_task = Task(
            **self._tasks_config["experience_curate_task"],
            agent=experience_curator,
            context=[blog_read_task],
        )

        route_plan_task = Task(
            **self._tasks_config["route_plan_task"],
            agent=route_planner,
            context=[flight_task, curate_task],
        )

        # --- Accommodation (parallel per night, each with own agent) ---
        night_task_config = self._tasks_config["accommodation_night_task"]
        night_tasks = []
        night_agents = []
        for n in range(1, numero_dias):
            night_agent = Agent(
                **self._agents_config["airbnb_curator"],
                tools=[crawl_airbnb, search_accommodation_image, web_search],
                verbose=True,
                max_iter=10,
            )
            night_agents.append(night_agent)
            desc = night_task_config["description"].replace("{night_number}", str(n))
            exp = night_task_config["expected_output"].replace("{night_number}", str(n))
            night_tasks.append(Task(
                description=desc,
                expected_output=exp,
                agent=night_agent,
                context=[route_plan_task],
                async_execution=True,
            ))

        consolidation_task = Task(
            **self._tasks_config["accommodation_consolidation_task"],
            agent=accommodation_agent,
            context=night_tasks,
        )

        # --- Transport (after itinerary so it knows the route) ---
        transport_task = Task(
            **self._tasks_config["transport_search_task"],
            agent=transport_agent,
            context=[flight_task, route_plan_task],
        )

        # --- Final compilation ---
        compilation_task = Task(
            **self._tasks_config["trip_compilation_task"],
            agent=coordinator,
            context=[flight_task, transport_task, route_plan_task, consolidation_task],
        )

        # --- Assemble ---
        all_tasks = [
            flight_task,
            blog_read_task,
            curate_task,
            route_plan_task,
            *night_tasks,
            consolidation_task,
            transport_task,
            compilation_task,
        ]

        all_agents = [
            coordinator, flight_agent, transport_agent,
            blog_reader, experience_curator, route_planner,
            accommodation_agent, *night_agents,
        ]

        trip_memory = Memory(
            root_scope="trip_planner",
            recency_weight=0.2,
            semantic_weight=0.6,
            importance_weight=0.2,
            recency_half_life_days=30,
        )

        return Crew(
            agents=all_agents,
            tasks=all_tasks,
            process=Process.sequential,
            memory=trip_memory,
            verbose=True,
            output_log_file=str(LOG_DIR / "crew_output.log"),
        )
