"""
Application configuration.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # CORS settings
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]
    
    # Logging settings
    log_level: str = "INFO"
    log_to_file: bool = True
    
    # Session settings
    max_sessions: int = 10
    session_timeout_minutes: int = 60
    
    # Cache settings
    waveform_cache_size: int = 1000
    scope_cache_size: int = 10000
    
    class Config:
        env_prefix = "WAVE_BROWSER_"


settings = Settings()
