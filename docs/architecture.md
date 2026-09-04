# PassiveGuard AI — High-Level System Architecture

## Overview
PassiveGuard AI is a non-intrusive threat detection system designed for unidirectional, read-only network feeds. It extracts structured telemetry from passive PCAP streams and applies statistical heuristics, ML models, and multi-detector risk fusion to detect cyber threats.

---

## Architectural Diagram

```text
                  Unidirectional PCAP Traffic
                              ↓
                  Read-Only Ingestion Layer
                              ↓
                    Flow Aggregator Stream
                              ↓
                      Feature Engine
                              ↓
 ┌────────────────────────────┴────────────────────────────┐
 ↓                            ↓                            ↓
Statistical Detectors    Hybrid ML Layer            Temporal Recurrence
 (DDoS, C2, DGA, TLS,   (Random Forest DDoS)         & Entropy Trackers
 Recon, Exfiltration)         ↓                            ↓
 └────────────────────────────┬────────────────────────────┘
                              ↓
                   Multi-Detector Risk Fusion
                              ↓
                     Alert Manager Store
                              ↓
                  REST API & WebSocket Engine
                              ↓
                  React/Vite SOC Dashboard
```

---

## Key Subsystems

1. **Read-Only Ingestion**: Ingests PCAP byte streams into `ObservedPacket` and aggregates them into directional `FlowRecord` objects.
2. **Feature Engine**: Extracts 9 flow telemetry features, DNS entropy/churn, TLS/QUIC handshake metadata, and inter-arrival timing statistics.
3. **Hybrid DDoS Threat Detector (Module 13)**: Combines Layer A transparent statistical heuristics and Layer B `MLInferenceEngine` (`ddos_rf_v1.joblib`). Features bounded score fusion $\max(S_{stat}, 0.5 S_{stat} + 0.5 S_{ml})$ and agreement analysis.
4. **Multi-Detector Risk Fusion**: Combines independent detector outputs into a single normalized threat score $[0.0, 1.0]$ with primary threat classification and alert deduplication.
5. **Real-time Pipeline & Dashboard Integration**: Streams active flow telemetry and alerts via WebSocket to the React SOC Dashboard.
