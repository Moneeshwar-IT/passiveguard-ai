"""
Alerts package for PassiveGuard AI.
Provides Alert schema definitions and AlertManager instance.
"""
from app.alerts.schema import Alert
from app.alerts.manager import AlertManager, alert_manager

__all__ = ["Alert", "AlertManager", "alert_manager"]
