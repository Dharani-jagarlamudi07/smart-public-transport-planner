from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.sql import func
from .database import Base

class SavedRoute(Base):
    __tablename__ = "saved_routes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, default="demo", index=True)
    title = Column(String)
    origin_name = Column(String)
    destination_name = Column(String)
    origin_lat = Column(Float)
    origin_lng = Column(Float)
    dest_lat = Column(Float)
    dest_lng = Column(Float)
    payload = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class SearchEvent(Base):
    __tablename__ = "search_events"
    id = Column(Integer, primary_key=True, index=True)
    origin_name = Column(String)
    destination_name = Column(String)
    origin_lat = Column(Float)
    origin_lng = Column(Float)
    dest_lat = Column(Float)
    dest_lng = Column(Float)
    duration_sec = Column(Integer, nullable=True)
    transfers = Column(Integer, nullable=True)
    selected_mode = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    route_ref = Column(String, nullable=True)
    message = Column(String)
    severity = Column(String, default="info")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())