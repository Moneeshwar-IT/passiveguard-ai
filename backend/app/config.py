import os
from typing import List, Union, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    PassiveGuard AI Configuration Settings.
    Loaded from environment variables or default values.
    """
    APP_NAME: str = Field(default="PassiveGuard AI", description="Application Title")
    ENVIRONMENT: str = Field(default="development", description="Execution Environment")
    DATABASE_URL: str = Field(default="sqlite:///./passiveguard.db", description="SQLAlchemy Database URL")
    PCAP_DIR: str = Field(default="./data/raw", description="Directory for input PCAP files")
    REPLAY_SPEED: float = Field(default=1.0, description="Internal PCAP replay speed multiplier")
    FEATURE_WINDOW_SIZE: int = Field(default=60, description="Time window in seconds for temporal feature extraction")
    ALERT_THRESHOLD: float = Field(default=0.7, description="Minimum fused risk score to generate an alert")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level (DEBUG, INFO, WARNING, ERROR)")
    FRONTEND_URL: Optional[str] = Field(default=None, description="Production frontend URL")
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "https://passiveguard-frontend.onrender.com"
        ],
        description="Allowed CORS origins for frontend API requests"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins: List[str] = []
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v_str)
                    if isinstance(parsed, list):
                        origins = [str(item).strip().rstrip('/') for item in parsed if str(item).strip()]
                except Exception:
                    pass
            if not origins:
                origins = [origin.strip().rstrip('/') for origin in v_str.split(",") if origin.strip()]
        elif isinstance(v, list):
            origins = [str(origin).strip().rstrip('/') for origin in v if str(origin).strip()]
        else:
            origins = [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "https://passiveguard-frontend.onrender.com"
            ]

        # Always ensure production frontend URL is present
        default_prod = "https://passiveguard-frontend.onrender.com"
        if default_prod not in origins:
            origins.append(default_prod)

        # Include FRONTEND_URL environment variable if set
        frontend_env = os.getenv("FRONTEND_URL")
        if frontend_env:
            frontend_clean = frontend_env.strip().rstrip('/')
            if frontend_clean and frontend_clean not in origins:
                origins.append(frontend_clean)

        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
