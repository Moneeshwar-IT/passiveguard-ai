from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/traffic", tags=["Traffic Analytics"])


class CurrentTrafficStats(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    active_flows: int = 0
    total_packets_sec: float = 0.0
    total_bytes_sec: float = 0.0
    bandwidth_mbps: float = 0.0
    protocol_distribution: Dict[str, int] = Field(default_factory=dict)


class HistoricalTrafficPoint(BaseModel):
    timestamp: str
    tcp_packets: int
    udp_packets: int
    icmp_packets: int
    total_bytes: int


from app.pipeline.engine import pipeline_engine, CurrentTrafficStats, HistoricalTrafficPoint


from app.ingestion.models import FlowRecord


from app.alerts.store import alert_store


@router.get("/current", response_model=CurrentTrafficStats)
def get_current_traffic():
    """
    Retrieve current real-time passive traffic statistics.
    """
    try:
        latest = alert_store.get_latest_traffic_stats()
        if latest:
            ts = datetime.fromisoformat(latest["timestamp"]) if isinstance(latest["timestamp"], str) else datetime.now(timezone.utc)
            return CurrentTrafficStats(
                timestamp=ts,
                active_flows=latest["active_flows"],
                total_packets_sec=latest["total_packets_sec"],
                total_bytes_sec=latest["total_bytes_sec"],
                bandwidth_mbps=latest["bandwidth_mbps"],
                protocol_distribution=latest["protocol_distribution"]
            )
    except Exception:
        pass
    return pipeline_engine.traffic_tracker.get_current_stats()


@router.get("/historical", response_model=List[HistoricalTrafficPoint])
def get_historical_traffic():
    """
    Retrieve historical traffic statistics timeline for analytics.
    """
    return pipeline_engine.traffic_tracker.get_historical_points()


@router.post("/ingest")
def ingest_flow(flow: FlowRecord):
    """
    Ingests an observed flow record into the backend real-time pipeline,
    updating traffic analytics and broadcasting WebSocket alerts to connected SOC Dashboards.
    """
    fused = pipeline_engine.process_flow(flow)
    return fused.model_dump(mode="json")
