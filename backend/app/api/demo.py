"""
PassiveGuard AI — Controlled Demo API Endpoints (Module 17)

STRICT PASSIVE & SAFETY DIRECTIVE:
Provides safe, lock-protected REST API endpoints for initiating controlled threat simulations directly from the SOC Dashboard.

Zero network transmission, zero packet output, zero active probing, zero DNS query resolution, zero TLS decryption.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from app.demo.runner import demo_runner_service, SCENARIOS_CATALOG

router = APIRouter(prefix="/api/demo", tags=["Demo Simulation"])


class DemoRunRequest(BaseModel):
    scenario: str = Field(default="mixed", description="Name of controlled scenario to execute (e.g. ddos, recon, c2, dga, dns_tunnel, tls_malware, exfiltration, mixed, all)")
    reset_state: bool = Field(default=False, description="Whether to clear alert store and detector state before execution")
    delay: float = Field(default=0.0, ge=0.0, le=5.0, description="Optional delay pacing between flows in seconds")


@router.get("/scenarios", summary="List available controlled demonstration scenarios")
def get_demo_scenarios():
    """
    Returns structured catalog of allowed controlled threat scenarios.
    """
    return {
        "scenarios": demo_runner_service.get_scenarios_catalog(),
        "passive_safety_notice": {
            "mode": "OFFLINE / CONTROLLED DEMO DATA",
            "network_transmission": "DISABLED",
            "external_dns": "DISABLED",
            "tls_decryption": "DISABLED"
        }
    }


@router.get("/status", summary="Get demo runner status")
def get_demo_status():
    """
    Returns status of the demo runner service including active execution lock state and last run results.
    """
    return demo_runner_service.get_status()


@router.post("/run", summary="Execute controlled demo threat scenario")
async def run_demo_scenario(req: DemoRunRequest):
    """
    Executes controlled demo simulation programmatically.
    Processes telemetry through existing PipelineEngine, triggers real detectors and ML models,
    generates alerts in SQLite AlertStore, and streams updates via WebSockets to the dashboard.
    """
    scenario_clean = req.scenario.lower().strip()
    if scenario_clean not in SCENARIOS_CATALOG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario name '{req.scenario}'. Allowed scenarios: {list(SCENARIOS_CATALOG.keys())}"
        )

    if demo_runner_service.is_running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A demonstration scenario is currently executing. Please wait for it to finish."
        )

    try:
        result = await demo_runner_service.run_scenario(
            scenario=scenario_clean,
            reset_state=req.reset_state,
            delay=req.delay
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Demo execution error: {str(e)}")


@router.post("/reset", summary="Reset demonstration state and clear alert store")
def reset_demo_state():
    """
    Safely resets in-memory demonstration state, SQLite alert store, alert buffer, deduplication cache,
    and temporal detector state trackers.
    """
    if demo_runner_service.is_running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reset state while a demonstration scenario is actively executing. Please wait for execution to complete."
        )

    try:
        res = demo_runner_service.reset_state()
        return res
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Reset state error: {str(e)}")
