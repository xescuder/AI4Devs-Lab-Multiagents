#!/usr/bin/env python3
"""
Agencia de Viajes Inteligente — Punto de entrada CLI.

Sistema multi-agente con CrewAI que planifica viajes completos
usando 4 agentes especializados con aprobación humana (HITL)
en cada paso.

Uso:
    python -m src.lab4_tip_planner.main
"""

import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv


def collect_user_inputs() -> dict:
    """Recoge los 5 inputs obligatorios del usuario."""
    print("=" * 60)
    print("  🌍 AGENCIA DE VIAJES INTELIGENTE")
    print("  Sistema Multi-Agente con CrewAI")
    print("=" * 60)
    print()
    print("Por favor, introduce los datos de tu viaje:\n")

    pais_origen = input("  País/Ciudad de origen: ").strip()
    if not pais_origen:
        print("Error: El origen es obligatorio.")
        sys.exit(1)

    pais_destino = input("  País/Ciudad de destino: ").strip()
    if not pais_destino:
        print("Error: El destino es obligatorio.")
        sys.exit(1)

    try:
        numero_adultos = int(input("  Número de adultos: ").strip())
        if numero_adultos < 1:
            raise ValueError
    except ValueError:
        print("Error: Introduce un número de adultos válido (>= 1).")
        sys.exit(1)

    fecha_ida = input("  Fecha de ida (YYYY-MM-DD): ").strip()
    fecha_vuelta = input("  Fecha de vuelta (YYYY-MM-DD): ").strip()
    try:
        d_start = datetime.strptime(fecha_ida, "%Y-%m-%d").date()
        d_end = datetime.strptime(fecha_vuelta, "%Y-%m-%d").date()
        if d_end <= d_start:
            raise ValueError("La fecha de vuelta debe ser posterior a la de ida.")
        numero_dias = (d_end - d_start).days + 1
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    try:
        flexibilidad = int(input("  Flexibilidad de fechas (± días, 0-30): ").strip())
        if flexibilidad < 0 or flexibilidad > 30:
            raise ValueError
    except ValueError:
        print("Error: Introduce un valor de flexibilidad válido (0-30).")
        sys.exit(1)

    escala = input("  Tipo de vuelo (directo / 1escala): ").strip().lower()
    if escala in ("directo", "d", "direct"):
        tipo_vuelo = "solo vuelos directos"
    else:
        tipo_vuelo = "vuelos directos o con máximo 1 escala"

    try:
        presupuesto_max_noche = float(
            input("  Presupuesto máximo por noche (EUR): ").strip()
        )
        if presupuesto_max_noche <= 0:
            raise ValueError
    except ValueError:
        print("Error: Introduce un presupuesto válido (> 0).")
        sys.exit(1)

    return {
        "pais_origen": pais_origen,
        "pais_destino": pais_destino,
        "numero_adultos": str(numero_adultos),
        "numero_dias": str(numero_dias),
        "fecha_ida": fecha_ida,
        "fecha_vuelta": fecha_vuelta,
        "flexibilidad_dias": str(flexibilidad),
        "tipo_vuelo": tipo_vuelo,
        "presupuesto_max_noche": str(presupuesto_max_noche),
    }


def save_report(result: str, inputs: dict) -> str:
    """Guarda el reporte final en un archivo Markdown."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"viaje_{inputs['pais_destino'].lower().replace(' ', '_')}_{timestamp}.md"

    report = f"""# 🌍 Plan de Viaje: {inputs['pais_origen']} → {inputs['pais_destino']}

> Generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M')}
> Adultos: {inputs['numero_adultos']} | Fechas: {inputs['fecha_ida']} → {inputs['fecha_vuelta']} ({inputs['numero_dias']} días, ±{inputs['flexibilidad_dias']}d) | Presupuesto max/noche: {inputs['presupuesto_max_noche']}€

---

{result}

---

*Generado por la Agencia de Viajes Inteligente — Sistema Multi-Agente con CrewAI*
"""

    with open(filename, "w", encoding="utf-8") as f:
        f.write(report)

    return filename


def main():
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: No se encontró OPENAI_API_KEY ni GEMINI_API_KEY")
        print("Crea un archivo .env con tu API key. Ver .env.example")
        sys.exit(1)

    inputs = collect_user_inputs()

    print()
    print("=" * 60)
    print("  CONFIGURACIÓN DEL VIAJE")
    print("=" * 60)
    print(f"  Origen:              {inputs['pais_origen']}")
    print(f"  Destino:             {inputs['pais_destino']}")
    print(f"  Adultos:             {inputs['numero_adultos']}")
    print(f"  Fechas:              {inputs['fecha_ida']} → {inputs['fecha_vuelta']} ({inputs['numero_dias']} días)")
    print(f"  Flexibilidad:        ±{inputs['flexibilidad_dias']} días")
    print(f"  Max por noche:       {inputs['presupuesto_max_noche']}€")
    print("=" * 60)
    print()
    print("Iniciando los agentes de planificación...")
    print("Cada agente te pedirá aprobación antes de continuar.\n")

    from src.trip_planner_webapp.crew import TripPlannerCrew

    trip_crew = TripPlannerCrew()
    result = trip_crew.crew().kickoff(inputs=inputs)

    print()
    print("=" * 60)
    print("  PLANIFICACIÓN COMPLETADA")
    print("=" * 60)
    print()
    print(result.raw)

    filename = save_report(result.raw, inputs)
    print(f"\nReporte guardado en: {filename}")


if __name__ == "__main__":
    main()
