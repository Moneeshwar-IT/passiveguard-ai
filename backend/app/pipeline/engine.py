"""
PassiveGuard AI — Real-Time Unified Detection Pipeline Engine (Module 10)

STRICT PASSIVE CONSTRAINT:
Consumes observed flow streams and packet metadata incrementally, executes all 7 threat detectors,
fuses multi-signal risk, records alerts via AlertManager, updates traffic analytics, and broadcasts
live JSON telemetry over WebSockets to the SOC Dashboard.

Under NO circumstances does it transmit raw network packets, perform port scanning, initiate DNS lookups,
or execute active blocking/mitigation commands.
"""
import time
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
from pydantic import BaseModel, Field

from app.config import resolve_model_path
from app.ingestion.flow_stream import FlowRecord
from app.features.flow_features import extract_flow_features
from app.features.models import FeatureVector
from app.detection.ddos import DDoSDetector
from app.detection.c2 import C2Detector
from app.detection.dga import DGADetector
from app.detection.dns_tunneling import DNSTunnelDetector
from app.detection.tls import TLSDetector
from app.detection.recon import ReconDetector
from app.detection.exfiltration import ExfiltrationDetector
from app.risk.fusion import RiskFusionEngine, FusedRiskAssessment
from app.alerts.schema import Alert
from app.alerts.manager import alert_manager

logger = logging.getLogger(__name__)


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


class TrafficTracker:
    """
    Bounded streaming traffic analytics tracker.
    Maintains real-time throughput metrics, active flow counts, protocol breakdown,
    and a bounded historical timeline for dashboard plotting.
    """

    def __init__(self, max_history_points: int = 60):
        self.max_history_points = max_history_points
        self._active_flows: Dict[str, FlowRecord] = {}
        self._protocol_counts: Dict[str, int] = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        self._total_packets: int = 0
        self._total_bytes: int = 0
        self._start_time: float = time.time()
        self._history: List[HistoricalTrafficPoint] = []
        self._last_history_t: float = time.time()

        # Seed initial timeline point
        now_str = datetime.now(timezone.utc).strftime("%H:%M")
        self._history.append(HistoricalTrafficPoint(
            timestamp=now_str,
            tcp_packets=0,
            udp_packets=0,
            icmp_packets=0,
            total_bytes=0
        ))

    def update_flow(self, flow: FlowRecord) -> None:
        """Updates internal traffic metrics from an observed flow record."""
        now = time.time()
        self._active_flows[flow.flow_id] = flow
        self._total_packets += flow.packet_count
        self._total_bytes += flow.byte_count

        proto = str(flow.protocol).upper()
        if proto in self._protocol_counts:
            self._protocol_counts[proto] += flow.packet_count
        else:
            self._protocol_counts["OTHER"] += flow.packet_count

        # Evict completed or idle flows (> 30s old)
        stale_keys = [k for k, f in self._active_flows.items() if (now - f.last_seen) > 30.0]
        for k in stale_keys:
            del self._active_flows[k]

        # Update historical timeline point every 5 seconds
        if (now - self._last_history_t) >= 5.0:
            self._last_history_t = now
            t_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
            point = HistoricalTrafficPoint(
                timestamp=t_str,
                tcp_packets=self._protocol_counts.get("TCP", 0),
                udp_packets=self._protocol_counts.get("UDP", 0),
                icmp_packets=self._protocol_counts.get("ICMP", 0),
                total_bytes=self._total_bytes
            )
            self._history.append(point)
            if len(self._history) > self.max_history_points:
                self._history.pop(0)

        # Persist updated traffic metrics to SQLite store
        try:
            from app.alerts.store import alert_store
            stats = self.get_current_stats()
            alert_store.save_traffic_stats({
                "active_flows": stats.active_flows,
                "total_packets_sec": stats.total_packets_sec,
                "total_bytes_sec": stats.total_bytes_sec,
                "bandwidth_mbps": stats.bandwidth_mbps,
                "protocol_distribution": stats.protocol_distribution
            })
        except Exception:
            pass

    def get_current_stats(self) -> CurrentTrafficStats:
        """Calculates current throughput and active flow metrics."""
        elapsed = max(1.0, time.time() - self._start_time)
        packets_sec = round(self._total_packets / elapsed, 2)
        bytes_sec = round(self._total_bytes / elapsed, 2)
        bandwidth_mbps = round((bytes_sec * 8.0) / 1_000_000.0, 2)

        return CurrentTrafficStats(
            timestamp=datetime.now(timezone.utc),
            active_flows=len(self._active_flows),
            total_packets_sec=packets_sec,
            total_bytes_sec=bytes_sec,
            bandwidth_mbps=bandwidth_mbps,
            protocol_distribution=dict(self._protocol_counts)
        )

    def get_historical_points(self) -> List[HistoricalTrafficPoint]:
        """Returns bounded historical timeline points."""
        return list(self._history)

    def reset(self) -> None:
        """
        Safely resets in-memory active flows, protocol counts, total throughput metrics,
        timeline history points, and SQLite traffic persistence store.
        """
        now = time.time()
        self._active_flows.clear()
        self._protocol_counts = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        self._total_packets = 0
        self._total_bytes = 0
        self._start_time = now
        self._last_history_t = now

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self._history = [
            HistoricalTrafficPoint(
                timestamp=now_str,
                tcp_packets=0,
                udp_packets=0,
                icmp_packets=0,
                total_bytes=0
            )
        ]

        try:
            from app.alerts.store import alert_store
            alert_store.clear_traffic_stats()
            alert_store.save_traffic_stats({
                "active_flows": 0,
                "total_packets_sec": 0.0,
                "total_bytes_sec": 0.0,
                "bandwidth_mbps": 0.0,
                "protocol_distribution": {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
            })
        except Exception as e:
            logger.error(f"Error persisting zero traffic snapshot during reset: {e}")


class PipelineEngine:
    """
    Unified Real-Time Detection Pipeline Engine.
    Coordinates flow ingestion, feature extraction, detector invocation, risk fusion,
    alert creation, traffic analytics tracking, and WebSocket event broadcasting.
    """

    def __init__(self, alert_threshold: float = 0.65):
        self.alert_threshold = alert_threshold

        # Canonical detector model paths resolved relative to repository root
        ddos_model_path = resolve_model_path("data/models/ddos_rf_unsw_nb15_v1.joblib")
        recon_model_path = resolve_model_path("data/models/recon_scan_rf_unsw_nb15_v1.joblib")

        self.ddos_detector = DDoSDetector(
            model_path=ddos_model_path
        )     
        self.c2_detector = C2Detector()
        self.dga_detector = DGADetector()
        self.dns_tunnel_detector = DNSTunnelDetector()
        self.tls_detector = TLSDetector()
        self.recon_detector = ReconDetector(
            model_path=recon_model_path
        )
        self.exfil_detector = ExfiltrationDetector()


        # Risk Fusion Engine & Traffic Analytics Tracker
        self.fusion_engine = RiskFusionEngine()
        self.traffic_tracker = TrafficTracker()

    def process_flow(self, flow: FlowRecord) -> FusedRiskAssessment:
        """
        Processes a single observed flow through the full detection & fusion pipeline.
        """
        # 1. Update Traffic Analytics Metrics
        self.traffic_tracker.update_flow(flow)

        # 2. Extract Feature Vector / Dictionary
        flow_feat = extract_flow_features(flow)
        
        # Build standardized FeatureVector for full detector compatibility
        extra_kwargs = {}
        for attr in ["domain_name", "dns_query", "dns_entropy", "dns_query_length", "dns_digit_ratio",
                     "dns_unique_character_ratio", "dns_nxdomain_ratio", "dns_query_frequency",
                     "tls_ja3", "tls_version", "tls_cipher", "tls_std_packet_size", "tls_mean_packet_size",
                     "temporal_periodicity", "source_entropy", "demo_campaign_id", "source"]:
            if hasattr(flow, attr) and getattr(flow, attr) is not None:
                extra_kwargs[attr] = getattr(flow, attr)

        fv = FeatureVector(
            flow_id=flow.flow_id,
            timestamp=flow.first_seen,
            protocol=flow.protocol,
            flow_packet_count=flow.packet_count,
            flow_byte_count=flow.byte_count,
            flow_duration=flow.duration,
            flow_packets_per_sec=flow.packets_per_second,
            flow_bytes_per_sec=flow.bytes_per_second,
            direction_src_to_dst_packets=flow.src_packets,
            direction_dst_to_src_packets=flow.dst_packets,
            direction_src_to_dst_bytes=flow.src_bytes,
            direction_dst_to_src_bytes=flow.dst_bytes,
            directional_packet_ratio=flow_feat.directional_packet_ratio,
            directional_byte_ratio=flow_feat.directional_byte_ratio,
            tcp_syn_count=flow.tcp_flags.get("SYN", 0),
            tcp_ack_count=flow.tcp_flags.get("ACK", 0),
            tcp_fin_count=flow.tcp_flags.get("FIN", 0),
            tcp_rst_count=flow.tcp_flags.get("RST", 0),
            tcp_psh_count=flow.tcp_flags.get("PSH", 0),
            **{k: v for k, v in extra_kwargs.items() if k in FeatureVector.model_fields}
        )

        # Build context dictionary with IP and port identifiers for detectors
        feat_dict = fv.model_dump()
        feat_dict["src_ip"] = flow.src_ip
        feat_dict["dst_ip"] = flow.dst_ip
        feat_dict["src_port"] = flow.src_port
        feat_dict["dst_port"] = flow.dst_port
        feat_dict.update(extra_kwargs)

        # 3. Invoke All 7 Threat Detectors
        results = [
            self.ddos_detector.analyze(fv),
            self.c2_detector.analyze(fv),
            self.dga_detector.analyze(fv),
            self.dns_tunnel_detector.analyze(fv),
            self.tls_detector.analyze(fv),
            self.recon_detector.analyze(feat_dict),
            self.exfil_detector.analyze(feat_dict)
        ]

        # 4. Risk Fusion across Detector Results
        fused = self.fusion_engine.fuse(
            results,
            flow_id=flow.flow_id,
            src_ip=flow.src_ip,
            dst_ip=flow.dst_ip
        )

        # 5. Alert Generation when Fused Risk meets or exceeds Alert Threshold
        if fused.fused_score >= self.alert_threshold and fused.primary_threat_class != "BENIGN":
            p_threat = fused.primary_threat_class.upper()
            if p_threat.startswith("DDOS"):
                model_ver = self.ddos_detector.model_version
                det_name = self.ddos_detector.detector_name
            elif "RECON" in p_threat:
                model_ver = self.recon_detector.model_version
                det_name = self.recon_detector.detector_name
            elif "C2" in p_threat:
                model_ver = self.c2_detector.model_version
                det_name = self.c2_detector.detector_name
            elif "DGA" in p_threat:
                model_ver = self.dga_detector.model_version
                det_name = self.dga_detector.detector_name
            elif "DNS" in p_threat:
                model_ver = self.dns_tunnel_detector.model_version
                det_name = self.dns_tunnel_detector.detector_name
            elif "TLS" in p_threat or "ENCRYPTED" in p_threat:
                model_ver = self.tls_detector.model_version
                det_name = self.tls_detector.detector_name
            elif "EXFIL" in p_threat:
                model_ver = self.exfil_detector.model_version
                det_name = self.exfil_detector.detector_name
            else:
                model_ver = self.ddos_detector.model_version
                det_name = "risk_fusion_engine"

            alert = Alert(
                flow_id=flow.flow_id,
                source_ip=flow.src_ip,
                destination_ip=flow.dst_ip,
                source_port=flow.src_port,
                destination_port=flow.dst_port,
                protocol=flow.protocol,
                threat_class=fused.primary_threat_class,
                confidence=fused.confidence,
                severity=fused.severity,
                evidence={
                    "risk_score": fused.fused_score,
                    "corroborating_threats": fused.corroborating_threats,
                    "detector_scores": fused.detector_scores,
                    "contributing_evidence": fused.contributing_evidence
                },
                detector_name="risk_fusion_engine",
                model_version=model_ver
            )
            created_alert = alert_manager.create_alert(alert)

            # Broadcast alert_created event over WebSocket
            try:
                from app.api.websocket import ws_manager
                ws_manager.broadcast_sync({
                    "type": "alert_created",
                    "event": "alert_created",
                    "data": created_alert.model_dump(mode="json")
                })
            except Exception as e:
                logger.debug(f"WebSocket broadcast skipped: {e}")

        # 6. Broadcast Real-Time Traffic Stats Update over WebSocket
        stats = self.traffic_tracker.get_current_stats()
        try:
            from app.api.websocket import ws_manager
            ws_manager.broadcast_sync({
                "type": "traffic_update",
                "event": "traffic_update",
                "data": stats.model_dump(mode="json")
            })
        except Exception as e:
            logger.debug(f"WebSocket broadcast skipped: {e}")

        return fused


# Global Pipeline Engine singleton instance
pipeline_engine = PipelineEngine()
