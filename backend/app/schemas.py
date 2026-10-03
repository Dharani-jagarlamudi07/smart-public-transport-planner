from pydantic import BaseModel, Field
from typing import Optional, List


class Place(BaseModel):
    name: str
    lat: float
    lng: float
    address: Optional[str] = None


class Point(BaseModel):
    name: str
    lat: float
    lng: float


class Leg(BaseModel):
    mode: str
    from_: Point = Field(alias="from")
    to: Point
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_sec: int = 0
    distance_m: int = 0
    route_short_name: Optional[str] = None
    geometry: List[List[float]] = []

    model_config = {"populate_by_name": True}


class Itinerary(BaseModel):
    id: str
    duration_sec: int
    walk_distance_m: int
    transfers: int
    fare: Optional[float] = None
    score: Optional[float] = None
    recommendation_reason: Optional[str] = None
    legs: List[Leg]


class RouteRequest(BaseModel):
    origin: Place
    destination: Place
    departure_time: Optional[str] = None
    preference: Optional[str] = "balanced"


class SavedRouteCreate(BaseModel):
    title: Optional[str] = None
    origin: Place
    destination: Place
    itinerary: Itinerary


class AlertCreate(BaseModel):
    message: str
    route_ref: Optional[str] = None
    severity: str = "warning"


# --- NEW AUTHENTICATION SCHEMAS ---

class AuthRequest(BaseModel):
    identifier: str  # Can be email or phone number
    type: str = "email" # "email" or "phone"

class OtpResponse(BaseModel):
    success: bool
    message: str
    otp_code: Optional[str] = None # Returned ONLY for demo/hackathon visibility

class VerifyOtpRequest(BaseModel):
    identifier: str
    otp_code: str
    type: str = "email"

class UserSession(BaseModel):
    logged_in: bool
    user_id: str
    identifier: str