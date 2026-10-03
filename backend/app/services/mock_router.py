from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from .geo import haversine_m
from ..schemas import Place


def _point(name: str, lat: float, lng: float) -> Dict[str, Any]:
    return {"name": name, "lat": lat, "lng": lng}


def _interpolate(a: List[float], b: List[float], n: int = 10) -> List[List[float]]:
    """Generates intermediate points for smooth map lines."""
    if n < 2:
        n = 2
    return [
        [a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)]
        for i in range(n)
    ]


def _make_leg(
    mode: str,
    from_p: Dict[str, Any],
    to_p: Dict[str, Any],
    start: datetime,
    speed_kmh: float,
    route_short_name: str | None = None,
    wait_min: float = 0,
) -> Dict[str, Any]:
    distance_m = haversine_m(from_p["lat"], from_p["lng"], to_p["lat"], to_p["lng"])
    
    # Realistic Speed Calculation
    # If walking, keep slow. If transit, use provided speed.
    effective_speed = speed_kmh
    
    # Minimum duration cap (e.g., at least 1 minute per leg)
    travel_sec = max(int(distance_m / (effective_speed * 1000 / 3600)), 60)
    wait_sec = int(wait_min * 60)
    duration_sec = travel_sec + wait_sec

    end = start + timedelta(seconds=duration_sec)

    geometry = _interpolate(
        [from_p["lat"], from_p["lng"]],
        [to_p["lat"], to_p["lng"]],
        n=max(2, min(20, int(distance_m / 500) + 2)), # More points for longer distances
    )

    return {
        "mode": mode,
        "from": from_p,
        "to": to_p,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration_sec": duration_sec,
        "distance_m": int(distance_m),
        "route_short_name": route_short_name,
        "geometry": geometry,
    }


def _append_leg(
    legs: List[Dict[str, Any]],
    start: datetime,
    mode: str,
    from_p: Dict[str, Any],
    to_p: Dict[str, Any],
    speed_kmh: float,
    route_short_name: str | None = None,
    wait_min: float = 0,
) -> datetime:
    leg = _make_leg(mode, from_p, to_p, start, speed_kmh, route_short_name, wait_min)
    legs.append(leg)
    return datetime.fromisoformat(leg["end_time"])


def _finalize(
    itinerary_id: str,
    legs: List[Dict[str, Any]],
    profile: str,
) -> Dict[str, Any]:
    start = datetime.fromisoformat(legs[0]["start_time"])
    end = datetime.fromisoformat(legs[-1]["end_time"])

    duration_sec = int((end - start).total_seconds())
    walk_distance_m = sum(
        leg["distance_m"] for leg in legs if leg["mode"].upper() == "WALK"
    )
    total_distance_m = sum(leg["distance_m"] for leg in legs)

    fare_map = {
        "BUS": 2.0,
        "METRO": 4.0,
        "TRAIN": 6.0,
        "TAXI": 15.0, # Added Taxi for realism
    }

    fare = 0.0
    transfers = 0
    previous_transit_mode = None

    for leg in legs:
        mode = leg["mode"].upper()
        if mode == "WALK":
            continue
        fare += fare_map.get(mode, 3.0)
        if previous_transit_mode is not None and mode != previous_transit_mode:
            transfers += 1
        previous_transit_mode = mode

    return {
        "id": itinerary_id,
        "duration_sec": duration_sec,
        "walk_distance_m": int(walk_distance_m),
        "total_distance_m": int(total_distance_m), # NEW FIELD
        "transfers": transfers,
        "fare": round(fare, 2),
        "profile": profile,
        "legs": legs,
    }


def plan_mock(
    origin: Place,
    destination: Place,
    departure_time: str | None = None,
    preference: str = "balanced",
) -> List[Dict[str, Any]]:
    """
    Generates realistic routes based DIRECTLY on user's Origin/Destination.
    No more hardcoded Bangalore stops.
    """
    dep = datetime.now(timezone.utc) + timedelta(minutes=5)
    if departure_time:
        try:
            dep = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
            if dep.tzinfo is None:
                dep = dep.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    o_p = _point(origin.name, origin.lat, origin.lng)
    d_p = _point(destination.name, destination.lat, destination.lng)

    itineraries: List[Dict[str, Any]] = []

    # ---------------------------------------------------------
    # OPTION 1: Direct Bus/Taxi (Fastest/Most Common)
    # Simulates a direct ride or express bus
    # ---------------------------------------------------------
    legs = []
    t = dep
    # Short walk to pickup point (simulated)
    t = _append_leg(legs, t, "WALK", o_p, o_p, 4.5, wait_min=1) 
    # Main Transit Leg
    t = _append_leg(legs, t, "BUS", o_p, d_p, 30.0, "Express Route 1", wait_min=2)
    # Short walk to dropoff
    t = _append_leg(legs, t, "WALK", d_p, d_p, 4.5, wait_min=0)
    itineraries.append(_finalize("mock-direct-bus", legs, "fastest"))

    # ---------------------------------------------------------
    # OPTION 2: Metro + Walk (Fewer Transfers, Cheaper)
    # Simulates using public rail infrastructure
    # ---------------------------------------------------------
    legs = []
    t = dep
    t = _append_leg(legs, t, "WALK", o_p, o_p, 4.5, wait_min=3)
    t = _append_leg(legs, t, "METRO", o_p, d_p, 40.0, "Metro Line A", wait_min=5)
    t = _append_leg(legs, t, "WALK", d_p, d_p, 4.5, wait_min=1)
    itineraries.append(_finalize("mock-metro-direct", legs, "fewer_transfers"))

    # ---------------------------------------------------------
    # OPTION 3: Two-Stage Transfer (Bus -> Train)
    # Adds an intermediate point to simulate a transfer hub
    # ---------------------------------------------------------
    # Calculate a midpoint roughly halfway between O and D
    mid_lat = (o_p["lat"] + d_p["lat"]) / 2
    mid_lng = (o_p["lng"] + d_p["lng"]) / 2
    mid_p = _point("Transfer Hub", mid_lat, mid_lng)

    legs = []
    t = dep
    t = _append_leg(legs, t, "WALK", o_p, o_p, 4.5, wait_min=2)
    t = _append_leg(legs, t, "BUS", o_p, mid_p, 25.0, "Feeder Bus 12", wait_min=3)
    t = _append_leg(legs, t, "WALK", mid_p, mid_p, 4.5, wait_min=2) # Transfer walk
    t = _append_leg(legs, t, "TRAIN", mid_p, d_p, 45.0, "Suburban Rail", wait_min=4)
    t = _append_leg(legs, t, "WALK", d_p, d_p, 4.5, wait_min=1)
    itineraries.append(_finalize("mock-transfer-combo", legs, "transfer"))

    return itineraries