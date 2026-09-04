import ast
import os
import time
import pytest
from datetime import datetime, timezone
from app.ingestion.flow_stream import FlowRecord
from app.pipeline.engine import PipelineEngine, TrafficTracker, CurrentTrafficStats, HistoricalTrafficPoint
from app.risk.fusion import FusedRiskAssessment
from app.alerts.manager import alert_manager
from app.api.websocket import ws_manager


@pytest.fixture
def pipeline():
    return PipelineEngine()


# 1. Pipeline Processing Test (Flow -> Feature -> Detectors -> Risk Fusion)
def test_pipeline_process_flow(pipeline):
    flow = FlowRecord(
        flow_id="FLOW-PIPE-001",
        src_ip="10.0.0.10",
        dst_ip="192.168.1.50",
        src_port=54321,
        dst_port=443,
        protocol="TCP",
        first_seen=time.time() - 10.0,
        last_seen=time.time(),
        packet_count=50,
        byte_count=40000,
        src_packets=25,
        dst_packets=25,
        src_bytes=20000,
        dst_bytes=20000,
        tcp_flags={"SYN": 1, "ACK": 49}
    )

    fused = pipeline.process_flow(flow)
    assert isinstance(fused, FusedRiskAssessment)
    assert 0.0 <= fused.fused_score <= 1.0
    assert fused.primary_threat_class is not None


# 2. Traffic Tracker Metrics Test
def test_traffic_tracker_metrics():
    tracker = TrafficTracker(max_history_points=10)

    flow1 = FlowRecord(
        flow_id="FLOW-TRAF-1",
        src_ip="10.0.0.1",
        dst_ip="192.168.1.1",
        src_port=1000,
        dst_port=80,
        protocol="TCP",
        first_seen=time.time() - 1.0,
        last_seen=time.time(),
        packet_count=100,
        byte_count=50000
    )

    tracker.update_flow(flow1)
    stats = tracker.get_current_stats()

    assert isinstance(stats, CurrentTrafficStats)
    assert stats.active_flows == 1
    assert stats.total_packets_sec > 0
    assert stats.protocol_distribution["TCP"] == 100

    history = tracker.get_historical_points()
    assert len(history) >= 1
    assert isinstance(history[0], HistoricalTrafficPoint)


# 3. Alert Generation & Pipeline Integration Test
def test_pipeline_alert_generation():
    engine = PipelineEngine(alert_threshold=0.50)

    # Suspicious exfiltration flow
    exfil_flow = FlowRecord(
        flow_id="FLOW-ALERT-GEN",
        src_ip="10.0.0.99",
        dst_ip="198.51.100.77",
        src_port=59999,
        dst_port=443,
        protocol="TCP",
        first_seen=time.time() - 300.0,
        last_seen=time.time(),
        packet_count=10000,
        byte_count=60_000_000,
        src_packets=9800,
        dst_packets=200,
        src_bytes=59_500_000,
        dst_bytes=500_000,
        tcp_flags={"SYN": 1, "ACK": 9999}
    )

    fused = engine.process_flow(exfil_flow)
    assert fused.fused_score >= 0.50

    recent_alerts = alert_manager.get_recent_alerts(limit=10)
    assert len(recent_alerts) > 0


# 4. WebSocket Broadcast Sync Test
def test_websocket_broadcast_sync():
    # Calling broadcast_sync when no clients are active must execute without throwing exception
    msg = {
        "type": "traffic_update",
        "event": "traffic_update",
        "data": {"active_flows": 10, "bandwidth_mbps": 5.5}
    }
    ws_manager.broadcast_sync(msg)


# 5. Static AST Security Test verifying zero socket/network calls in app/pipeline/engine.py
def test_verify_no_socket_calls_in_pipeline_engine():
    forbidden_calls = {"socket", "connect", "send", "sendto", "sendall", "sr", "sr1", "srp", "srp1"}
    engine_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "pipeline", "engine.py"))

    with open(engine_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=engine_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden call '{func_name}' found in {engine_filepath}"
