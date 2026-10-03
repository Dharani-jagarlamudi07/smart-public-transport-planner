import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")
    use_mock_router: bool = os.getenv("USE_MOCK_ROUTER", "true").lower() == "true"
    otp_base_url: str = os.getenv("OTP_BASE_URL", "").strip()
    otp_fallback_to_mock: bool = os.getenv("OTP_FALLBACK_TO_MOCK", "true").lower() == "true"
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")

settings = Settings()