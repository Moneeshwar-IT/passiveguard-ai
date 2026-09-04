# PassiveGuard AI — Module 12 & 13 ML Pipeline & Inference Technical Documentation

## Executive Overview
Modules 12 and 13 introduce a **reproducible, offline Machine Learning training, evaluation, live inference, and hybrid risk fusion architecture** for PassiveGuard AI.

> **PASSIVE ENCLAVE & METRICS DIRECTIVE**
> 1. ML models are trained ONLY on transport-layer metadata and observable flow metrics available to the passive monitoring enclave. Encrypted sessions (TLS/QUIC) are evaluated using observable handshake/flow metadata without payload decryption.
> 2. Reported performance metrics are specific to evaluated dataset splits and MUST NOT be interpreted as guaranteed real-world detection performance.
> 3. Zero network sockets, zero DNS lookups, and zero active network probing are performed during training or inference.
> 4. **Disclaimer**: The current DDoS Random Forest model artifact was validated using a controlled synthetic fixture (`synthetic_fixture`). Its measured test metrics (F1 = 1.0000) are not evidence of production-world accuracy.

---

## Architecture & Data Flow

```text
Dataset (CSV/Parquet)
         ↓
Dataset Metadata Registry & Schema Validation (DatasetRegistry)
         ↓
Label Mapper (Raw Labels → Canonical PassiveGuard Threat Classes)
         ↓
Reproducible Split (70% Train, 15% Validation, 15% Test) [seed=42]
         ↓
Fit Scalers & Preprocessors on TRAIN Set ONLY (Data Leakage Prevention)
         ↓
Model Training (RandomForestClassifier, HistGradientBoostingClassifier)
         ↓
Evaluation on Held-Out Test Set (Accuracy, Macro/Weighted F1, FPR, FNR, Confusion Matrix)
         ↓
Artifact Persistence (.joblib Binary + .json DataManifest in data/models & data/manifests)
         ↓
In-Memory ML Inference Engine (MLInferenceEngine)
         ↓
Hybrid DDoS Detector (Layer A Statistical + Layer B ML Corroboration)
         ↓
Multi-Detector Risk Fusion Engine (RiskFusionEngine)
         ↓
Alert Manager & REST API / WebSocket Streaming
```

---

## Dataset Registry & Supported Threat Classes

| Dataset Identifier | Primary Source | Available Features / Labels | Supported PassiveGuard Threat Classes |
| :--- | :--- | :--- | :--- |
| **UNSW-NB15** | ACCS (2015) | DoS, Reconnaissance, Exploits, Fuzzers | `DDOS`, `RECON_SCAN` |
| **CSE-CIC-IDS2018** | CSE / CIC (2018) | DDoS, Botnet, Infiltration | `DDOS`, `C2_BEACON`, `RECON_SCAN` |
| **CIC-DDoS2019** | CIC (2019) | SYN flood, UDP flood, Amplification | `DDOS` |
| **CTU-13** | CTU (2011) | Botnet C2 captures | `C2_BEACON` |
| **DGA-Dataset-2020** | Academic Corpus | Lexical domain strings | `DGA_DOMAIN`, `DNS_TUNNEL` |

---

## Data Preprocessing & Leakage Prevention

1. **Leakage Prevention Guarantee**: The raw dataset is split into **70% Train**, **15% Validation**, and **15% Test** using a fixed random seed (`random_seed = 42`) BEFORE fitting scalers or transformers.
2. **Missing & Infinity Cleaning**: NaNs and Infinities are detected, imputed using column medians, and logged in `DataManifest.cleaning_audit`.
3. **Explicit Label Mapping**: Raw strings are mapped via `LabelMapper.map_label()` to canonical threat classes (`DDOS`, `RECON_SCAN`, `C2_BEACON`, `DGA_DOMAIN`, `DNS_TUNNEL`, `ENCRYPTED_MALWARE`, `DATA_EXFILTRATION`, `BENIGN`). Unmapped labels return `NOT_SUPPORTED_BY_DATASET`.

---

## Model Evaluation Metrics

Training runs record actual measured evaluation metrics on the held-out test set:
- **Accuracy**
- **Precision (Macro)**
- **Recall (Macro)**
- **Macro F1-Score**
- **Weighted F1-Score**
- **False Positive Rate (FPR)**: $FP / (FP + TN)$
- **False Negative Rate (FNR)**: $FN / (FN + TP)$
- **Numerical Confusion Matrix**: `[[TN, FP], [FN, TP]]`
- **Overfitting Gap Check**: Train F1 vs Test F1 score gap analysis.

---

## Model Artifact Storage & Manifest Schema

Artifacts are persisted under `data/models/` and `data/manifests/`:
- Binary Artifact: `ddos_rf_v1.joblib` (Contains fitted model, scaler, feature list, and model metadata).
- Data Manifest: `ddos_rf_v1.json` (Structured JSON recording dataset provenance, split ratios, cleaning logs, confusion matrix, feature importances, and evaluation metrics).

---

## ML Inference Integration & Fallback Architecture

### 1. Robust Model Loading & Fallback
The `MLInferenceEngine` loads model joblib artifacts **ONCE** during detector initialization. If model binaries are missing or corrupted, the system logs `ML inference unavailable`, sets `ml_available: false`, and falls back 100% to Layer A statistical heuristics without throwing exceptions or interrupting traffic processing.

### 2. Hybrid DDoS Score Fusion
```text
Statistical Detection (Layer A) + ML Corroboration (Layer B) → Bounded DDoS Assessment
```
To prevent ML model predictions from suppressing strong statistical indicators when un-trained on specific sub-classes:
$$\text{fused\_score} = \max(\text{stat\_score}, \min(1.0, 0.50 \times \text{stat\_score} + 0.50 \times \text{ml\_score}))$$

### 3. Model Agreement Metric
Calculates `agreement: true/false` comparing whether Layer A ($S_{stat} \ge 0.65$) and Layer B ($S_{ml} \ge 0.50$) consistently report threat status for explainable alert telemetry.

### 4. Detector & Model Status REST API
`GET /api/models`: Exposes status of all 7 detectors and active ML models with dataset provenance (`synthetic_fixture`) and explicit disclaimers.
