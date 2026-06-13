#!/usr/bin/env python
import os
from trip_planner.crew import TripPlannerCrew

os.makedirs('output', exist_ok=True)


def run():
    """
    Run the crew.
    """
   
    inputs = {
        'destination': 'Portugal',
        'number_of_days': '7',
    }

    result = TripPlannerCrew().crew().kickoff(inputs=inputs)

    # Print the result
    print("\n\n=== FINAL REPORT ===\n\n")
    print(result.raw)

    print("\n\nReport has been saved to itinerario_actividades.md")


if __name__ == "__main__":
    run()