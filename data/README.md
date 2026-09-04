# PassiveGuard AI — Dataset Registry & Data Directory Architecture

This directory houses offline dataset artifacts, feature manifests, and trained model binaries for **PassiveGuard AI**.

> **STRICT PASSIVE & OFFLINE DIRECTIVE**
>
> 1. Dataset acquisition is an explicit user action. Automated online dataset downloads during application startup or test runs (`pytest -v`) are **STRICTLY FORBIDDEN**.
> 2. ML models operate exclusively on observable flow metadata and packet metrics inside the passive monitoring enclave. **Zero payload decryption or active network probing is performed.**

---

## Directory Layout

```text
data/
├── raw/         # Unprocessed raw dataset CSVs/Parquets (git-ignored)
├── processed/   # Cleaned feature tables (git-ignored)
├── samples/     # Lightweight PCAP & CSV test samples (e.g. sample.pcap)
├── models/      # Trained .joblib model binaries (git-ignored)
├── manifests/   # Reproducible JSON training manifests & confusion matrices
└── README.md    # Dataset registry documentation (this file)
```

---

## Supported Public Datasets

| Dataset Name | Primary Source | Supported PassiveGuard Threat Classes | Key Limitations |
| :--- | :--- | :--- | :--- |
| **UNSW-NB15** | ACCS (2015) | `DDOS`, `RECON_SCAN` | Lacks QUIC TLS metadata, DGA strings, DNS tunnel payloads. |
| **CSE-CIC-IDS2018** | CSE / CIC (2018) | `DDOS`, `C2_BEACON`, `RECON_SCAN` | Rich volumetric telemetry; limited DNS tunnel query granularity. |
| **CIC-DDoS2019** | CIC (2019) | `DDOS` | Specialized volumetric & reflection flood dataset; zero C2/Exfil. |
| **CTU-13** | CTU (2011) | `C2_BEACON` | Specialized botnet C2 channel captures. |
| **DGA-Dataset-2020** | Academic Corpus | `DGA_DOMAIN`, `DNS_TUNNEL` | Lexical domain string dataset; lacks transport packet timing. |

---

## Explicit Label Mapping Layer

Raw dataset labels are mapped to PassiveGuard canonical threat classes via `app.ml.preprocessing.LabelMapper`:

```text
Raw Label               PassiveGuard Threat Class
─────────────────────────────────────────────────────────────
"DoS" / "DDoS"       →  DDOS
"Reconnaissance"     →  RECON_SCAN
"Bot" / "Botnet"     →  C2_BEACON
"dga_conficker"      →  DGA_DOMAIN
"Normal" / "Benign"  →  BENIGN
unmapped / unsupported → NOT_SUPPORTED_BY_DATASET
```

---

## Data Leakage Prevention Strategy

Training runs strictly enforce data leakage prevention:
1. Raw dataset is split into **70% Train**, **15% Validation**, and **15% Test** using a fixed random seed (`random_seed = 42`).
2. Scalers and feature transformers are fitted on the **Train set ONLY** and applied to Validation and Test sets.
