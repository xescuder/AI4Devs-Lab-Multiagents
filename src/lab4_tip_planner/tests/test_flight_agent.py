"""
Test del agente de vuelos de forma aislada.

Ejecuta SOLO el agente de vuelos con una búsqueda real en Kayak/Skyscanner
para verificar que devuelve datos reales antes de correr el crew completo.

Uso:
    cd /path/to/AI4Devs-Lab-Multiagents
    python -m src.lab4_tip_planner.tests.test_flight_agent
"""

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load env
PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / ".env")

from crewai import Agent, Crew, Process, Task
from src.lab4_tip_planner.tools import search_flights, web_search


def test_flight_search_tool():
    """Test directo de la herramienta sin agente."""
    print("=" * 60)
    print("TEST 1: Herramienta search_flights (llamada directa)")
    print("=" * 60)

    result = search_flights.run(
        departure="Barcelona",
        destination="Reykjavik",
        date="2026-09-07",
        return_date="2026-09-14",
        adults=2,
    )

    print(f"\nResultado ({len(result)} chars):")
    try:
        data = json.loads(result)
        print(f"  skyscanner_url: {data.get('skyscanner_url', 'N/A')}")
        print(f"  route: {data.get('route', 'N/A')}")
        print(f"  google_flights (primeros 200 chars):")
        print(f"    {str(data.get('google_flights_results', ''))[:200]}")
        print(f"  skyscanner (primeros 200 chars):")
        print(f"    {str(data.get('skyscanner_results', ''))[:200]}")
        return True
    except json.JSONDecodeError:
        print(f"  [No es JSON válido]: {result[:300]}")
        return False


def test_flight_agent():
    """Test del agente completo con una tarea."""
    print("\n" + "=" * 60)
    print("TEST 2: Agente de vuelos (crew de 1 agente)")
    print("=" * 60)

    flight_agent = Agent(
        role="Especialista en Vuelos Internacionales",
        goal=(
            "Encontrar vuelos reales de Barcelona a Reykjavik para 2 adultos. "
            "Fechas: ida 2026-09-07, vuelta 2026-09-14. Solo vuelos directos. "
            "Usar SOLO precios reales de la búsqueda web."
        ),
        backstory=(
            "Agente de viajes veterano. Busca en Skyscanner, Kayak y Google Flights. "
            "Nunca inventa precios — solo usa datos de búsqueda web real."
        ),
        tools=[search_flights, web_search],
        verbose=True,
        allow_delegation=False,
    )

    flight_task = Task(
        description=(
            "Busca vuelos reales de Barcelona a Reykjavik para 2 adultos.\n"
            "Fechas: ida 2026-09-07, vuelta 2026-09-14.\n"
            "Solo vuelos directos.\n\n"
            "INSTRUCCIONES:\n"
            "1. Usa la herramienta 'Skyscanner flight search' con departure='Barcelona', "
            "destination='Reykjavik', date='2026-09-07', return_date='2026-09-14', adults=2.\n"
            "2. Propón las 3 mejores opciones basándote en los resultados REALES.\n"
            "3. Usa SOLO precios que aparezcan en los resultados de búsqueda.\n\n"
            "FORMATO: Responde con JSON válido con este formato:\n"
            '{"options": [{"airline": "...", "outbound": {"date": "...", "departure": "HH:MM", '
            '"arrival": "HH:MM", "route": "...", "stops": "Directo", "duration": "Xh Xm"}, '
            '"return": {...}, "price_per_person": 000, "price_total": 000, '
            '"skyscanner_url": "...", "recommended": true/false, "reason": "..."}]}'
        ),
        expected_output="JSON con opciones de vuelo reales",
        agent=flight_agent,
    )

    crew = Crew(
        agents=[flight_agent],
        tasks=[flight_task],
        process=Process.sequential,
        verbose=True,
    )

    print("\nEjecutando agente de vuelos...")
    result = crew.kickoff()

    print("\n" + "-" * 60)
    print("RESULTADO DEL AGENTE:")
    print("-" * 60)
    print(result.raw)

    # Verify JSON
    try:
        raw = result.raw.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            options = data.get("options", [])
            print(f"\n✓ JSON válido con {len(options)} opciones")
            for i, opt in enumerate(options):
                print(f"  Opción {i+1}: {opt.get('airline', '?')} - {opt.get('price_per_person', '?')}€/pers")
                print(f"    URL: {opt.get('skyscanner_url', 'N/A')}")
            return True
    except Exception as e:
        print(f"\n✗ Error parseando resultado: {e}")

    return False


def test_kayak_search():
    """Test búsqueda específica en Kayak."""
    print("\n" + "=" * 60)
    print("TEST 3: Búsqueda directa en Kayak via web_search")
    print("=" * 60)

    result = web_search.run(
        search_query="kayak.com Barcelona to Reykjavik flights September 2026 price"
    )
    print(f"\nResultados Kayak ({len(result)} chars):")
    print(result[:500])
    return bool(result and len(result) > 50)


if __name__ == "__main__":
    print("\n🧪 Testing Flight Agent — Agencia de Viajes Inteligente\n")

    results = []

    # Test 1: Tool directo
    results.append(("Herramienta search_flights", test_flight_search_tool()))

    # Test 2: Búsqueda Kayak
    results.append(("Búsqueda Kayak", test_kayak_search()))

    # Test 3: Agente completo
    results.append(("Agente de vuelos", test_flight_agent()))

    # Summary
    print("\n" + "=" * 60)
    print("RESUMEN DE TESTS")
    print("=" * 60)
    for name, passed in results:
        icon = "✓" if passed else "✗"
        print(f"  {icon} {name}")

    all_passed = all(r[1] for r in results)
    sys.exit(0 if all_passed else 1)
