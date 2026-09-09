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


def get_project_root() -> str:
    """
    Returns the absolute path to the repository root directory.
    Assumes this file is located at <PROJECT_ROOT>/backend/app/config.py.
    """
    config_file = os.path.abspath(__file__)
    app_dir = os.path.dirname(config_file)
    backend_dir = os.path.dirname(app_dir)
    project_root = os.path.dirname(backend_dir)
    return project_root


def resolve_model_path(path: Optional[str]) -> Optional[str]:
    """
    Resolves a relative or absolute model/manifest path to an existing absolute path.
    Ensures paths like 'data/models/ddos_rf_unsw_nb15_v1.joblib' resolve cleanly
    from the repository root regardless of whether CWD is the repository root or backend/.
    """
    if not path:
        return None

    clean_path = os.path.normpath(path)

    # 1. If already absolute and exists, return directly
    if os.path.isabs(clean_path) and os.path.exists(clean_path):
        return clean_path

    project_root = get_project_root()

    # Candidate 1: relative to repository root (canonical path)
    candidate1 = os.path.abspath(os.path.join(project_root, clean_path))
    if os.path.exists(candidate1):
        return candidate1

    # Candidate 2: relative to current working directory
    candidate2 = os.path.abspath(clean_path)
    if os.path.exists(candidate2):
        return candidate2

    # Candidate 3: if path starts with 'backend/' or 'backend\', strip it
    if clean_path.startswith("backend" + os.sep) or clean_path.startswith("backend/"):
        rel_sub = clean_path[8:]
        candidate3 = os.path.abspath(os.path.join(project_root, rel_sub))
        if os.path.exists(candidate3):
            return candidate3

    # Candidate 4: search by filename under project_root/data/models/
    filename = os.path.basename(clean_path)
    candidate4 = os.path.abspath(os.path.join(project_root, "data", "models", filename))
    if os.path.exists(candidate4):
        return candidate4

    # Candidate 5: search by filename under project_root/data/manifests/
    candidate5 = os.path.abspath(os.path.join(project_root, "data", "manifests", filename))
    if os.path.exists(candidate5):
        return candidate5

    # Fallback to candidate1 (canonical path under project root)
    return candidate1

