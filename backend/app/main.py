from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from . import models  # noqa: F401
from .routers import planner

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Public Transport Route Planner API",
    description="Backend for route planning, saved journeys, alerts, and analytics.",
    version="1.0.0",
)

# RELAXED CORS FOR HACKATHON DEMO
# Allows all origins, methods, and headers to prevent "Failed to fetch" issues
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(planner.router)


@app.get("/")
def root():
    return {
        "message": "Smart Public Transport Route Planner API is running.",
        "docs": "/docs",
        "health": "/api/health",
    }