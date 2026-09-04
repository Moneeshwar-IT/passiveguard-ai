import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.alerts import router as alerts_router
from app.api.traffic import router as traffic_router
from app.api.websocket import router as ws_router
from app.api.models import router as models_router
from app.api.demo import router as demo_router

# Configure structured application logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("passiveguard")


import time
import asyncio
from app.alerts.store import alert_store
from app.api.websocket import ws_manager


async def poll_alerts_and_broadcast():
    """
    Background poller that periodically checks SQLite AlertStore for new alerts
    and dispatches WebSocket events to connected SOC Dashboard clients.
    """
    last_polled_time = time.time() - 3600.0
    while True:
        try:
            await asyncio.sleep(0.25)
            new_alerts = alert_store.get_new_alerts_since(last_polled_time)
            if new_alerts:
                for alert in new_alerts:
                    created_at = getattr(alert, "created_at", alert.timestamp.timestamp() if hasattr(alert.timestamp, "timestamp") else time.time())
                    if created_at > last_polled_time:
                        last_polled_time = created_at
                    
                    await ws_manager.broadcast({
                        "event": "alert_created",
                        "type": "alert_created",
                        "data": alert.model_dump(mode="json")
                    })

            latest_traffic = alert_store.get_latest_traffic_stats()
            if latest_traffic:
                await ws_manager.broadcast({
                    "event": "traffic_update",
                    "type": "traffic_update",
                    "data": latest_traffic
                })
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in alert polling task: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan Context Manager.
    Starts background alert poller task and handles startup/shutdown logging.
    """
    logger.info(f"Starting {settings.APP_NAME} in [{settings.ENVIRONMENT}] mode.")
    logger.info("STRICT PASSIVE CONSTRAINT ENFORCED: Observation-only enclave mode active.")
    poller = asyncio.create_task(poll_alerts_and_broadcast())
    yield
    poller.cancel()
    try:
        await poller
    except asyncio.CancelledError:
        pass
    logger.info(f"Shutting down {settings.APP_NAME}.")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0-scaffold",
    description="Passive Cybersecurity Threat Detection Platform for Unidirectional IP Traffic",
    lifespan=lifespan
)

# CORS Configuration for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health_check():
    """
    System health check endpoint.
    Returns status, environment, and non-negotiable passive monitoring mode verification.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": "0.1.0-scaffold",
        "mode": "passive_read_only",
        "database": settings.DATABASE_URL.split(":///")[0]
    }


# Include API Routers
app.include_router(alerts_router)
app.include_router(traffic_router)
app.include_router(ws_router)
app.include_router(models_router)
app.include_router(demo_router)
