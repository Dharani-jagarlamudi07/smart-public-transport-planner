import httpx
from datetime import datetime, timezone
from typing import List, Dict, Any
from ..config import settings
from ..schemas import Place
from .mock_router import plan_mock


def _decode_polyline(encoded: str) -> List[List[float]]:
    """Decodes Google-encoded polyline into list of [lat, lng]."""
    if not encoded:
        return []

    index = 0
    lat = 0
    lng = 0
    result = []
    length = len(encoded)

    while index < length:
        shift = 0
        result_byte = 0

        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result_byte |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break

        dlat = ~(result_byte >> 1) if result_byte & 1 else result_byte >> 1
        lat += dlat

        shift = 0
        result_byte = 0

        while True:
            byte = ord(encoded[index]) - 63
            index += 1
            result_byte |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break

        dlng = ~(result_byte >> 1) if result_byte & 1 else result_byte >> 1
        lng += dlng

        result.append([lat / 1e5, lng / 1e5])

    return result


def _iso_from_otp_time(value: Any) -> str | None:
    if value is None:
        return None
    try:
        num = float(value)
        if num > 1e12:
            num = num / 1000.0
        return datetime.fromtimestamp(num, tz=timezone.utc).isoformat()
    except Exception:
        return str(value)


def _fallback_geometry(from_p: Dict[str, Any], to_p: Dict[str, Any]) -> List[List[float]]:
    return [[from_p["lat"], from_p["lng"]], [to_p["lat"], to_p["lng"]]]


def _normalize_otp_response(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    plan = data.get("plan") or data
    raw_itineraries = plan.get("itineraries", [])
    itineraries = []

    for idx, it in enumerate(raw_itineraries):
        legs = []
        for leg in it.get("legs", []):
            from_obj = leg.get("from", {}) or {}
            to_obj = leg.get("to", {}) or {}

            from_p = {
                "name": from_obj.get("name") or "Stop",
                "lat": float(from_obj.get("lat", 0)),
                "lng": float(from_obj.get("lon", from_obj.get("lng", 0))),
            }
            to_p = {
                "name": to_obj.get("name") or "Stop",
                "lat": float(to_obj.get("lat", 0)),
                "lng": float(to_obj.get("lon", to_obj.get("lng", 0))),
            }

            geometry_points = leg.get("legGeometry", {}).get("points")
            geometry = _decode_polyline(geometry_points) if geometry_points else _fallback_geometry(from_p, to_p)

            start_time = _iso_from_otp_time(leg.get("startTime") or leg.get("start"))
            end_time = _iso_from_otp_time(leg.get("endTime") or leg.get("end"))
            duration_sec = int(leg.get("duration") or 0)

            if not duration_sec and start_time and end_time:
                try:
                    duration_sec = int((datetime.fromisoformat(end_time) - datetime.fromisoformat(start_time)).total_seconds())
                except Exception:
                    duration_sec = 0

            legs.append({
                "mode": str(leg.get("mode", "TRANSIT")).upper(),
                "from": from_p,
                "to": to_p,
                "start_time": start_time,
                "end_time": end_time,
                "duration_sec": duration_sec,
                "distance_m": int(float(leg.get("distance", 0))),
                "route_short_name": leg.get("routeShortName") or leg.get("agencyName"),
                "geometry": geometry,
            })

        fare = None
        raw_fare = it.get("fare", {}) or {}
        regular = raw_fare.get("regular", {}) or {}
        cents = regular.get("cents")
        if cents is not None:
            try:
                fare = float(cents) / 100.0
            except Exception:
                fare = None

        itineraries.append({
            "id": f"otp-{idx}",
            "duration_sec": int(it.get("duration", 0)),
            "walk_distance_m": int(float(it.get("walkDistance", 0))),
            "transfers": int(it.get("transfers", 0)),
            "fare": fare,
            "profile": "otp",
            "legs": legs,
        })

    return itineraries


async def plan_otp(
    origin: Place,
    destination: Place,
    departure_time: str | None = None,
    preference: str = "balanced",
) -> List[Dict[str, Any]]:
    if not settings.otp_base_url:
        return plan_mock(origin, destination, departure_time, preference)

    base = settings.otp_base_url.rstrip("/")
    url = f"{base}/otp/routers/default/plan" if not base.endswith("/plan") else base

    if departure_time:
        try:
            dep = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
            if dep.tzinfo is None:
                dep = dep.replace(tzinfo=timezone.utc)
        except Exception:
            dep = datetime.now(timezone.utc)
    else:
        dep = datetime.now(timezone.utc)

    params = {
        "fromPlace": f"{origin.lat},{origin.lng}",
        "toPlace": f"{destination.lat},{destination.lng}",
        "date": dep.strftime("%Y-%m-%d"),
        "time": dep.strftime("%H:%M:%S"),
        "arriveBy": "false",
        "mode": "TRANSIT,WALK",
        "numItineraries": "6",
        "walkSpeed": "1.2",
        "transferSlack": "120",
        "maxWalkDistance": "2000",
    }

    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    return _normalize_otp_response(data)