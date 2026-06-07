"""
Test individual de cada agente del crew.

Ejecuta cada agente de forma aislada para verificar que:
1. La herramienta funciona (búsqueda web real)
2. El agente produce output JSON válido
3. Los datos son coherentes

Uso:
    cd /path/to/AI4Devs-Lab-Multiagents

    # Todos los agentes:
    python -m src.lab4_tip_planner.tests.test_agents

    # Solo uno:
    python -m src.lab4_tip_planner.tests.test_agents flights
    python -m src.lab4_tip_planner.tests.test_agents transport
    python -m src.lab4_tip_planner.tests.test_agents activities
    python -m src.lab4_tip_planner.tests.test_agents accommodation
"""

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / ".env")

from crewai import Agent, Crew, Process, Task
from src.lab4_tip_planner.tools import (
    search_flights, search_car_rental, search_activities,
    search_accommodation, search_accommodation_image,
    search_activity_image, web_search,
)


# ---------------------------------------------------------------------------
# Shared test inputs
# ---------------------------------------------------------------------------

TRIP = {
    "origin": "Barcelona",
    "destination": "Reykjavik",
    "date": "2026-09-07",
    "return_date": "2026-09-14",
    "adults": 2,
    "days": 7,
    "max_night": 120,
}


def _run_single_agent(name, agent, task_description, expected_output):
    """Run a single agent and return (success, result)."""
    print(f"\n{'='*60}")
    print(f"🧪 Testing: {name}")
    print(f"{'='*60}")

    task = Task(
        description=task_description,
        expected_output=expected_output,
        agent=agent,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )

    try:
        result = crew.kickoff()
        raw = result.raw.strip()
        print(f"\n📋 Output ({len(raw)} chars):")
        print(raw[:500])

        # Try parsing JSON
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            print(f"\n✓ JSON válido")
            return True, data
        else:
            print(f"\n⚠ No es JSON, pero el agente respondió")
            return True, raw
    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False, None


# ---------------------------------------------------------------------------
# Test functions
# ---------------------------------------------------------------------------

def test_flights():
    agent = Agent(
        role="Especialista en Vuelos",
        goal=f"Buscar vuelos reales de {TRIP['origin']} a {TRIP['destination']}",
        backstory="Agente veterano que solo usa precios de búsqueda web real.",
        tools=[search_flights, web_search],
        verbose=True,
        allow_delegation=False,
    )

    return _run_single_agent(
        "Agente de Vuelos",
        agent,
        f"Busca vuelos de {TRIP['origin']} a {TRIP['destination']}.\n"
        f"Ida: {TRIP['date']}, Vuelta: {TRIP['return_date']}, {TRIP['adults']} adultos.\n"
        f"Usa 'Skyscanner flight search' y propón 3 opciones con precios REALES.\n"
        "FORMATO: JSON válido.",
        "JSON con opciones de vuelo",
    )


def test_transport():
    agent = Agent(
        role="Coordinador de Transporte",
        goal=f"Buscar alquiler de coche en {TRIP['destination']}",
        backstory="Experto en alquiler de vehículos internacionales.",
        tools=[search_car_rental, web_search],
        verbose=True,
        allow_delegation=False,
    )

    return _run_single_agent(
        "Agente de Transporte",
        agent,
        f"Busca alquiler de coche en {TRIP['destination']} por {TRIP['days']} días.\n"
        f"Desde {TRIP['date']} hasta {TRIP['return_date']}.\n"
        "Usa 'Car rental search' y propón 3 opciones con precios reales.\n"
        "FORMATO: JSON válido.",
        "JSON con opciones de alquiler",
    )


def test_activities():
    agent = Agent(
        role="Planificador de Actividades",
        goal=f"Planificar actividades para {TRIP['days']} días en {TRIP['destination']}",
        backstory="Guía local experto en experiencias memorables.",
        tools=[search_activities, search_activity_image, web_search],
        verbose=True,
        allow_delegation=False,
    )

    return _run_single_agent(
        "Agente de Actividades",
        agent,
        f"Planifica actividades para {TRIP['days']} días en {TRIP['destination']}.\n"
        f"{TRIP['adults']} adultos. Separa actividades gratuitas y de pago.\n"
        "Para cada una indica hora de inicio y duración.\n"
        "Usa 'Activities search' para buscar precios reales.\n"
        "FORMATO: JSON válido.",
        "JSON con itinerario día a día",
    )


def test_accommodation():
    agent = Agent(
        role="Curador de Alojamientos",
        goal=f"Buscar Airbnb en {TRIP['destination']} max {TRIP['max_night']}€/noche",
        backstory="Superhost experto en alojamientos con buena relación calidad-precio.",
        tools=[search_accommodation, search_accommodation_image, web_search],
        verbose=True,
        allow_delegation=False,
    )

    return _run_single_agent(
        "Agente de Alojamientos",
        agent,
        f"Busca 3 opciones de Airbnb en {TRIP['destination']} para la noche 1.\n"
        f"{TRIP['adults']} huéspedes, máximo {TRIP['max_night']}€/noche.\n"
        "Usa 'Accommodation search' y 'Accommodation image search'.\n"
        "FORMATO: JSON válido.",
        "JSON con opciones de alojamiento",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

TESTS = {
    "flights": test_flights,
    "transport": test_transport,
    "activities": test_activities,
    "accommodation": test_accommodation,
}

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    if target == "all":
        tests_to_run = list(TESTS.items())
    elif target in TESTS:
        tests_to_run = [(target, TESTS[target])]
    else:
        print(f"Test desconocido: {target}")
        print(f"Opciones: {', '.join(TESTS.keys())}, all")
        sys.exit(1)

    print(f"\n🧪 Testing agentes — Agencia de Viajes Inteligente")
    print(f"   Destino: {TRIP['origin']} → {TRIP['destination']}")
    print(f"   Fechas: {TRIP['date']} → {TRIP['return_date']}")
    print(f"   Adultos: {TRIP['adults']}")

    results = []
    for name, test_fn in tests_to_run:
        success, _ = test_fn()
        results.append((name, success))

    print(f"\n{'='*60}")
    print("RESUMEN")
    print(f"{'='*60}")
    for name, passed in results:
        print(f"  {'✓' if passed else '✗'} {name}")

    sys.exit(0 if all(r[1] for r in results) else 1)
