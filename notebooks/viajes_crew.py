from __future__ import annotations

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import SerperDevTool
from tools import google_maps_distance

tool_search = SerperDevTool(
    country="ES",
    locale="es",
    location="Barcelona, Spain",
    tbs="qdr:y2",
    n_results=10
)

@CrewBase
class ViajesCrew:
    """Crew con tools de búsqueda y mcps asignadas a los agentes."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def vuelos(self) -> Agent:
        return Agent(config=self.agents_config["vuelos"], tools=[SerperDevTool()])

    @agent
    def alojamiento(self) -> Agent:
        return Agent(config=self.agents_config["alojamiento"], tools=[SerperDevTool()])

    @agent
    def actividades(self) -> Agent:
        return Agent(config=self.agents_config["actividades"], tools=[SerperDevTool()])

    @agent
    def transporte(self) -> Agent:
        return Agent(config=self.agents_config["transporte"], tools=[SerperDevTool()])

    @agent
    def coche(self) -> Agent:
        return Agent(config=self.agents_config["coche"], tools=[SerperDevTool()])

    @agent
    def itinerario(self) -> Agent:
        return Agent(config=self.agents_config["itinerario"], tools=[google_maps_distance])

    @task
    def vuelos_task(self) -> Task:
        return Task(config=self.tasks_config["vuelos_task"])

    @task
    def alojamiento_task(self) -> Task:
        return Task(config=self.tasks_config["alojamiento_task"])

    @task
    def actividades_task(self) -> Task:
        return Task(config=self.tasks_config["actividades_task"])

    @task
    def transporte_task(self) -> Task:
        return Task(config=self.tasks_config["transporte_task"])

    @task
    def coche_task(self) -> Task:
        return Task(config=self.tasks_config["coche_task"])

    @task
    def itinerario_task(self) -> Task:
        return Task(
            config=self.tasks_config["itinerario_task"],
            context=[self.vuelos_task(), self.alojamiento_task(), self.actividades_task(), self.transporte_task()],
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.vuelos(), self.alojamiento(), self.actividades(), self.transporte(), self.itinerario()],
            tasks=[self.vuelos_task(), self.alojamiento_task(), self.actividades_task(), self.transporte_task(), self.itinerario_task()],
            process=Process.sequential,
            verbose=True,
        )
