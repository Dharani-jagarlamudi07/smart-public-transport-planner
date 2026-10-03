import json
import random
import time
import httpx
import uuid
from typing import Annotated, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Alert, SavedRoute, SearchEvent
from ..schemas import (
    AlertCreate, 
    RouteRequest, 
    SavedRouteCreate,
    AuthRequest,      
    OtpResponse,      
    VerifyOtpRequest, 
    UserSession       
)
# FIX: Removed DEMO_STOPS import since it no longer exists in mock_router
from ..services.mock_router import plan_mock 
from ..services.otp_router import plan_otp
from ..services.ranker import rank_and_explain
from ..services.auth_service import send_otp, verify_otp 

router = APIRouter(prefix="/api", tags=["planner"])

SessionDep = Annotated[Session, Depends(get_db)]


@router.get("/health")
def health():
    return {
        "status": "ok",
        "mock_router": settings.use_mock_router,
        "otp_base_url": settings.otp_base_url or None,
    }


@router.get("/places")
async def search_places(q: str = Query("", description="Search query")):
    q = q.strip()

    if not q:
        return []

    try:
        async with httpx.AsyncClient(
            timeout=8,
            headers={
                "User-Agent": "smart-public-transport-route-planner-hackathon/1.0"
            },
        ) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": q,
                    "format": "json",
                    "limit": 5,
                    "addressdetails": 1,
                },
            )
            response.raise_for_status()
            data = response.json()

            results = []

            for item in data:
                display_name = item.get("display_name", "")
                name = item.get("name") or (display_name.split(",")[0] if display_name else "Location")

                results.append(
                    {
                        "name": name,
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                        "address": display_name,
                    }
                )

            if results:
                return results

    except Exception:
        pass

    # Fallback: Return empty list if Nominatim fails and no demo stops exist
    return []


@router.post("/routes")
async def create_routes(req: RouteRequest, db: SessionDep):
    preference = req.preference or "balanced"

    if settings.use_mock_router:
        itineraries = plan_mock(req.origin, req.destination, req.departure_time, preference)
    else:
        try:
            itineraries = await plan_otp(req.origin, req.destination, req.departure_time, preference)
        except Exception:
            if settings.otp_fallback_to_mock:
                itineraries = plan_mock(req.origin, req.destination, req.departure_time, preference)
            else:
                raise HTTPException(status_code=502, detail="Routing engine unavailable")

    itineraries = rank_and_explain(itineraries, preference)

    top = itineraries[0] if itineraries else None

    selected_mode = None
    if top:
        selected_mode = next(
            (leg["mode"] for leg in top["legs"] if leg["mode"].upper() != "WALK"),
            "WALK",
        )

    event = SearchEvent(
        origin_name=req.origin.name,
        destination_name=req.destination.name,
        origin_lat=req.origin.lat,
        origin_lng=req.origin.lng,
        dest_lat=req.destination.lat,
        dest_lng=req.destination.lng,
        duration_sec=top["duration_sec"] if top else None,
        transfers=top["transfers"] if top else None,
        selected_mode=selected_mode,
    )

    db.add(event)
    db.commit()

    return {
        "count": len(itineraries),
        "itineraries": itineraries,
    }


# REMOVED /api/vehicles endpoint entirely to prevent confusion
# The frontend Map.tsx has been updated to ignore this endpoint anyway.


@router.get("/saved-routes")
def list_saved_routes(db: SessionDep):
    rows = (
        db.query(SavedRoute)
        .filter(SavedRoute.user_id == "demo")
        .order_by(SavedRoute.created_at.desc())
        .all()
    )

    result = []

    for row in rows:
        try:
            payload = json.loads(row.payload)
        except Exception:
            payload = {}

        result.append(
            {
                "id": row.id,
                "title": row.title,
                "origin_name": row.origin_name,
                "destination_name": row.destination_name,
                "origin_lat": row.origin_lat,
                "origin_lng": row.origin_lng,
                "destination_lat": row.dest_lat,
                "destination_lng": row.dest_lng,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "payload": payload,
            }
        )

    return result


@router.post("/saved-routes", status_code=201)
def create_saved_route(req: SavedRouteCreate, db: SessionDep):
    payload = req.itinerary.model_dump(by_alias=True, mode="json")

    obj = SavedRoute(
        user_id="demo",
        title=req.title or f"{req.origin.name} to {req.destination.name}",
        origin_name=req.origin.name,
        destination_name=req.destination.name,
        origin_lat=req.origin.lat,
        origin_lng=req.origin.lng,
        dest_lat=req.destination.lat,
        dest_lng=req.destination.lng,
        payload=json.dumps(payload),
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return {"id": obj.id, "ok": True}


@router.delete("/saved-routes/{route_id}")
def delete_saved_route(route_id: int, db: SessionDep):
    obj = db.query(SavedRoute).filter(SavedRoute.id == route_id).first()

    if not obj:
        raise HTTPException(status_code=404, detail="Saved route not found")

    db.delete(obj)
    db.commit()

    return {"ok": True}


@router.get("/alerts")
def list_alerts(db: SessionDep):
    alerts = (
        db.query(Alert)
        .filter(Alert.active == True)
        .order_by(Alert.created_at.desc())
        .all()
    )

    return [
        {
            "id": a.id,
            "message": a.message,
            "route_ref": a.route_ref,
            "severity": a.severity,
            "active": a.active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


@router.post("/admin/alerts")
def create_alert(req: AlertCreate, db: SessionDep):
    obj = Alert(
        message=req.message,
        route_ref=req.route_ref,
        severity=req.severity,
        active=True,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return {
        "id": obj.id,
        "message": obj.message,
        "route_ref": obj.route_ref,
        "severity": obj.severity,
        "active": obj.active,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


@router.post("/admin/simulate-delay")
def simulate_delay(db: SessionDep):
    messages = [
        "Metro Line 1 delayed by 12 minutes due to signaling issue.",
        "Bus Route 205 experiencing 8-minute delay due to traffic.",
        "Suburban Rail A partial service suspension between Central and Tech Park.",
        "Airport Express bus crowded. Consider alternate route.",
        "Planned maintenance on Metro Line 2. Expect transfer delays.",
    ]

    route_refs = [
        "METRO_LINE_1",
        "BUS_205",
        "SUBURBAN_RAIL_A",
        "AIRPORT_EXPRESS",
        "METRO_LINE_2",
    ]

    idx = random.randrange(len(messages))

    obj = Alert(
        message=messages[idx],
        route_ref=route_refs[idx],
        severity="warning",
        active=True,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return {
        "id": obj.id,
        "message": obj.message,
        "route_ref": obj.route_ref,
        "severity": obj.severity,
        "active": obj.active,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
    }


@router.post("/admin/seed-demo")
def seed_demo_data(db: SessionDep):
    existing_searches = db.query(func.count(SearchEvent.id)).scalar() or 0

    if existing_searches > 30:
        return {
            "ok": True,
            "message": "Demo data already exists.",
            "seeded_searches": 0,
            "seeded_alerts": 0,
        }

    seeded_searches = 0
    
    # Since we removed DEMO_STOPS, we generate random coordinates around Bangalore/Hyderabad for seeding
    # Or simply skip seeding detailed events if not needed for analytics demo
    # For now, let's just add generic events without specific stop names to avoid errors
    
    for _ in range(10):
        event = SearchEvent(
            origin_name="Random Origin",
            destination_name="Random Destination",
            origin_lat=12.97 + random.uniform(-0.1, 0.1),
            origin_lng=77.59 + random.uniform(-0.1, 0.1),
            dest_lat=12.97 + random.uniform(-0.1, 0.1),
            dest_lng=77.59 + random.uniform(-0.1, 0.1),
            duration_sec=random.randint(600, 3600),
            transfers=random.randint(0, 2),
            selected_mode=random.choice(["BUS", "METRO", "TRAIN"]),
        )
        db.add(event)
        seeded_searches += 1

    alerts = [
        Alert(
            message="Metro Line 1 delayed by 12 minutes due to signaling issue.",
            route_ref="METRO_LINE_1",
            severity="warning",
            active=True,
        ),
        Alert(
            message="Bus Route 205 experiencing heavy traffic near Old Market.",
            route_ref="BUS_205",
            severity="info",
            active=True,
        ),
    ]

    for alert in alerts:
        db.add(alert)

    db.commit()

    return {
        "ok": True,
        "seeded_searches": seeded_searches,
        "seeded_alerts": len(alerts),
    }


@router.get("/analytics/summary")
def analytics_summary(db: SessionDep):
    total_searches = db.query(func.count(SearchEvent.id)).scalar() or 0
    total_saved = db.query(func.count(SavedRoute.id)).scalar() or 0
    active_alerts = db.query(func.count(Alert.id)).filter(Alert.active == True).scalar() or 0

    avg_duration_raw = db.query(func.avg(SearchEvent.duration_sec)).scalar()
    avg_duration = float(avg_duration_raw) if avg_duration_raw is not None else 0.0

    top_origins_rows = (
        db.query(SearchEvent.origin_name, func.count(SearchEvent.id).label("count"))
        .group_by(SearchEvent.origin_name)
        .order_by(func.count(SearchEvent.id).desc())
        .limit(5)
        .all()
    )

    top_destinations_rows = (
        db.query(SearchEvent.destination_name, func.count(SearchEvent.id).label("count"))
        .group_by(SearchEvent.destination_name)
        .order_by(func.count(SearchEvent.id).desc())
        .limit(5)
        .all()
    )

    recent_rows = (
        db.query(SearchEvent)
        .order_by(SearchEvent.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_searches": total_searches,
        "total_saved_routes": total_saved,
        "active_alerts": active_alerts,
        "average_duration_sec": avg_duration,
        "top_origins": [
            {"name": row[0], "count": row[1]}
            for row in top_origins_rows
        ],
        "top_destinations": [
            {"name": row[0], "count": row[1]}
            for row in top_destinations_rows
        ],
        "recent_searches": [
            {
                "id": row.id,
                "origin_name": row.origin_name,
                "destination_name": row.destination_name,
                "duration_sec": row.duration_sec,
                "transfers": row.transfers,
                "selected_mode": row.selected_mode,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in recent_rows
        ],
    }


# --- NEW AUTHENTICATION ENDPOINTS ---

@router.post("/auth/send-otp", response_model=OtpResponse)
async def request_otp(req: AuthRequest):
    """
    Sends an OTP to the provided email or phone.
    NOTE: For Hackathon Demo, the OTP is returned in the response body.
    """
    if not req.identifier:
        raise HTTPException(status_code=400, detail="Identifier required")
        
    success, code = send_otp(req.identifier, req.type)
    
    return OtpResponse(
        success=True,
        message=f"OTP sent to {req.identifier}",
        otp_code=code # ⚠️ HACKATHON SHORTCUT: Returning code so user can see it
    )

@router.post("/auth/verify-otp", response_model=UserSession)
async def verify_login(req: VerifyOtpRequest):
    """
    Verifies the OTP and logs the user in.
    """
    is_valid = verify_otp(req.identifier, req.otp_code)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
        
    # Create a fake session ID
    session_id = str(uuid.uuid4())
    
    return UserSession(
        logged_in=True,
        user_id=session_id,
        identifier=req.identifier
    )