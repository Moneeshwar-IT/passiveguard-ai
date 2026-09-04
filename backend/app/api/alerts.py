from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.alerts.schema import Alert
from app.alerts.manager import alert_manager

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=List[Alert])
def get_alerts(
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of alerts to return"),
    severity: Optional[str] = Query(default=None, description="Filter by severity level (INFO, LOW, MEDIUM, HIGH, CRITICAL)")
):
    """
    Retrieve recent passive security threat alerts.
    """
    return alert_manager.get_recent_alerts(limit=limit, severity=severity)


@router.get("/{alert_id}", response_model=Alert)
def get_alert_by_id(alert_id: str):
    """
    Retrieve detailed metadata and evidence for a single alert by ID.
    """
    alert = alert_manager.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert with ID '{alert_id}' not found")
    return alert
