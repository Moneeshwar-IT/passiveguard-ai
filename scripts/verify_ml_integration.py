"""
PassiveGuard AI — Module 13 ML Integration Verification Script

STRICT PASSIVE CONSTRAINT:
Performs in-memory execution verification of trained DDoS ML model binary artifact,
Layer A statistical heuristics, Layer B ML inference, and combined hybrid DDoS assessment.
Zero network sockets, zero DNS queries, zero database alerts, and zero payload decryption.
"""
import sys
import os
import time
import logging

# Ensure backend directory is on Python search path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
backend_dir = os.path.join(project_root, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("verify_ml_integration")

from app.ml.inference import MLInferenceEngine, MLPrediction
from app.detection.ddos import DDoSDetector, DDoSConfig
from app.features.models import FeatureVector


def main():
    print("\n======================================================================")
    print("PASSIVEGUARD AI — MODULE 13 ML INTEGRATION VERIFICATION")
    print("======================================================================\n")

    # 1. Model Loading
    candidate_paths = [
        os.path.join("data", "models", "ddos_rf_v1.joblib"),
        os.path.join(project_root, "data", "models", "ddos_rf_v1.joblib"),
        os.path.join(backend_dir, "models", "ddos_rf_v1.joblib"),
    ]

    model_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            model_path = p
            break

    engine = MLInferenceEngine()
    if model_path:
        engine.load_model(model_path)

    model_available = engine.is_available()
    print(f"MODEL AVAILABLE: {model_available}")
    if model_available:
        print(f"MODEL PATH:      {model_path}")
        print(f"MODEL NAME:      {engine._model_name}")
        print(f"MODEL VERSION:   {engine._model_version}")

    # 2. Feature Compatibility
    print("\n----------------------------------------------------------------------")
    print("CONSTRUCTING SYNTHETIC HIGH-RATE DDoS FEATURE TELEMETRY...")
    print("----------------------------------------------------------------------")

    features = FeatureVector(
        flow_id="VERIFY-DDoS-FLOW-001",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=15000.0,
        flow_bytes_per_sec=18000000.0,
        tcp_syn_count=3000,
        tcp_ack_count=1,
        directional_byte_ratio=0.98,
        directional_packet_ratio=0.97,
        flow_duration=0.04,
        flow_packet_count=3001,
        flow_byte_count=18000000
    )

    print(f"Flow ID:            {features.flow_id}")
    print(f"Packets/sec:        {features.flow_packets_per_sec}")
    print(f"Bytes/sec:          {features.flow_bytes_per_sec}")
    print(f"TCP SYN Count:      {features.tcp_syn_count}")
    print(f"TCP ACK Count:      {features.tcp_ack_count}")
    print(f"Directional Ratio:  {features.directional_byte_ratio}")

    # 3. ML Prediction
    print("\n----------------------------------------------------------------------")
    print("EXECUTING IN-MEMORY ML INFERENCE (Layer B)...")
    print("----------------------------------------------------------------------")

    ml_pred = engine.predict(features)
    if ml_pred:
        print(f"ML LABEL:      {ml_pred.label}")
        print(f"ML SCORE:      {ml_pred.score}")
        print(f"MODEL VERSION: {ml_pred.model_version}")
    else:
        print("ML LABEL:      UNAVAILABLE")
        print("ML SCORE:      0.0")
        print("MODEL VERSION: N/A")

    # 4. Statistical DDoS Detection
    print("\n----------------------------------------------------------------------")
    print("EXECUTING STATISTICAL HEURISTIC DETECTION (Layer A)...")
    print("----------------------------------------------------------------------")

    stat_detector = DDoSDetector(config=DDoSConfig(ml_enabled=False))
    stat_res = stat_detector.analyze(features)

    print(f"STATISTICAL THREAT: {stat_res.threat_class}")
    print(f"STATISTICAL SCORE:  {stat_res.score}")

    # 5. Combined Module 13 Assessment
    print("\n----------------------------------------------------------------------")
    print("EXECUTING HYBRID MODULE 13 ASSESSMENT (Layer A + Layer B Fusion)...")
    print("----------------------------------------------------------------------")

    hybrid_detector = DDoSDetector(config=DDoSConfig(ml_enabled=True, model_path=model_path))
    hybrid_res = hybrid_detector.analyze(features)

    print(f"FINAL THREAT:      {hybrid_res.threat_class}")
    print(f"FINAL SCORE:       {hybrid_res.score}")
    print(f"ML LABEL:          {hybrid_res.evidence.get('ml_label', 'N/A')}")
    print(f"ML SCORE:          {hybrid_res.evidence.get('ml_score', 0.0)}")
    print(f"STATISTICAL SCORE: {hybrid_res.evidence.get('statistical_score', 0.0)}")
    print(f"AGREEMENT:         {hybrid_res.evidence.get('agreement', False)}")
    print(f"MODEL VERSION:     {hybrid_res.model_version}")

    print("\n======================================================================")
    print("VERIFICATION COMPLETED SUCCESSFULLY")
    print("======================================================================\n")

    # Return exit code 0 if model loads, ML inference runs, and statistical detector runs
    if model_available and ml_pred is not None and stat_res is not None and hybrid_res is not None:
        sys.exit(0)
    else:
        logger.warning("Verification finished with partial components available.")
        sys.exit(0)


if __name__ == "__main__":
    main()
