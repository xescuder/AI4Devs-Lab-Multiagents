from __future__ import annotations

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

@CrewBase
class ViajesCrewBasic:
    """Crew secuencial para plan de viaje sin tools ni mcps asignadas a los agentes."""

    agents_config = "./config/agents.yaml"
    tasks_config = "./config/tasks.yaml"

    @agent
    def vuelos(self) -> Agent:
        return Agent(config=self.agents_config["vuelos"])

    @agent
    def alojamiento(self) -> Agent:
        return Agent(config=self.agents_config["alojamiento"])

    @agent
    def actividades(self) -> Agent:
        return Agent(config=self.agents_config["actividades"])
    
    @agent
    def transporte(self) -> Agent:
        return Agent(config=self.agents_config["transporte"])

    @agent
    def coche(self) -> Agent:
        return Agent(config=self.agents_config["coche"])

    @agent
    def itinerario(self) -> Agent:
        return Agent(config=self.agents_config["itinerario"])

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
            verbose=True
        )
