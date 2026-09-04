# PassiveGuard AI — AI-Based Threat Detection in Unidirectional IP Traffic

**PassiveGuard AI** is a passive cybersecurity threat monitoring platform engineered for isolated security enclaves. It analyzes one-directional IP network traffic captured from **PCAP**, **NetFlow**, and **IPFIX** streams to detect sophisticated cyber threats without transmitting packets or altering network flow.

---

## Architecture Overview

```text
                  ┌───────────────────┐
                  │ PCAP / Flow Input │
                  └─────────┬─────────┘
                            ↓
                  ┌───────────────────┐
                  │ Passive Ingestion │
                  └─────────┬─────────┘
                            ↓
                  ┌───────────────────┐
                  │ Feature Engine    │
                  └─────────┬─────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
      DDoS             C2 / DNS             TLS
        ↓                   ↓                   ↓
      Recon             Exfil              DGA
        └───────────────────┼───────────────────┘
                            ↓
                  ┌───────────────────┐
                  │ Risk Fusion       │
                  └─────────┬─────────┘
                            ↓
                  ┌───────────────────┐
                  │ Alert Manager     │
                  └─────────┬─────────┘
                            ↓
                 ┌──────────┴──────────┐
                 ↓                     ↓
             REST API              WebSocket
                 ↓                     ↓
                 └──────────┬──────────┘
                            ↓
                  ┌───────────────────┐
                  │ React Dashboard   │
                  └─────────┬─────────┘
```

> **PassiveGuard AI uses a read-only monitoring architecture.** The detection enclave consumes observed traffic metadata and never sends packets or control traffic back into the monitored production network.

---

## 1. SIH Problem Statement

> **AI-Based Detection of Cyber Threats in Unidirectional IP Traffic**
> 
> *Monitoring and analyzing unidirectional network data in secure enclaves using AI/ML models to identify volumetric attacks, covert C2 channels, algorithmically generated domains, reconnaissance sweeps, and unauthorized data exfiltration.*

---

## 2. ABSOLUTE PASSIVE SECURITY CONSTRAINTS

> [!CAUTION]
> **STRICT PASSIVE ENCLAVE DIRECTIVE**
>
> The PassiveGuard AI architecture is strictly passive, read-only, and observation-only.

Under **NO CIRCUMSTANCES** does the system:
* Transmit or inject packets onto the network.
* Perform active network scanning or port probing.
* Initiate TCP/UDP handshakes or send RST/FIN packets.
* Query observed source or destination systems (e.g. active DNS/WHOIS lookups).
* Modify, delay, or block observed IP traffic.
* Send automated network mitigation or firewall commands.
* Decrypt TLS or QUIC encrypted payload contents.

---

## 3. Threat Categories & Detectors

1. **DDoS Detection**: Volumetric floods, SYN flooding, UDP amplification, spoofed sources (`ddos_detector`). Combines Layer A transparent statistical heuristics and Layer B Random Forest ML inference (`ddos_rf_v1.joblib`).
2. **Command & Control (C2)**: Periodic beaconing, low-and-slow heartbeats, fixed inter-arrival times (`c2_detector`).
3. **DGA Domain Detection**: Shannon entropy in SLD query strings, digit & character distributions (`dga_detector`).
4. **DNS Tunnelling**: Subdomain diversity churn, payload entropy, long query label statistics (`dns_tunneling_detector`).
5. **Encrypted Malware (TLS/QUIC)**: Packet size distribution uniformity, timing regularity, fingerprint metadata (JA3/JA4) (**no decryption**) (`tls_detector`).
6. **Reconnaissance & Port Scanning**: Vertical port scans, horizontal IP sweeps, SYN probe storms (`recon_detector`).
7. **Data Exfiltration**: Asymmetric egress byte volumes, sustained transfer durations, local destination rarity (`exfiltration_detector`).
8. **Multi-Detector Risk Fusion**: Corroborative multi-signal risk fusion engine (`risk_fusion_engine`).
9. **ML Inference Integration**: In-memory `MLInferenceEngine` evaluating trained joblib models with graceful fallback, agreement metrics, and bounded score fusion. Exposes `GET /api/models` status endpoint.

---

## 4. Installation & Getting Started

### Prerequisites
* Python 3.11 or higher
* Node.js 18+ and npm
* Git

### Step 1: Start Backend Server
```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Step 2: Start React Dashboard Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Step 3: Run PCAP Replay Simulation
In a third terminal:
```bash
python scripts/replay_pcap.py data/samples/sample.pcap --speed 1.0
```

---

## 5. Controlled Demonstration Framework (Module 14)

PassiveGuard AI includes a **safe, deterministic, offline controlled threat simulation framework** for SIH demonstrations, development testing, and dashboard verification.

> [!IMPORTANT]
> **CONTROLLED DEMONSTRATION SAFETY DIRECTIVE**
> 
> * Uses 100% synthetic in-memory telemetry streams tagged `source="controlled_demo"`.
> * Runs strictly offline — zero network packet transmission, zero active scanning, zero DNS resolution, and zero TLS decryption.
> * Exercises the **actual** `PipelineEngine`, `FeatureEngine`, Detectors, `RiskFusionEngine`, `AlertManager`, and WebSocket streaming.
> * All generated threat metrics are strictly **CONTROLLED DEMONSTRATION RESULTS**.

### Demonstration Commands

```bash
# Clear SQLite alert database and reset temporal state trackers
python scripts/run_demo.py --clear

# List available demonstration scenarios
python scripts/generate_demo_data.py --list

# Run specific controlled threat scenarios through the live pipeline engine
python scripts/run_demo.py --scenario ddos
python scripts/run_demo.py --scenario c2
python scripts/run_demo.py --scenario dga
python scripts/run_demo.py --scenario dns_tunnel
python scripts/run_demo.py --scenario tls_malware
python scripts/run_demo.py --scenario recon
python scripts/run_demo.py --scenario exfiltration

# Run multi-stage attack chain demonstration
python scripts/run_demo.py --scenario mixed
```

---

## 5.1 Cross-Process Persistence Architecture (Module 16)

```text
Controlled Demo Process (run_demo.py)
                 ↓
        PipelineEngine & Detectors
                 ↓
        Risk Fusion Engine
                 ↓
      AlertManager & Traffic Tracker
                 ↓
      Shared Local SQLite Store (data/passiveguard.db)
                 │
  ┌──────────────┴──────────────┐
  ↓                             ↓
FastAPI Backend (GET /api/alerts)  WebSocket Background Poller
  ↓                             ↓
  └──────────────┬──────────────┘
                 ↓
        React SOC Dashboard (http://localhost:5173)
```

> [!NOTE]
> * **Local Inter-Process Bridge**: The SQLite store (`data/passiveguard.db`) serves as a local inter-process communication bridge between the isolated demonstration runner CLI (`scripts/run_demo.py`) and the FastAPI backend process (`uvicorn app.main:app`).
> * **Production Unidirectional Enclave**: In production deployment, the passive monitoring enclave ingests raw PCAP/NetFlow/IPFIX streams directly within a single read-only process, never transmitting packets back into the production network.

### Scenario & Threat Mapping Catalog

| Demonstration Scenario | Target Detector | Primary Threat Class | Telemetry Attributes |
| :--- | :--- | :--- | :--- |
| **DDoS** | DDoS Detector | `DDOS_SYN_FLOOD` / `DDOS_SPOOFED_SOURCE` | Volumetric packet/byte rate, SYN heavy, SYN-ACK ratio |
| **C2 Beaconing** | C2 Detector | `C2_BEACON` | Periodic heartbeat sequence, low IAT jitter, same IP:port |
| **DGA Domain** | DGA Detector | `DGA_DOMAIN` | Shannon entropy H(X) > 4.0, long label, digit ratio |
| **DNS Tunnelling** | DNS Tunnel Detector | `DNS_TUNNEL` | Long subdomains (>60 chars), entropy > 4.5, query frequency |
| **TLS Malware** | TLS Detector | `ENCRYPTED_MALWARE` | Uniform packet sizes, fixed payload IATs, JA3 fingerprint |
| **Reconnaissance** | Recon Detector | `RECON_SCAN` | Single source IP hitting 25 distinct destination ports |
| **Exfiltration** | Exfiltration Detector | `DATA_EXFILTRATION` | 150 MB egress volume, severe outbound byte asymmetry |
| **Mixed Chain** | Unified Risk Engine | Multi-Stage Attack Chain | Recon → C2 → DGA → Tunnel → TLS → Exfil → DDoS (`demo_campaign_id`) |

---

## 5.2 Real Cybersecurity Dataset Training & Validation (Module 16)

PassiveGuard AI provides a reproducible offline ML training and evaluation framework supporting public cybersecurity datasets:

* **UNSW-NB15** (Australian Centre for Cyber Security, 2015)
* **CSE-CIC-IDS2018** (Communications Security Establishment & Canadian Institute for Cybersecurity, 2018)
* **Synthetic Fixture** (Controlled offline benchmark for automated testing)

> [!IMPORTANT]
> **NO AUTOMATIC INTERNET DOWNLOAD POLICY**
> * PassiveGuard AI **NEVER** downloads datasets automatically over the Internet.
> * Datasets are manually placed by developers under `data/raw/unsw_nb15/` or `data/raw/cse_cic_ids2018/`.
> * If dataset CSV files are missing, PassiveGuard AI gracefully reports their absence without fabricating real-world performance metrics.

### Dataset Training Commands

```bash
# 1. Train Random Forest model on local UNSW-NB15 dataset
python scripts/train_models.py --dataset unsw_nb15 --target DDOS --model rf --out data/models

# 2. Train Random Forest model on local CSE-CIC-IDS2018 dataset
python scripts/train_models.py --dataset cse_cic_ids2018 --target DDOS --model rf --out data/models

# 3. Train on synthetic benchmark fixture (for automated CI/CD pipeline verification)
python scripts/train_models.py --dataset synthetic --target DDOS --model rf --out data/models

# 4. Validate trained model artifact against held-out test data
python scripts/validate_real_dataset.py --dataset unsw_nb15 --model data/models/ddos_rf_unsw_nb15_v1.joblib
```

---

## 6. Running Automated Tests

Run the full Pytest suite across all 16 modules:
```bash
cd backend
pytest -v
```

All 241 tests pass cleanly, verifying zero active socket connections, zero packet transmissions, zero DNS lookups, and zero TLS decryption.
