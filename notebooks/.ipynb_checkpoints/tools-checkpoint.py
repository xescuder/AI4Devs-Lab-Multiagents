import os
import requests
from crewai.tools import tool


def _geocode(place: str, api_key: str) -> str | None:
    """Resuelve un nombre de lugar a 'lat,lng' via Geocoding API."""
    resp = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": place, "language": "es", "key": api_key},
        timeout=10,
    )
    data = resp.json()
    if data["status"] == "OK" and data["results"]:
        loc = data["results"][0]["geometry"]["location"]
        return f"{loc['lat']},{loc['lng']}"
    return None


@tool("Google Maps Distance")
def google_maps_distance(origin: str, destination: str, mode: str = "driving") -> str:
    """Calcula distancia y tiempo entre dos puntos usando Google Maps.
    Acepta nombres de lugares, direcciones o coordenadas.
    mode puede ser: driving, transit, walking, bicycling."""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return "Error: GOOGLE_MAPS_API_KEY no configurada en el .env"

    # ponytail: geocode primero para resolver nombres ambiguos a coords
    origin_resolved = _geocode(origin, api_key) or origin
    dest_resolved = _geocode(destination, api_key) or destination

    resp = requests.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        params={
            "origins": origin_resolved,
            "destinations": dest_resolved,
            "mode": mode,
            "language": "es",
            "key": api_key,
        },
        timeout=10,
    )
    data = resp.json()

    if data["status"] != "OK":
        return f"Error de la API: {data['status']}"

    element = data["rows"][0]["elements"][0]
    if element["status"] != "OK":
        return f"No se encontró ruta entre '{origin}' y '{destination}': {element['status']}"

    distance = element["distance"]["text"]
    duration = element["duration"]["text"]
    return f"{origin} → {destination} ({mode}): {distance}, {duration}"
