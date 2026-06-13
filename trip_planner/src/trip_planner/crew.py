from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent

from trip_planner.models import DestinationResearch, Itinerary


@CrewBase
class TripPlannerCrew():
    """TripPlanner crew"""

    agents: list[BaseAgent]
    tasks: list[Task]

    @agent
    def destination_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['destination_analyst'],
            verbose=True
        )

    @agent
    def itinerary_designer(self) -> Agent:
        return Agent(
            config=self.agents_config['itinerary_designer'],
            verbose=True
        )

    @task
    def research_task(self) -> Task:
        return Task(
            config=self.tasks_config['research_task']
        )

    @task
    def itinerary_task(self) -> Task:
        return Task(
            config=self.tasks_config['itinerary_task'],
            output_file="output/itinerario_actividades.md"
        )

    @crew
    def crew(self) -> Crew:
        """Creates the TripPlanner crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
