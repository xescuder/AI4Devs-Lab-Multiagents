from pydantic import BaseModel
from typing import Optional


class Actividad(BaseModel):
    nombre: str
    duracion_horas: float
    coste_eur: float
    ubicacion: str


class Desplazamiento(BaseModel):
    origen: str
    destino: str
    modo: str
    distancia_km: Optional[float] = None
    duracion_min: Optional[int] = None
    coste_eur: float


class DiaItinerario(BaseModel):
    dia: int
    actividades: list[Actividad]
    desplazamientos: list[Desplazamiento]
    alojamiento: str
    coste_dia_eur: float


class Itinerario(BaseModel):
    destino: str
    dias: int
    personas: int
    vuelos_coste_eur: float
    alojamiento_coste_eur: float
    transporte_coste_eur: float
    actividades_coste_eur: float
    coste_total_eur: float
    presupuesto_eur: float
    plan: list[DiaItinerario]
