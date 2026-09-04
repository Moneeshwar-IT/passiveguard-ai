# PassiveGuard AI — Raw Cybersecurity Datasets Directory

This directory stores raw public cybersecurity dataset CSV files for local model training and validation.

> [!IMPORTANT]
> **NO AUTOMATIC INTERNET DOWNLOAD POLICY**
> * PassiveGuard AI **NEVER** downloads datasets automatically over the Internet.
> * Users and developers manually place dataset CSV files under their respective local subdirectories.
> * If a dataset is missing, PassiveGuard AI gracefully reports its absence and skips real-data model training without failing unit tests.

---

## Supported Dataset Directory Layout

Place dataset CSV files under the following subdirectories:

### 1. UNSW-NB15
**Path**: `data/raw/unsw_nb15/`
**Expected CSV files**:
- `UNSW_NB15_testing-set.csv`
- `UNSW_NB15_training-set.csv`
- `UNSW-NB15_1.csv`, `UNSW-NB15_2.csv`, `UNSW-NB15_3.csv`, `UNSW-NB15_4.csv`

### 2. CSE-CIC-IDS2018
**Path**: `data/raw/cse_cic_ids2018/`
**Expected CSV files**:
- `02-14-2018.csv`, `02-15-2018.csv`, `02-20-2018.csv`, `02-21-2018.csv`
- `CSE-CIC-IDS2018.csv`

---

## Training Commands

Once CSV files are placed in their respective subdirectories, execute:

```bash
# Train on UNSW-NB15
python scripts/train_models.py --dataset unsw_nb15 --target DDOS --model rf --out data/models

# Train on CSE-CIC-IDS2018
python scripts/train_models.py --dataset cse_cic_ids2018 --target DDOS --model rf --out data/models

# Validate Model on Held-Out Real Test Data
python scripts/validate_real_dataset.py --dataset unsw_nb15 --model data/models/ddos_rf_unsw_nb15_v1.joblib
```
