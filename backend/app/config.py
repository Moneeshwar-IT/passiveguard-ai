import os
from typing import List, Union
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
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        description="Allowed CORS origins for frontend API requests"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
