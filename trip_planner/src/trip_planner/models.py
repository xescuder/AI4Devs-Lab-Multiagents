from typing import Annotated, Literal

from pydantic import BaseModel, Field


class Attraction(BaseModel):
    name: str
    zone: str
    description: str
    estimated_duration_hours: float


class DayResearch(BaseModel):
    day_number: int
    zone: str
    attractions: list[Attraction]


class DestinationResearch(BaseModel):
    destination: str
    number_of_days: int
    days: list[DayResearch]


class Activity(BaseModel):
    time_slot: Literal["Mañana", "Tarde", "Noche"]
    start_time: Annotated[str, Field(pattern=r"^\d{2}:\d{2}$")]
    end_time: Annotated[str, Field(pattern=r"^\d{2}:\d{2}$")]
    name: str
    location: str
    description: str


class ItineraryDay(BaseModel):
    day_number: int
    title: str
    activities: list[Activity]


class Itinerary(BaseModel):
    destination: str
    number_of_days: int
    days: list[ItineraryDay]
