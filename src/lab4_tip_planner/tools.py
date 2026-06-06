"""
Herramientas de búsqueda para los agentes de la Agencia de Viajes Inteligente.

En producción, estas herramientas conectarían con APIs reales (Google Flights,
Booking, Airbnb, etc.) o usarían SerperDevTool / ScrapeWebsiteTool de CrewAI.
Aquí se definen como placeholders listos para ser reemplazados.

Incluye un cache en disco para no repetir búsquedas idénticas entre sesiones.
"""

import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx
from crewai.tools import tool

# ---------------------------------------------------------------------------
# Cache en disco — evita repetir llamadas a APIs con la misma query
# ---------------------------------------------------------------------------

CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)


def _cache_key(prefix: str, query: str) -> Path:
    h = hashlib.md5(query.lower().strip().encode()).hexdigest()
    return CACHE_DIR / f"{prefix}_{h}.json"


def _cache_get(prefix: str, query: str) -> str | None:
    path = _cache_key(prefix, query)
    if path.exists():
        data = json.loads(path.read_text())
        return data.get("result")
    return None


def _cache_set(prefix: str, query: str, result: str):
    path = _cache_key(prefix, query)
    path.write_text(json.dumps({"query": query, "result": result}, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Para usar herramientas reales de CrewAI, descomenta las siguientes líneas
# y añade las API keys correspondientes en tu archivo .env:
#
# from crewai_tools import SerperDevTool, ScrapeWebsiteTool
#
# search_tool = SerperDevTool()        # Requiere SERPER_API_KEY
# scrape_tool = ScrapeWebsiteTool()    # Scraping genérico de webs
# ---------------------------------------------------------------------------


@tool
def search_flights(query: str) -> str:
    """Busca vuelos internacionales según los criterios especificados.
    Usa esta herramienta para encontrar opciones de vuelo con precios,
    horarios y escalas.

    Args:
        query: Descripción de la búsqueda, ej: 'vuelos Madrid a Tokio julio 2025'
    """
    # TODO: Integrar con una API real de vuelos (Amadeus, Skyscanner, Serper)
    return (
        f"[PLACEHOLDER] Resultados de búsqueda de vuelos para: {query}\n"
        "En producción, esta herramienta consultaría APIs reales como "
        "Amadeus, Skyscanner o Google Flights vía SerperDevTool.\n"
        "Por ahora, el agente debe usar su conocimiento para generar "
        "propuestas realistas basadas en rutas y precios típicos."
    )


@tool
def search_car_rental(query: str) -> str:
    """Busca opciones de alquiler de coches en el destino especificado.
    Usa esta herramienta para encontrar empresas, categorías y precios.

    Args:
        query: Descripción de la búsqueda, ej: 'alquiler coche Japón 10 días'
    """
    # TODO: Integrar con una API real (Rentalcars, Kayak, Serper)
    return (
        f"[PLACEHOLDER] Resultados de alquiler de coches para: {query}\n"
        "En producción, esta herramienta consultaría APIs reales como "
        "Rentalcars.com o Kayak vía SerperDevTool.\n"
        "Por ahora, el agente debe usar su conocimiento para generar "
        "propuestas realistas basadas en el destino y duración."
    )


@tool
def search_activities(query: str) -> str:
    """Busca actividades, atracciones y experiencias turísticas en el destino.
    Usa esta herramienta para encontrar las mejores experiencias locales
    con precios y horarios.

    Args:
        query: Descripción de la búsqueda, ej: 'mejores actividades Tokio cultura'
    """
    # TODO: Integrar con una API real (GetYourGuide, Viator, Serper)
    return (
        f"[PLACEHOLDER] Resultados de actividades para: {query}\n"
        "En producción, esta herramienta consultaría APIs reales como "
        "GetYourGuide, Viator o TripAdvisor vía SerperDevTool.\n"
        "Por ahora, el agente debe usar su conocimiento para generar "
        "un itinerario realista con actividades y precios típicos."
    )


@tool
def search_accommodation(query: str) -> str:
    """Busca alojamientos tipo Airbnb o apartamentos turísticos en el destino.
    Usa esta herramienta para encontrar opciones con precios, ubicación
    y valoraciones.

    Args:
        query: Descripción de la búsqueda, ej: 'airbnb Tokio Shinjuku max 120€/noche'
    """
    # TODO: Integrar con una API real (Airbnb, Booking, Serper)
    return (
        f"[PLACEHOLDER] Resultados de alojamiento para: {query}\n"
        "En producción, esta herramienta consultaría APIs reales como "
        "Airbnb o Booking.com vía SerperDevTool.\n"
        "Por ahora, el agente debe usar su conocimiento para generar "
        "propuestas realistas de alojamiento con precios típicos."
    )


@tool
def search_accommodation_image(query: str) -> str:
    """Busca una foto REAL de un alojamiento en Airbnb y devuelve image_url y listing_url
    en una sola llamada. Los resultados se cachean para no repetir búsquedas.

    IMPORTANTE: Si ya buscaste un alojamiento similar antes, NO vuelvas a llamar
    esta herramienta. Reutiliza la URL de la búsqueda anterior.

    Args:
        query: Búsqueda descriptiva del alojamiento.
               Ej: 'loft moderno terraza Gracia Barcelona'
    """
    cached = _cache_get("acc_img", query)
    if cached:
        return cached

    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return json.dumps({"image_url": "", "listing_url": ""})

    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    image_url = ""
    listing_url = ""

    try:
        response = httpx.post(
            "https://google.serper.dev/images",
            headers=headers,
            json={"q": f"site:airbnb.com {query}", "num": 5},
            timeout=10,
        )
        if response.status_code == 200:
            images = response.json().get("images", [])
            for img in images:
                src = img.get("source", "").lower()
                url = img.get("imageUrl", "")
                link = img.get("link", "")
                if "airbnb" in src or "airbnb" in link:
                    image_url = url
                    if "airbnb" in link:
                        listing_url = link
                    break
            if not image_url and images:
                image_url = images[0].get("imageUrl", "")
    except Exception:
        pass

    if not listing_url:
        try:
            response = httpx.post(
                "https://google.serper.dev/search",
                headers=headers,
                json={"q": f"site:airbnb.com {query}", "num": 3},
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                for item in data.get("organic", []):
                    link = item.get("link", "")
                    if "airbnb" in link and "/rooms/" in link:
                        listing_url = link
                        if not image_url and item.get("thumbnail"):
                            image_url = item["thumbnail"]
                        break
        except Exception:
            pass

    result = json.dumps({"image_url": image_url, "listing_url": listing_url})
    _cache_set("acc_img", query, result)
    return result


@tool
def search_activity_image(query: str) -> str:
    """Busca una foto real de una actividad, monumento o lugar turístico
    y devuelve la URL directa de la imagen.

    Args:
        query: Nombre del lugar o actividad con la ciudad.
               Ej: 'Hallgrimskirkja Reykjavik'
    """
    cached = _cache_get("act_img", query)
    if cached:
        return cached

    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return "[SERPER_API_KEY no configurada]"

    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}

    try:
        response = httpx.post(
            "https://google.serper.dev/images",
            headers=headers,
            json={"q": query, "num": 3},
            timeout=10,
        )
        if response.status_code == 200:
            images = response.json().get("images", [])
            if images:
                result = images[0].get("imageUrl", "")
                if result:
                    _cache_set("act_img", query, result)
                    return result
    except Exception:
        pass

    try:
        response = httpx.post(
            "https://google.serper.dev/search",
            headers=headers,
            json={"q": f"{query} foto", "num": 3},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        kg = data.get("knowledgeGraph", {})
        if kg.get("imageUrl"):
            result = kg["imageUrl"]
            _cache_set("act_img", query, result)
            return result

        for item in data.get("organic", []):
            if item.get("thumbnail"):
                result = item["thumbnail"]
                _cache_set("act_img", query, result)
                return result
    except Exception:
        pass

    return f"[No se encontraron imágenes para: {query}]"
