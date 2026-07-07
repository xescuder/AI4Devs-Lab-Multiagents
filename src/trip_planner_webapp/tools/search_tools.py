"""
Herramientas de búsqueda web real para la Agencia de Viajes Inteligente.

Usa SerperDevTool para búsquedas en Google (vuelos en Skyscanner/Google Flights,
alojamientos en Airbnb, actividades en GetYourGuide/Viator).
Incluye cache en disco para no repetir búsquedas idénticas entre sesiones.
"""

import hashlib
import json
import os
from pathlib import Path

import httpx
from crewai.tools import tool
from crewai_tools import SerperDevTool

# ---------------------------------------------------------------------------
# Cache en disco
# ---------------------------------------------------------------------------

CACHE_DIR = Path(__file__).parent.parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

SERPER_URL = "https://google.serper.dev"


TTL_HOURS = {
    "flights": 24,
    "crawl_flights": 24,
    "car": 24,
    "crawl_cars": 24,
    "activities": 168,
    "itinerary_blogs": 720,
    "crawl_blog": 720,
    "accommodation": 24,
    "crawl_airbnb": 24,
    "acc_img": 720,
    "act_img": 720,
}


def _cache_key(prefix: str, query: str) -> Path:
    h = hashlib.md5(query.lower().strip().encode()).hexdigest()
    return CACHE_DIR / f"{prefix}_{h}.json"


def _cache_get(prefix: str, query: str) -> str | None:
    path = _cache_key(prefix, query)
    if path.exists():
        try:
            data = json.loads(path.read_text())
            cached_at = data.get("cached_at", 0)
            ttl = TTL_HOURS.get(prefix, 24) * 3600
            import time
            if time.time() - cached_at < ttl:
                return data.get("result")
        except (json.JSONDecodeError, KeyError):
            pass
    return None


def _cache_set(prefix: str, query: str, result: str):
    import time
    path = _cache_key(prefix, query)
    path.write_text(json.dumps({
        "query": query,
        "result": result,
        "cached_at": time.time(),
        "prefix": prefix,
    }, ensure_ascii=False))


# ---------------------------------------------------------------------------
# IATA code mapping for Skyscanner URLs
# ---------------------------------------------------------------------------

IATA_CODES = {
    "barcelona": "bcn", "madrid": "mad", "sevilla": "svq", "malaga": "agp",
    "valencia": "vlc", "bilbao": "bio", "alicante": "alc", "palma": "pmi",
    "london": "lon", "londres": "lon", "paris": "par", "roma": "fco",
    "rome": "fco", "milan": "mxp", "berlin": "ber", "amsterdam": "ams",
    "lisbon": "lis", "lisboa": "lis", "dublin": "dub", "new york": "nyc",
    "nueva york": "nyc", "los angeles": "lax", "tokyo": "tyo", "tokio": "tyo",
    "reykjavik": "kef", "islandia": "kef", "iceland": "kef",
    "bangkok": "bkk", "dubai": "dxb", "istanbul": "ist", "estambul": "ist",
    "atenas": "ath", "athens": "ath", "vienna": "vie", "viena": "vie",
    "zurich": "zrh", "copenhague": "cph", "copenhagen": "cph",
    "oslo": "osl", "estocolmo": "arn", "stockholm": "arn",
    "helsinki": "hel", "varsovia": "waw", "warsaw": "waw",
    "praga": "prg", "prague": "prg", "budapest": "bud",
    "buenos aires": "bue", "mexico": "mex", "bogota": "bog",
    "lima": "lim", "santiago": "scl", "sao paulo": "gru",
}


def _to_iata(city_or_code: str) -> str:
    """Convert city name or IATA code to lowercase IATA code for Skyscanner URL."""
    val = city_or_code.lower().strip()
    if len(val) == 3 and val.isalpha():
        return val
    for city, code in IATA_CODES.items():
        if city in val:
            return code
    return val[:3]


# ---------------------------------------------------------------------------
# Serper headers helper
# ---------------------------------------------------------------------------

def _serper_headers():
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return None
    return {"X-API-KEY": api_key, "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Web search tool — shared instance
# ---------------------------------------------------------------------------

web_search = SerperDevTool()
web_search_es = SerperDevTool(country="es", locale="es")


# ---------------------------------------------------------------------------
# Flight search
# ---------------------------------------------------------------------------

@tool("Skyscanner flight search")
def search_flights(
    departure: str,
    destination: str,
    date: str,
    return_date: str = "",
    adults: int = 1,
) -> str:
    """Busca vuelos REALES en Google Flights, Skyscanner, Kayak y webs de aerolíneas.
    Devuelve precios reales y una URL de verificación en Skyscanner.

    Args:
        departure: Ciudad o código IATA de salida (ej: 'Barcelona' o 'BCN')
        destination: Ciudad o código IATA de destino (ej: 'Reykjavik' o 'KEF')
        date: Fecha de ida YYYY-MM-DD (ej: '2026-09-07')
        return_date: Fecha de vuelta YYYY-MM-DD. Vacío para solo ida.
        adults: Número de adultos.
    """
    cache_key = f"{departure}_{destination}_{date}_{return_date}_{adults}"
    cached = _cache_get("flights", cache_key)
    if cached:
        return cached

    # Generate Skyscanner URL
    date_short = date.replace("-", "")[2:]
    ret_short = return_date.replace("-", "")[2:] if return_date else ""
    dep_code = _to_iata(departure)
    dest_code = _to_iata(destination)
    sky_url = f"https://www.skyscanner.net/transport/flights/{dep_code}/{dest_code}/{date_short}"
    if ret_short:
        sky_url += f"/{ret_short}"
    sky_url += "?currency=EUR"

    # Parse date for readable format
    try:
        from datetime import datetime
        d = datetime.strptime(date, "%Y-%m-%d")
        date_readable = d.strftime("%B %d %Y")
    except Exception:
        date_readable = date

    ret_readable = ""
    if return_date:
        try:
            from datetime import datetime
            d2 = datetime.strptime(return_date, "%Y-%m-%d")
            ret_readable = d2.strftime("%B %d %Y")
        except Exception:
            ret_readable = return_date

    # Web search for real prices
    query = f"{departure} to {destination} flights {date_readable}"
    if ret_readable:
        query += f" return {ret_readable}"
    query += " round trip price"

    search_result = web_search.run(search_query=query)

    # Second search specifically on Skyscanner
    sky_query = f"site:skyscanner.net {departure} {destination} flights"
    sky_search = web_search.run(search_query=sky_query)

    result = json.dumps({
        "skyscanner_url": sky_url,
        "google_flights_results": search_result,
        "skyscanner_results": sky_search,
        "route": f"{departure} → {destination}",
        "dates": {"outbound": date, "return": return_date},
        "note": "Precios de búsqueda web REAL. Usa SOLO estos precios, no inventes.",
    }, ensure_ascii=False)

    _cache_set("flights", cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Car rental search
# ---------------------------------------------------------------------------

@tool("Car rental search")
def search_car_rental(
    destination: str,
    pickup_date: str = "",
    return_date: str = "",
) -> str:
    """Busca opciones REALES de alquiler de coche en Google, Kayak, Rentalcars, etc.

    Args:
        destination: Ciudad o país de destino (ej: 'Islandia' o 'Reykjavik')
        pickup_date: Fecha recogida YYYY-MM-DD
        return_date: Fecha devolución YYYY-MM-DD
    """
    cache_key = f"car_{destination}_{pickup_date}_{return_date}"
    cached = _cache_get("car", cache_key)
    if cached:
        return cached

    query = f"alquiler coche {destination}"
    if pickup_date:
        query += f" desde {pickup_date}"
    if return_date:
        query += f" hasta {return_date}"
    query += " precio rentalcars OR europcar OR hertz OR sixt"

    search_result = web_search.run(search_query=query)

    result = json.dumps({
        "web_search_results": search_result,
        "note": "Precios de búsqueda web real.",
    }, ensure_ascii=False)

    _cache_set("car", cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Itinerary blog search — finds real blog posts with day-by-day itineraries
# ---------------------------------------------------------------------------

@tool("Itinerary blog search")
def search_itinerary_blogs(
    destination: str,
    days: int = 7,
) -> str:
    """Busca blogs REALES con itinerarios día a día para el destino.
    Devuelve las URLs de los mejores blogs para que luego se pueda hacer
    crawling de cada uno con la herramienta 'Blog crawl'.

    Args:
        destination: País o región (ej: 'Islandia' o 'Ring Road Islandia')
        days: Número de días del viaje
    """
    cache_key = f"blogs_{destination}_{days}"
    cached = _cache_get("itinerary_blogs", cache_key)
    if cached:
        return cached

    exclude = " -site:facebook.com -site:instagram.com -site:twitter.com -site:tiktok.com -site:youtube.com -site:pinterest.com -site:tripadvisor.com"
    day_range = f"{days - 1} OR {days} OR {days + 1}"
    queries = [
        f"itinerario {day_range} días {destination} ruta completa día a día blog 2024 OR 2025 OR 2026{exclude}",
        f"ruta {day_range} días {destination} en coche itinerario completo día 1 día 2 blog{exclude}",
    ]

    all_results = []
    for q in queries:
        search_result = web_search_es.run(search_query=q)
        all_results.append(search_result)

    result = json.dumps({
        "search_queries": queries,
        "results": all_results,
        "note": "Usa 'Blog crawl' para obtener el contenido completo de los mejores blogs.",
    }, ensure_ascii=False)

    _cache_set("itinerary_blogs", cache_key, result)
    return result


@tool("Activities search")
def search_activities(
    destination: str,
    activity_type: str = "",
) -> str:
    """Busca actividades, precios de entradas y experiencias en GetYourGuide, Viator.

    Args:
        destination: Ciudad o país (ej: 'Reykjavik' o 'Islandia')
        activity_type: Tipo de actividad (ej: 'excursión', 'museo', 'tour')
    """
    cache_key = f"act_{destination}_{activity_type}"
    cached = _cache_get("activities", cache_key)
    if cached:
        return cached

    query = f"mejores actividades {destination}"
    if activity_type:
        query += f" {activity_type}"
    query += " precio getyourguide OR viator OR tripadvisor 2025 2026"

    search_result = web_search.run(search_query=query)

    result = json.dumps({
        "web_search_results": search_result,
        "note": "Precios reales de actividades.",
    }, ensure_ascii=False)

    _cache_set("activities", cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Accommodation search
# ---------------------------------------------------------------------------

@tool("Accommodation search")
def search_accommodation(
    destination: str,
    max_price: float = 0,
    guests: int = 2,
) -> str:
    """Busca alojamientos REALES tipo Airbnb en Airbnb, Booking, etc.

    Args:
        destination: Ciudad o barrio (ej: 'Reykjavik centro')
        max_price: Precio máximo por noche en EUR (0 = sin límite)
        guests: Número de huéspedes
    """
    cache_key = f"acc_{destination}_{max_price}_{guests}"
    cached = _cache_get("accommodation", cache_key)
    if cached:
        return cached

    query = f"airbnb {destination} {guests} huéspedes"
    if max_price > 0:
        query += f" máximo {max_price}€ noche"
    query += " site:airbnb.com OR booking.com"

    search_result = web_search.run(search_query=query)

    result = json.dumps({
        "web_search_results": search_result,
        "note": "Resultados de búsqueda web real.",
    }, ensure_ascii=False)

    _cache_set("accommodation", cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Image search — Accommodation
# ---------------------------------------------------------------------------

@tool("Accommodation image search")
def search_accommodation_image(query: str) -> str:
    """Busca imagen y URL de un alojamiento en Airbnb.

    Args:
        query: Búsqueda descriptiva. Ej: 'loft moderno Reykjavik centro'
    """
    cached = _cache_get("acc_img", query)
    if cached:
        return cached

    headers = _serper_headers()
    if not headers:
        return json.dumps({"image_url": "", "listing_url": ""})

    image_url = ""
    listing_url = ""

    try:
        response = httpx.post(
            f"{SERPER_URL}/images", headers=headers,
            json={"q": f"site:airbnb.com {query}", "num": 5}, timeout=10,
        )
        if response.status_code == 200:
            for img in response.json().get("images", []):
                src = img.get("source", "").lower()
                link = img.get("link", "")
                if "airbnb" in src or "airbnb" in link:
                    image_url = img.get("imageUrl", "")
                    if "airbnb" in link:
                        listing_url = link
                    break
            if not image_url:
                images = response.json().get("images", [])
                if images:
                    image_url = images[0].get("imageUrl", "")
    except Exception:
        pass

    if not listing_url:
        try:
            response = httpx.post(
                f"{SERPER_URL}/search", headers=headers,
                json={"q": f"site:airbnb.com {query}", "num": 3}, timeout=10,
            )
            if response.status_code == 200:
                for item in response.json().get("organic", []):
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


# ---------------------------------------------------------------------------
# Image search — Activities
# ---------------------------------------------------------------------------

@tool("Activity image search")
def search_activity_image(query: str) -> str:
    """Busca foto real de una actividad o lugar turístico.

    Args:
        query: Nombre del lugar con la ciudad. Ej: 'Hallgrimskirkja Reykjavik'
    """
    cached = _cache_get("act_img", query)
    if cached:
        return cached

    headers = _serper_headers()
    if not headers:
        return "[SERPER_API_KEY no configurada]"

    try:
        response = httpx.post(
            f"{SERPER_URL}/images", headers=headers,
            json={"q": query, "num": 3}, timeout=10,
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
            f"{SERPER_URL}/search", headers=headers,
            json={"q": f"{query} foto", "num": 3}, timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            kg = data.get("knowledgeGraph", {})
            if kg.get("imageUrl"):
                _cache_set("act_img", query, kg["imageUrl"])
                return kg["imageUrl"]
            for item in data.get("organic", []):
                if item.get("thumbnail"):
                    _cache_set("act_img", query, item["thumbnail"])
                    return item["thumbnail"]
    except Exception:
        pass

    return f"[No se encontraron imágenes para: {query}]"


@tool("Quick Web Search with Firecrawl")
def firecrawl_search_tool(query: str) -> str:
    """Performs a quick real-time search using Firecrawl and returns summarized results."""
    app = FirecrawlApp()
    result = app.search(query)
    if not result.success:
        return "Search failed."
 
    summary = "\n\n".join(
        [
            f"{item['title']}\n{item['url']}\n{item['description']}"
            for item in result.data[:5]
        ]
    )
    return f"Top Search Results:\n\n{summary}"