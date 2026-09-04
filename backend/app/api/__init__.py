"""
API package for PassiveGuard AI.
Contains FastAPI routers for alerts, traffic analytics, and WebSocket streaming.
"""
from app.api.alerts import router as alerts_router
from app.api.traffic import router as traffic_router
from app.api.websocket import router as ws_router

__all__ = ["alerts_router", "traffic_router", "ws_router"]
