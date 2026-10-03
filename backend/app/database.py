import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

if settings.database_url.startswith("sqlite"):
    db_file = settings.database_url.split("sqlite:///")[-1]
    if db_file and db_file != ":memory:":
        os.makedirs(os.path.dirname(db_file) or ".", exist_ok=True)

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()