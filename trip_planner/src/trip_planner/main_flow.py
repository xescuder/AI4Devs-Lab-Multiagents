#!/usr/bin/env python
import json
import os
import warnings

from pydantic import BaseModel
from crewai import LLM
from crewai.flow.flow import Flow, listen, start

from trip_planner.crew import TripPlannerCrew
from trip_planner.models import DestinationResearch, Itinerary

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


class TripPlannerState(BaseModel):
    destination: str = ""
    number_of_days: int = 0
    research: DestinationResearch | None = None
    itinerary: Itinerary | None = None


class TripPlannerFlow(Flow[TripPlannerState]):
    """Flow for planning a trip itinerary"""

    @start()
    def get_user_input(self):
        print("\n=== Planificador de Viajes ===\n")

        self.state.destination = input("¿Cuál es tu destino? ")

        while True:
            try:
                days = int(input("¿Cuántos días durará el viaje? "))
                if days > 0:
                    self.state.number_of_days = days
                    break
                print("Por favor ingresa un número mayor a 0.")
            except ValueError:
                print("Por favor ingresa un número válido.")

        print(f"\nPlanificando {self.state.number_of_days} días en {self.state.destination}...\n")
        return self.state

    @listen(get_user_input)
    def research_destination(self, state):
        print("Investigando destino y atracciones...")

        llm = LLM(model="openai/gpt-4o-mini")

        schema = DestinationResearch.model_json_schema()
        messages = [
            {"role": "system", "content": "Eres un asistente que responde ÚNICAMENTE con JSON válido, sin texto adicional."},
            {"role": "user", "content": f"""
            Analiza el destino "{state.destination}" para un viaje de {state.number_of_days} días.

            Selecciona los mejores puntos de interés (monumentos, museos, plazas, parques, playas, miradores)
            y actividades (tours, caminatas, senderismo, experiencias).

            NO incluyas restaurantes, hoteles ni recomendaciones gastronómicas.

            Si es un país, diseña una ruta realista por zonas.
            Si es una ciudad y hay muchos días, incluye excursiones de un día a lugares cercanos.

            Responde con un JSON que siga este esquema:
            {json.dumps(schema, ensure_ascii=False, indent=2)}
            """}
        ]

        response = llm.call(messages=messages)
        research_dict = json.loads(response)
        self.state.research = DestinationResearch(**research_dict)

        os.makedirs("output", exist_ok=True)
        with open("output/research.json", "w") as f:
            json.dump(research_dict, f, indent=2, ensure_ascii=False)

        print(f"Investigación completada: {len(self.state.research.days)} días planificados")
        return self.state.research

    @listen(research_destination)
    def create_itinerary(self, research):
        print("Creando itinerario detallado...")

        result = TripPlannerCrew().crew().kickoff(inputs={
            "destination": self.state.destination,
            "number_of_days": str(self.state.number_of_days),
        })

        self.state.itinerary = result.pydantic

        if self.state.itinerary:
            guide = f"# Itinerario: {self.state.itinerary.destination} — {self.state.itinerary.number_of_days} días\n\n"

            for day in self.state.itinerary.days:
                guide += f"## Día {day.day_number}: {day.title}\n\n"
                for activity in day.activities:
                    guide += f"### {activity.time_slot} ({activity.start_time} - {activity.end_time})\n"
                    guide += f"**{activity.name}** — {activity.location}\n\n"
                    guide += f"{activity.description}\n\n"

            os.makedirs("output", exist_ok=True)
            with open("output/itinerario_completo.md", "w") as f:
                f.write(guide)

            print("\nItinerario guardado en output/itinerario_completo.md")

        return "Planificación completada"


def kickoff():
    TripPlannerFlow().kickoff()
    print("\n=== Flujo Completado ===")
    print("Tu itinerario está listo en el directorio output/")


def plot():
    flow = TripPlannerFlow()
    flow.plot("trip_planner_flow")
    print("Visualización guardada en trip_planner_flow.html")


if __name__ == "__main__":
    kickoff()
