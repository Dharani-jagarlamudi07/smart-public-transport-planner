from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from .geo import haversine_m
from ..schemas import Place


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _point(name: str, lat: float, lng: float) -> Dict[str, Any]:
    return {"name": name, "lat": lat, "lng": lng}


def _interpolate(a: List[float], b: List[float], n: int = 10) -> List[List[float]]:
    if n < 2:
        n = 2
    return [
        [a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)]
        for i in range(n)
    ]


def _geom(a: Dict[str, Any], b: Dict[str, Any]) -> List[List[float]]:
    distance_m = haversine_m(a["lat"], a["lng"], b["lat"], b["lng"])
    n = max(2, min(20, int(distance_m / 500) + 2))
    return _interpolate([a["lat"], a["lng"]], [b["lat"], b["lng"]], n)


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
    travel_sec = max(int(distance_m / (speed_kmh * 1000 / 3600)), 60)
    wait_sec = int(wait_min * 60)
    duration_sec = travel_sec + wait_sec
    end = start + timedelta(seconds=duration_sec)
    return {
        "mode": mode,
        "from": from_p,
        "to": to_p,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration_sec": duration_sec,
        "distance_m": int(distance_m),
        "route_short_name": route_short_name,
        "geometry": _geom(from_p, to_p),
    }


def _fixed_leg(
    mode: str,
    from_p: Dict[str, Any],
    to_p: Dict[str, Any],
    start: datetime,
    minutes: float,
    route_short_name: str | None = None,
    wait_min: float = 0,
) -> Dict[str, Any]:
    distance_m = haversine_m(from_p["lat"], from_p["lng"], to_p["lat"], to_p["lng"])
    duration_sec = int(minutes * 60) + int(wait_min * 60)
    end = start + timedelta(seconds=duration_sec)
    return {
        "mode": mode,
        "from": from_p,
        "to": to_p,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration_sec": duration_sec,
        "distance_m": int(distance_m),
        "route_short_name": route_short_name,
        "geometry": _geom(from_p, to_p),
    }


def _add(legs: List[Dict[str, Any]], leg: Dict[str, Any]) -> datetime:
    legs.append(leg)
    return datetime.fromisoformat(leg["end_time"])


# ---------------------------------------------------------------------------
# Real Hyderabad Metro stations & landmarks
# ---------------------------------------------------------------------------

NAMPALLY_METRO = _point("Nampally Metro Station (Red Line)", 17.3897, 78.4626)
AMEERPET_METRO = _point("Ameerpet Metro Interchange", 17.4375, 78.4483)
SEC_EAST_METRO = _point("Secunderabad East Metro (Blue Line)", 17.4385, 78.4927)
HITEC_METRO = _point("HITEC City Metro (Blue Line)", 17.4450, 78.3900)
OMC_METRO = _point("Osmania Medical College Metro (Red Line)", 17.3680, 78.4740)
CHARMINAR = _point("Charminar", 17.3616, 78.4747)

# Real metro segment travel times (minutes)
T_NAMPALLY_AMEERPET = 12
T_AMEERPET_SEC_EAST = 9
T_HITEC_AMEERPET = 13
T_HITEC_SEC_EAST = 22
T_NAMPALLY_OMC = 7
T_AMEERPET_OMC = 16
T_SEC_EAST_AMEERPET = 9


def _metro_fare(km: float) -> float:
    """Hyderabad Metro (HMRL) style distance slabs."""
    if km <= 2:
        return 10.0
    if km <= 5:
        return 15.0
    if km <= 8:
        return 20.0
    if km <= 12:
        return 25.0
    if km <= 17:
        return 30.0
    if km <= 23:
        return 35.0
    return 45.0


def _finalize(itinerary_id: str, legs: List[Dict[str, Any]], profile: str) -> Dict[str, Any]:
    start = datetime.fromisoformat(legs[0]["start_time"])
    end = datetime.fromisoformat(legs[-1]["end_time"])
    duration_sec = int((end - start).total_seconds())
    walk_m = sum(l["distance_m"] for l in legs if l["mode"].upper() == "WALK")
    total_m = sum(l["distance_m"] for l in legs)

    fare = 0.0
    transfers = 0
    chain_mode = None
    chain_route = None
    chain_km = 0.0

    def close_chain():
        nonlocal fare, chain_mode, chain_route, chain_km
        if chain_mode is None:
            return
        km = chain_km
        if chain_mode == "METRO":
            fare += _metro_fare(km)
        elif chain_mode == "BUS":
            fare += 10.0 if km <= 3 else 15.0
        elif chain_mode in ("TAXI", "CAR"):
            fare += max(50.0, round(km * 18))
        elif chain_mode == "TRAIN":
            fare += 30.0
        chain_mode = None
        chain_route = None
        chain_km = 0.0

    for leg in legs:
        mode = leg["mode"].upper()
        if mode == "WALK":
            continue
        route = leg.get("route_short_name")
        if chain_mode is None:
            chain_mode, chain_route, chain_km = mode, route, leg["distance_m"] / 1000.0
        elif mode == chain_mode and (route == chain_route or mode not in ("METRO", "BUS")):
            chain_km += leg["distance_m"] / 1000.0
        else:
            transfers += 1
            close_chain()
            chain_mode, chain_route, chain_km = mode, route, leg["distance_m"] / 1000.0
    close_chain()

    return {
        "id": itinerary_id,
        "duration_sec": duration_sec,
        "walk_distance_m": int(walk_m),
        "total_distance_m": int(total_m),
        "transfers": transfers,
        "fare": round(fare, 2),
        "profile": profile,
        "legs": legs,
    }


# ---------------------------------------------------------------------------
# First-mile / last-mile connectors
# ---------------------------------------------------------------------------

def _first_mile(legs: List[Dict[str, Any]], t: datetime, o: Dict[str, Any], station: Dict[str, Any]) -> datetime:
    dist = haversine_m(o["lat"], o["lng"], station["lat"], station["lng"])
    if dist <= 900:
        leg = _make_leg("WALK", o, station, t, 4.6)
    else:
        leg = _make_leg("BUS", o, station, t, 20.0, "TSRTC City Bus", wait_min=4)
    return _add(legs, leg)


def _last_mile(legs: List[Dict[str, Any]], t: datetime, station: Dict[str, Any], d: Dict[str, Any]) -> datetime:
    dist = haversine_m(station["lat"], station["lng"], d["lat"], d["lng"])
    if dist <= 1200:
        leg = _make_leg("WALK", station, d, t, 4.6)
    else:
        leg = _make_leg("BUS", station, d, t, 20.0, "TSRTC City Bus", wait_min=3)
    return _add(legs, leg)


def _nearest_boarding(o: Dict[str, Any]) -> Dict[str, Any]:
    candidates = [HITEC_METRO, NAMPALLY_METRO]
    return min(candidates, key=lambda s: haversine_m(o["lat"], o["lng"], s["lat"], s["lng"]))


# ---------------------------------------------------------------------------
# Corridor 1: Anywhere -> Secunderabad
# ---------------------------------------------------------------------------

def _corridor_secunderabad(o: Dict[str, Any], d: Dict[str, Any], dep: datetime) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    # Option 1: METRO (hero option - balanced profile so it ranks #1)
    legs: List[Dict[str, Any]] = []
    t = dep
    boarding = _nearest_boarding(o)
    t = _first_mile(legs, t, o, boarding)
    if boarding is HITEC_METRO:
        t = _add(legs, _fixed_leg("METRO", HITEC_METRO, SEC_EAST_METRO, t, T_HITEC_SEC_EAST, "Metro Blue Line", wait_min=2))
    else:
        t = _add(legs, _fixed_leg("METRO", NAMPALLY_METRO, AMEERPET_METRO, t, T_NAMPALLY_AMEERPET, "Metro Red Line", wait_min=2))
        t = _add(legs, _fixed_leg("METRO", AMEERPET_METRO, SEC_EAST_METRO, t, T_AMEERPET_SEC_EAST, "Metro Blue Line", wait_min=3))
    _last_mile(legs, t, SEC_EAST_METRO, d)
    out.append(_finalize("hyd-sec-metro", legs, "balanced"))

    # Option 2: Direct TSRTC bus (cheapest, 0 transfers, slower in traffic)
    legs = []
    t = dep
    _add(legs, _make_leg("BUS", o, d, t, 16.0, "TSRTC City Bus 5K", wait_min=6))
    out.append(_finalize("hyd-sec-bus", legs, "fewest_transfers"))

    # Option 3: Door-to-door auto/taxi (least walking, premium fare)
    legs = []
    t = dep
    _add(legs, _make_leg("TAXI", o, d, t, 25.0, "Cab / Auto", wait_min=4))
    out.append(_finalize("hyd-sec-taxi", legs, "least_walking"))

    return out


# ---------------------------------------------------------------------------
# Corridor 2: Anywhere -> Charminar
# ---------------------------------------------------------------------------

def _corridor_charminar(o: Dict[str, Any], d: Dict[str, Any], dep: datetime) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    # Option 1: METRO + heritage walk (hero option)
    legs: List[Dict[str, Any]] = []
    t = dep
    boarding = _nearest_boarding(o)
    t = _first_mile(legs, t, o, boarding)
    if boarding is HITEC_METRO:
        t = _add(legs, _fixed_leg("METRO", HITEC_METRO, AMEERPET_METRO, t, T_HITEC_AMEERPET, "Metro Blue Line", wait_min=2))
        t = _add(legs, _fixed_leg("METRO", AMEERPET_METRO, OMC_METRO, t, T_AMEERPET_OMC, "Metro Red Line", wait_min=3))
    else:
        t = _add(legs, _fixed_leg("METRO", NAMPALLY_METRO, OMC_METRO, t, T_NAMPALLY_OMC, "Metro Red Line", wait_min=2))
    _last_mile(legs, t, OMC_METRO, d)
    out.append(_finalize("hyd-chm-metro", legs, "balanced"))

    # Option 2: Direct TSRTC bus (cheapest)
    legs = []
    t = dep
    _add(legs, _make_leg("BUS", o, d, t, 15.0, "TSRTC City Bus 65", wait_min=6))
    out.append(_finalize("hyd-chm-bus", legs, "fewest_transfers"))

    # Option 3: Metro + auto last mile (least walking)
    legs = []
    t = dep
    boarding = _nearest_boarding(o)
    t = _first_mile(legs, t, o, boarding)
    if boarding is HITEC_METRO:
        t = _add(legs, _fixed_leg("METRO", HITEC_METRO, AMEERPET_METRO, t, T_HITEC_AMEERPET, "Metro Blue Line", wait_min=2))
        t = _add(legs, _fixed_leg("METRO", AMEERPET_METRO, OMC_METRO, t, T_AMEERPET_OMC, "Metro Red Line", wait_min=3))
    else:
        t = _add(legs, _fixed_leg("METRO", NAMPALLY_METRO, OMC_METRO, t, T_NAMPALLY_OMC, "Metro Red Line", wait_min=2))
    _add(legs, _make_leg("TAXI", OMC_METRO, d, t, 20.0, "Auto / Cab", wait_min=3))
    out.append(_finalize("hyd-chm-metro-auto", legs, "least_walking"))

    return out


# ---------------------------------------------------------------------------
# Generic fallback (any other destination)
# ---------------------------------------------------------------------------

def _generic(o: Dict[str, Any], d: Dict[str, Any], dep: datetime) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    legs: List[Dict[str, Any]] = []
    t = dep
    _add(legs, _make_leg("METRO", o, d, t, 35.0, "Metro Line", wait_min=3))
    out.append(_finalize("mock-metro-direct", legs, "balanced"))

    legs = []
    t = dep
    _add(legs, _make_leg("BUS", o, d, t, 18.0, "TSRTC City Bus", wait_min=5))
    out.append(_finalize("mock-direct-bus", legs, "fewest_transfers"))

    mid = _point("Transfer Hub", (o["lat"] + d["lat"]) / 2, (o["lng"] + d["lng"]) / 2)
    legs = []
    t = dep
    t = _add(legs, _make_leg("BUS", o, mid, t, 18.0, "TSRTC City Bus", wait_min=3))
    t = _add(legs, _make_leg("METRO", mid, d, t, 35.0, "Metro Line", wait_min=3))
    out.append(_finalize("mock-transfer-combo", legs, "least_walking"))

    return out


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def plan_mock(
    origin: Place,
    destination: Place,
    departure_time: str | None = None,
    preference: str = "balanced",
) -> List[Dict[str, Any]]:
    dep = datetime.now(timezone.utc) + timedelta(minutes=5)
    if departure_time:
        try:
            dep = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
            if dep.tzinfo is None:
                dep = dep.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    o = _point(origin.name, origin.lat, origin.lng)
    d = _point(destination.name, destination.lat, destination.lng)

    name = destination.name.lower()

    if "secunderabad" in name:
        return _corridor_secunderabad(o, d, dep)
    if "charminar" in name:
        return _corridor_charminar(o, d, dep)
    return _generic(o, d, dep)