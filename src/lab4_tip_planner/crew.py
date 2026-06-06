"""
Agencia de Viajes Inteligente — Definición del Crew con 4 agentes.

Flujo: vuelos → transporte → alojamiento (paralelo por noche) → actividades
Cada paso requiere aprobación humana (HITL).
"""

import yaml
from pathlib import Path
from crewai import Agent, Crew, Process, Task

from .tools import (
    search_accommodation,
    search_accommodation_image,
    search_activities,
    search_activity_image,
    search_car_rental,
    search_flights,
)

CONFIG_DIR = Path(__file__).parent / "config"


def _load_yaml(filename: str) -> dict:
    with open(CONFIG_DIR / filename, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class TripPlannerCrew:
    """Crew con alojamiento paralelo por noche."""

    def __init__(self):
        self._agents_config = _load_yaml("agents.yaml")
        self._tasks_config = _load_yaml("tasks.yaml")

    def crew(self, numero_dias: int = 7) -> Crew:
        flight_agent = Agent(
            **self._agents_config["flight_specialist"],
            tools=[search_flights],
            verbose=True,
        )
        transport_agent = Agent(
            **self._agents_config["transport_coordinator"],
            tools=[search_car_rental],
            verbose=True,
        )
        accommodation_agent = Agent(
            **self._agents_config["airbnb_curator"],
            tools=[search_accommodation, search_accommodation_image],
            verbose=True,
        )
        activities_agent = Agent(
            **self._agents_config["experience_guide"],
            tools=[search_activities, search_activity_image],
            verbose=True,
        )

        flight_task = Task(
            **self._tasks_config["flight_search_task"],
            agent=flight_agent,
        )
        transport_task = Task(
            **self._tasks_config["transport_search_task"],
            agent=transport_agent,
        )

        night_task_config = self._tasks_config["accommodation_night_task"]
        night_tasks = []
        night_agents = []
        for n in range(1, numero_dias + 1):
            night_agent = Agent(
                **self._agents_config["airbnb_curator"],
                tools=[search_accommodation, search_accommodation_image],
                verbose=True,
            )
            night_agents.append(night_agent)
            desc = night_task_config["description"].replace("{night_number}", str(n))
            exp = night_task_config["expected_output"].replace("{night_number}", str(n))
            night_tasks.append(Task(
                description=desc,
                expected_output=exp,
                agent=night_agent,
                async_execution=True,
            ))

        consolidation_task = Task(
            **self._tasks_config["accommodation_consolidation_task"],
            agent=accommodation_agent,
            context=night_tasks,
        )

        activities_task = Task(
            **self._tasks_config["experience_activities_task"],
            agent=activities_agent,
        )

        all_tasks = [
            flight_task,
            transport_task,
            activities_task,
            *night_tasks,
            consolidation_task,
        ]

        all_agents = [flight_agent, transport_agent, accommodation_agent, *night_agents, activities_agent]

        return Crew(
            agents=all_agents,
            tasks=all_tasks,
            process=Process.sequential,
            memory=True,
            verbose=True,
        )
