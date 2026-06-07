"""
Herramientas de web crawling con Crawl4AI para la Agencia de Viajes Inteligente.

Crawl4AI usa un browser headless real (Playwright) para renderizar JavaScript
y extraer contenido de páginas dinámicas como Kayak, Booking, Airbnb.
"""

import asyncio
import json
import re
from pathlib import Path

from crewai.tools import tool

from .search_tools import _cache_get, _cache_set, _to_iata


def _run_crawl(url: str, delay: float = 8.0, js_code: str = None) -> str:
    """Run Crawl4AI synchronously with JS rendering support."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

    async def _crawl():
        config = CrawlerRunConfig(
            wait_until="domcontentloaded",
            page_timeout=20000,
            delay_before_return_html=delay,
        )
        if js_code:
            config.js_code = js_code

        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url, config=config)
            if result.markdown and len(result.markdown) > 100:
                return result.markdown
            return f"[Error] No content from {url}"

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(lambda: asyncio.run(_crawl())).result(timeout=60)
        return asyncio.run(_crawl())
    except Exception as e:
        return f"[Crawl error: {e}]"


def _extract_kayak_flights(markdown: str) -> str:
    """Extract only flight results from Kayak markdown, removing navigation noise."""
    lines = markdown.split("\n")
    results = []
    in_results = False

    for line in lines:
        s = line.strip()
        if not s:
            continue

        if s.startswith("* [") and ("kayak." in s or "Español" in s or "English" in s):
            continue
        if any(skip in s for skip in ["Buscar un país", "Escríbenos", "Configuración de las cookies",
                                       "Nos importa tu privacidad", "Descarga la app"]):
            continue

        if re.search(r"\d+\s*€|directo|escala|stop|\d+h\s*\d+m|Icelandair|PLAY|Vueling|easyJet|Ryanair|Iberia|Lufthansa|Economy|Business", s, re.I):
            in_results = True

        if in_results:
            clean = re.sub(r"!\[.*?\]\(.*?\)", "", s).strip()
            clean = re.sub(r"\[([^\]]*)\]\([^\)]*\)", r"\1", clean).strip()
            if clean and len(clean) > 1:
                results.append(clean)

    return "\n".join(results) if results else "No se encontraron resultados de vuelos."


# ---------------------------------------------------------------------------
# Kayak flight crawl
# ---------------------------------------------------------------------------

@tool("Kayak flight crawl")
def crawl_kayak_flights(
    departure: str,
    destination: str,
    date: str,
    return_date: str = "",
    adults: int = 2,
    direct_only: bool = True,
    max_departure_hour: int = 0,
) -> str:
    """Busca vuelos REALES haciendo crawling de Kayak.es con un browser headless.
    Devuelve precios, aerolíneas, horarios, escalas y duración REALES.
    Los resultados son de kayak.es (España, precios en EUR).

    Args:
        departure: Código IATA de salida (ej: 'BCN')
        destination: Código IATA de destino (ej: 'KEF')
        date: Fecha ida YYYY-MM-DD
        return_date: Fecha vuelta YYYY-MM-DD
        adults: Número de adultos
        direct_only: True para solo vuelos directos
        max_departure_hour: Hora máxima de salida (0-23). 0 = sin filtro.
                            Ej: 12 para vuelos que salen antes de las 12:00.
    """
    dep = _to_iata(departure).upper()
    dest = _to_iata(destination).upper()

    cache_key = f"kayak_{dep}_{dest}_{date}_{return_date}_{adults}_{direct_only}_{max_departure_hour}"
    cached = _cache_get("crawl_flights", cache_key)
    if cached:
        return cached

    url = f"https://www.kayak.es/flights/{dep}-{dest}/{date}"
    if return_date:
        url += f"/{return_date}"
    url += f"/{adults}adults?sort=price_a"

    filters = []
    if direct_only:
        filters.append("stops=0")
    if max_departure_hour > 0:
        filters.append(f"legdt=0-{max_departure_hour * 100}")
    if filters:
        url += "&fs=" + ";".join(filters)

    js = "window.scrollTo(0, 500); await new Promise(r => setTimeout(r, 5000)); window.scrollTo(0, 1500);"
    raw_content = _run_crawl(url, delay=12.0, js_code=js)

    flights_only = _extract_kayak_flights(raw_content)

    result = json.dumps({
        "source": "kayak.es",
        "url": url,
        "flights": flights_only,
    }, ensure_ascii=False)

    if not flights_only.startswith("No se encontraron"):
        _cache_set("crawl_flights", cache_key, result)

    return result


# ---------------------------------------------------------------------------
# Kayak car rental crawl
# ---------------------------------------------------------------------------

def _extract_kayak_cars(markdown: str) -> str:
    """Extract car rental results from Kayak markdown."""
    lines = markdown.split("\n")
    results = []
    in_results = False

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("* [") and ("kayak." in s or "Español" in s):
            continue
        if any(skip in s for skip in ["Buscar un país", "Escríbenos", "cookies", "privacidad"]):
            continue

        if re.search(r"\d+\s*€|Total|Mini|Economy|Compact|SUV|Sedan|Hertz|Europcar|Sixt|Budget|Avis|Thrifty|EconomyBookings|Manual|Automático", s, re.I):
            in_results = True

        if in_results:
            clean = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", s).strip()
            clean = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", clean).strip()
            if clean and len(clean) > 1:
                results.append(clean)

    return "\n".join(results) if results else "No se encontraron resultados de coches."


@tool("Kayak car rental crawl")
def crawl_kayak_cars(
    location: str,
    pickup_date: str,
    return_date: str,
) -> str:
    """Busca alquiler de coches REALES haciendo crawling de Kayak.es.
    Devuelve precios, categorías de vehículos y empresas de alquiler reales.

    Args:
        location: Ciudad o aeropuerto de recogida (ej: 'Keflavik,Iceland' o 'Reykjavik')
        pickup_date: Fecha recogida YYYY-MM-DD
        return_date: Fecha devolución YYYY-MM-DD
    """
    cache_key = f"kayak_cars_{location}_{pickup_date}_{return_date}"
    cached = _cache_get("crawl_cars", cache_key)
    if cached:
        return cached

    loc = location.strip().replace(" ", "-")
    url = f"https://www.kayak.es/cars/{loc}/{pickup_date}/{return_date}?sort=price_a"

    js = "window.scrollTo(0, 500); await new Promise(r => setTimeout(r, 5000)); window.scrollTo(0, 1500);"
    raw_content = _run_crawl(url, delay=12.0, js_code=js)

    cars_only = _extract_kayak_cars(raw_content)

    result = json.dumps({
        "source": "kayak.es/cars",
        "url": url,
        "cars": cars_only,
    }, ensure_ascii=False)

    if not cars_only.startswith("No se encontraron"):
        _cache_set("crawl_cars", cache_key, result)

    return result


# ---------------------------------------------------------------------------
# Blog/itinerary crawl
# ---------------------------------------------------------------------------

@tool("Blog crawl")
def crawl_itinerary_blog(url: str) -> str:
    """Hace crawling de un blog de viaje y extrae el contenido + imágenes.
    Las imágenes del blog se incluyen en el resultado para usarlas en el
    itinerario en vez de buscar imágenes genéricas.

    Args:
        url: URL del blog o artículo de viaje
    """
    cached = _cache_get("crawl_blog", url)
    if cached:
        return cached

    raw = _run_crawl(url, delay=3.0)

    lines = raw.split("\n") if raw else []
    clean_lines = []
    images = []

    for line in lines:
        s = line.strip()
        if not s or len(s) < 5:
            continue
        if any(skip in s.lower() for skip in ["cookie", "privacidad", "suscri", "newsletter", "publicidad", "©", "sidebar", "widget"]):
            continue

        img_matches = re.findall(r"!\[([^\]]*)\]\(([^)]+)\)", s)
        for alt, img_url in img_matches:
            if img_url.startswith("http") and not any(x in img_url.lower() for x in ["logo", "icon", "avatar", "banner", "ad", "pixel", "tracking"]):
                images.append({"alt": alt, "url": img_url})

        clean = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", s).strip()
        if clean and len(clean) > 3:
            clean_lines.append(clean)

    text_content = "\n".join(clean_lines[:400])

    result = json.dumps({
        "url": url,
        "content": text_content,
        "images": images[:30],
        "image_count": len(images),
    }, ensure_ascii=False)

    if text_content and len(text_content) > 100:
        _cache_set("crawl_blog", url, result)

    return result if text_content else f"[No se pudo extraer contenido de {url}]"


# ---------------------------------------------------------------------------
# Airbnb accommodation crawl
# ---------------------------------------------------------------------------

@tool("Airbnb crawl")
def crawl_airbnb(
    destination: str,
    checkin: str = "",
    checkout: str = "",
    adults: int = 2,
    max_price: int = 0,
    private_bathroom: bool = True,
    kitchen: bool = True,
) -> str:
    """Busca alojamientos REALES haciendo crawling de Airbnb con browser headless.

    Args:
        destination: Ciudad de destino (ej: 'Reykjavik')
        checkin: Fecha check-in YYYY-MM-DD
        checkout: Fecha check-out YYYY-MM-DD
        adults: Número de adultos
        max_price: Precio máximo por noche en EUR (0 = sin límite)
        private_bathroom: True para requerir baño privado
        kitchen: True para requerir cocina
    """
    cache_key = f"airbnb_{destination}_{checkin}_{checkout}_{adults}_{max_price}_{private_bathroom}_{kitchen}"
    cached = _cache_get("crawl_airbnb", cache_key)
    if cached:
        return cached

    dest_slug = destination.lower().replace(" ", "-")
    url = f"https://www.airbnb.es/s/{dest_slug}/homes"
    params = []
    if checkin:
        params.append(f"checkin={checkin}")
    if checkout:
        params.append(f"checkout={checkout}")
    if adults:
        params.append(f"adults={adults}")
    if max_price:
        params.append(f"price_max={max_price}")
    # Airbnb amenity IDs: 45=kitchen, 47=private bathroom/ensuite
    amenities = []
    if kitchen:
        amenities.append("8")
    if private_bathroom:
        amenities.append("47")
    if amenities:
        params.append(f"amenities[]={'&amenities[]='.join(amenities)}")
    if params:
        url += "?" + "&".join(params)

    content = _run_crawl(url, delay=5.0)

    result = json.dumps({
        "source": "airbnb_crawl",
        "url": url,
        "content": content[:5000],
    }, ensure_ascii=False)

    if not content.startswith("["):
        _cache_set("crawl_airbnb", cache_key, result)

    return result


# ---------------------------------------------------------------------------
# Generic web crawl
# ---------------------------------------------------------------------------

@tool("Web page crawl")
def crawl_webpage(url: str) -> str:
    """Hace crawling de cualquier página web con browser headless.

    Args:
        url: URL completa de la página
    """
    cached = _cache_get("crawl_page", url)
    if cached:
        return cached

    content = _run_crawl(url, delay=3.0)

    if not content.startswith("[") and len(content) > 100:
        _cache_set("crawl_page", url, content[:5000])

    return content[:5000]
