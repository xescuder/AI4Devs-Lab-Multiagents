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
    search_itinerary_blogs,
    web_search,
    crawl_kayak_flights,
    search_rentalcars,
    crawl_itinerary_blog,
    crawl_airbnb,
    extract_pdf_content,
)

CONFIG_DIR = Path(__file__).parent / "config"
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
MEMORY_DIR = Path(__file__).parent / ".memory"
MEMORY_DIR.mkdir(exist_ok=True)

user_memory = Memory(
    root_scope="user_preferences",
    storage=str(MEMORY_DIR),
    semantic_weight=0.6,
    recency_weight=0.2,
    importance_weight=0.2,
    recency_half_life_days=90,
)


def _load_yaml(filename: str) -> dict:
    with open(CONFIG_DIR / filename, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class TripPlannerCrew:

    def __init__(self):
        self._agents_config = _load_yaml("agents.yaml")
        self._tasks_config = _load_yaml("tasks.yaml")

    def crew(self) -> Crew:
        task_to_step = {
            "flight_search_task": "flight",
            "route_plan_task": "activities",
            "accommodation_search_task": "accommodation",
            "transport_search_task": "transport",
        }
        for task_name, step_name in task_to_step.items():
            if task_name not in self._tasks_config:
                continue
            prefs = user_memory.recall(
                f"preferencias del usuario para {step_name}",
                scope=f"preference_{step_name}",
                limit=5,
            )
            if prefs:
                pref_block = "\n\nPREFERENCIAS DEL USUARIO (de viajes anteriores):\n"
                pref_block += "\n".join(f"- {p.record.content}" for p in prefs)
                self._tasks_config[task_name]["description"] += pref_block

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
            tools=[search_rentalcars],
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
            tools=[search_itinerary_blogs, crawl_itinerary_blog, extract_pdf_content],
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

        # --- Itinerary sub-pipeline (2 tasks: read blogs → plan route) ---
        blog_read_task = Task(
            **self._tasks_config["blog_read_task"],
            agent=blog_reader,
        )

        route_plan_task = Task(
            **self._tasks_config["route_plan_task"],
            agent=route_planner,
            context=[flight_task, blog_read_task],
        )

        # --- Accommodation (single agent, searches by unique zones) ---
        accommodation_task = Task(
            **self._tasks_config["accommodation_search_task"],
            agent=accommodation_agent,
            context=[route_plan_task],
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
            context=[flight_task, transport_task, route_plan_task, accommodation_task],
        )

        # --- Assemble ---
        all_tasks = [
            flight_task,
            blog_read_task,
            route_plan_task,
            accommodation_task,
            transport_task,
            compilation_task,
        ]

        all_agents = [
            coordinator, flight_agent, transport_agent,
            blog_reader, route_planner,
            accommodation_agent,
        ]

        return Crew(
            agents=all_agents,
            tasks=all_tasks,
            process=Process.sequential,
            memory=user_memory,
            verbose=True,
            output_log_file=str(LOG_DIR / "crew_output.log"),
        )
