"""
Detection package for PassiveGuard AI.
Includes BaseDetector interface, DetectionResult contract, and specialized detector modules.
"""
from app.detection.base import BaseDetector, DetectionResult
from app.detection.ddos import DDoSDetector
from app.detection.c2 import C2Detector
from app.detection.dga import DGADetector
from app.detection.tls import TLSDetector
from app.detection.recon import ReconDetector
from app.detection.exfiltration import ExfiltrationDetector

__all__ = [
    "BaseDetector",
    "DetectionResult",
    "DDoSDetector",
    "C2Detector",
    "DGADetector",
    "TLSDetector",
    "ReconDetector",
    "ExfiltrationDetector"
]
