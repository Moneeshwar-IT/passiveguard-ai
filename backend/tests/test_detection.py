import pytest
from app.detection.base import DetectionResult
from app.detection.ddos import DDoSDetector
from app.detection.c2 import C2Detector
from app.detection.dga import DGADetector
from app.detection.tls import TLSDetector
from app.detection.recon import ReconDetector
from app.detection.exfiltration import ExfiltrationDetector

from app.features.flow_features import FlowFeatures
from app.features.dns_features import DNSFeatures
from app.features.tls_features import TLSFeatures
from app.features.temporal_features import TemporalFeatures


def test_ddos_detector():
    detector = DDoSDetector()
    flow_feat = FlowFeatures(
        flow_id="f1",
        packet_count=50000,
        byte_count=30000000,
        duration=2.0,
        packets_per_sec=25000.0,
        bytes_per_sec=15000000.0,
        avg_packet_size=600.0,
        src_port=12345,
        dst_port=80,
        protocol="TCP",
        tcp_syn_count=600
    )
    result = detector.analyze(flow_feat)
    assert isinstance(result, DetectionResult)
    assert result.threat_class in ["DDOS_SYN_FLOOD", "DDOS_VOLUMETRIC", "DDoS"]
    assert result.score > 0.7
    assert result.severity in ["HIGH", "CRITICAL"]


def test_dga_detector():
    detector = DGADetector()
    dns_feat = DNSFeatures(
        domain_name="qwrtyuiop123456x8z.biz",
        domain_length=23,
        shannon_entropy=4.5,
        digit_ratio=0.3,
        vowel_ratio=0.1,
        consonant_ratio=0.6,
        hyphen_count=0,
        subdomain_count=0
    )
    result = detector.analyze(dns_feat)
    assert isinstance(result, DetectionResult)
    assert result.threat_class in ["DGA_DOMAIN", "DGA"]
    assert result.score >= 0.60
    assert result.severity == "HIGH"


def test_all_detectors_contract():
    detectors = [
        DDoSDetector(),
        C2Detector(),
        DGADetector(),
        TLSDetector(),
        ReconDetector(),
        ExfiltrationDetector()
    ]
    for d in detectors:
        res = d.analyze(None)
        assert isinstance(res, DetectionResult)
        assert res.detector_name == d.detector_name
        assert 0.0 <= res.score <= 1.0
        assert res.severity in ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
