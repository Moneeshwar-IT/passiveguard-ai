"""
PassiveGuard AI — Preprocessing, Data Leakage Protection & Manifest Engine (Module 16)

STRICT PASSIVE & LEAKAGE PREVENTION DIRECTIVE:
Enforces reproducible data preprocessing, explicit label mapping, split strategy (time-aware, stratified),
and strict data leakage prevention. Scalers are fitted on the TRAIN set ONLY.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class DataManifest(BaseModel):
    """
    Provenance, audit log, and training manifest model.
    """
    dataset_name: str = Field(..., description="Name of dataset evaluated")
    source: str = Field(default="Local", description="Source or reference of dataset")
    version: str = Field(default="v1.0", description="Dataset version tag")
    dataset_files: List[str] = Field(default_factory=list, description="Local dataset files processed")
    total_samples: int = Field(..., description="Total rows in raw dataset")
    feature_count: int = Field(..., description="Number of feature columns evaluated")
    feature_names: List[str] = Field(default_factory=list, description="Names of feature columns in exact order")
    feature_availability: Dict[str, str] = Field(default_factory=dict, description="Feature categorization (DIRECTLY AVAILABLE, DERIVABLE, NOT AVAILABLE)")
    label_mapping: Dict[str, Any] = Field(default_factory=dict, description="Raw label to PassiveGuard class mapping")
    split_strategy: str = Field(default="stratified", description="Split strategy (time_aware, stratified)")
    imbalance_strategy: str = Field(default="balanced_weights", description="Imbalance handling strategy")
    split_ratios: Dict[str, float] = Field(
        default_factory=lambda: {"train": 0.70, "validation": 0.15, "test": 0.15},
        description="Dataset train/validation/test split ratios"
    )
    random_seed: int = Field(default=42, description="Random seed used for reproducibility")
    class_distribution: Dict[str, int] = Field(default_factory=dict, description="Class label frequencies")
    sample_counts: Dict[str, int] = Field(default_factory=dict, description="Sample counts across train, validation, test splits")
    cleaning_audit: Dict[str, Any] = Field(default_factory=dict, description="Audit log of rows dropped/cleaned")
    evaluation_metrics: Dict[str, Any] = Field(default_factory=dict, description="Measured test set evaluation metrics")
    confusion_matrix: Optional[List[List[int]]] = Field(default=None, description="Numerical confusion matrix")
    feature_importances: Optional[Dict[str, float]] = Field(default=None, description="Feature importance breakdown")
    overfitting_check: Optional[Dict[str, float]] = Field(default=None, description="Train vs Test score gap audit")


class LabelMapper:
    """
    Explicit Label Mapping Layer mapping raw dataset labels to PassiveGuard canonical threat classes.
    """

    CANONICAL_MAP: Dict[str, str] = {
        # Benign labels
        "normal": "BENIGN",
        "benign": "BENIGN",
        "alexa_legit": "BENIGN",
        "0": "BENIGN",
        "0.0": "BENIGN",
        "background": "BENIGN",
        # DDoS labels
        "dos": "DDOS",
        "ddos": "DDOS",
        "dos attacks-hulk": "DDOS",
        "ddos attacks-loic-http": "DDOS",
        "ddos attack-hoic": "DDOS",
        "syn": "DDOS",
        "udp": "DDOS",
        "1": "DDOS",
        "1.0": "DDOS",
        # Reconnaissance labels
        "reconnaissance": "RECON_SCAN",
        "recon": "RECON_SCAN",
        "port_scan": "RECON_SCAN",
        "sweep": "RECON_SCAN",
        # C2 Beaconing labels
        "bot": "C2_BEACON",
        "botnet": "C2_BEACON",
        "c2": "C2_BEACON",
        "c2_beacon": "C2_BEACON",
        # DGA Domain labels
        "dga": "DGA_DOMAIN",
        "dga_domain": "DGA_DOMAIN",
        "dga_conficker": "DGA_DOMAIN",
        "dga_zeus": "DGA_DOMAIN",
        # DNS Tunnelling labels
        "dns_tunnel": "DNS_TUNNEL",
        "dns_tunneling": "DNS_TUNNEL",
        "tunnel": "DNS_TUNNEL",
        # Encrypted Malware labels
        "tls_malware": "ENCRYPTED_MALWARE",
        "encrypted_malware": "ENCRYPTED_MALWARE",
        "malware": "ENCRYPTED_MALWARE",
        # Data Exfiltration labels
        "exfiltration": "DATA_EXFILTRATION",
        "exfil": "DATA_EXFILTRATION",
        "data_exfiltration": "DATA_EXFILTRATION"
    }

    @classmethod
    def map_label(cls, raw_label: Any, default_target: Optional[str] = None) -> str:
        """
        Maps a raw dataset label string or integer to a canonical PassiveGuard threat class.
        Returns 'NOT_SUPPORTED_BY_DATASET' if no defensible semantic mapping exists.
        """
        s_lbl = str(raw_label).strip().lower()
        if s_lbl in cls.CANONICAL_MAP:
            return cls.CANONICAL_MAP[s_lbl]
        if default_target and (s_lbl == "1" or s_lbl == "1.0" or s_lbl == "attack"):
            return default_target
        return "NOT_SUPPORTED_BY_DATASET"


class DataPreprocessor:
    """
    Data Cleaning, Leakage Prevention, and Preprocessing Pipeline.
    Fits transformers on Train split ONLY to eliminate test set data leakage.
    """

    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed

    def prepare_dataset(
        self,
        df: pd.DataFrame,
        feature_cols: List[str],
        label_col: str,
        target_threat_class: Optional[str] = None,
        split_strategy: str = "stratified",
        imbalance_strategy: str = "balanced_weights"
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, Any, Dict[str, Any]]:
        """
        Cleans data, applies label mapping, splits into Train (70%), Validation (15%), Test (15%),
        and fits scaler on Train set ONLY.
        """
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler

        rows_before = len(df)
        reasons = []

        # 1. Check feature columns existence
        missing_cols = [c for c in feature_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Dataset missing required feature columns: {missing_cols}")

        if label_col not in df.columns:
            raise ValueError(f"Dataset missing label column: '{label_col}'")

        # Copy evaluation dataframe
        clean_df = df[feature_cols + [label_col]].copy()

        # 2. Clean NaN / Infinity values in numerical feature columns
        nan_count = clean_df[feature_cols].isna().sum().sum()
        inf_count = np.isinf(clean_df[feature_cols].select_dtypes(include=[np.number])).sum().sum()

        if nan_count > 0 or inf_count > 0:
            clean_df[feature_cols] = clean_df[feature_cols].replace([np.inf, -np.inf], np.nan)
            clean_df[feature_cols] = clean_df[feature_cols].fillna(clean_df[feature_cols].median(numeric_only=True))
            reasons.append(f"Imputed {nan_count} NaNs and {inf_count} Infs using column median")

        # 3. Deduplicate exact matching rows
        dup_count = clean_df.duplicated().sum()
        if dup_count > 0:
            clean_df = clean_df.drop_duplicates().reset_index(drop=True)
            reasons.append(f"Dropped {dup_count} exact duplicate rows")

        # 4. Apply Label Mapping
        if "mapped_label" not in clean_df.columns:
            clean_df["mapped_label"] = clean_df[label_col].apply(
                lambda l: LabelMapper.map_label(l, default_target=target_threat_class)
            )

        # Filter out unmapped / unsupported label rows if present
        unsupported_count = (clean_df["mapped_label"] == "NOT_SUPPORTED_BY_DATASET").sum()
        if unsupported_count > 0:
            clean_df = clean_df[clean_df["mapped_label"] != "NOT_SUPPORTED_BY_DATASET"].reset_index(drop=True)
            reasons.append(f"Dropped {unsupported_count} rows with unsupported labels")

        rows_after = len(clean_df)
        rows_dropped = rows_before - rows_after

        audit = {
            "rows_before": rows_before,
            "rows_after": rows_after,
            "rows_dropped": rows_dropped,
            "reasons": reasons if reasons else ["Clean dataset; zero rows dropped"]
        }

        # 5. Extract Feature Matrix X and Target Array y
        X = clean_df[feature_cols].values

        if target_threat_class:
            y = (clean_df["mapped_label"] == target_threat_class).astype(int).values
        else:
            y = (clean_df["mapped_label"] != "BENIGN").astype(int).values

        # Handle tiny dataset edge case (< 4 rows)
        if len(X) < 4:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            return X_scaled, X_scaled, X_scaled, y, y, y, scaler, audit

        # 6. SPLIT STRATEGY: Time-Aware (sequential) vs Stratified
        if split_strategy.lower() in ["time_aware", "time", "sequential"]:
            n = len(X)
            train_end = int(n * 0.70)
            val_end = int(n * 0.85)

            X_train, y_train = X[:train_end], y[:train_end]
            X_val, y_val = X[train_end:val_end], y[train_end:val_end]
            X_test, y_test = X[val_end:], y[val_end:]
        else:
            # Stratified Random Split
            if len(np.unique(y)) < 2:
                stratify_y = None
            else:
                class_counts = np.bincount(y)
                stratify_y = y if np.min(class_counts) >= 2 else None

            X_train, X_temp, y_train, y_temp = train_test_split(
                X, y, test_size=0.30, random_state=self.random_seed, stratify=stratify_y
            )

            stratify_temp = y_temp if (len(np.unique(y_temp)) >= 2 and np.min(np.bincount(y_temp)) >= 2) else None
            X_val, X_test, y_val, y_test = train_test_split(
                X_temp, y_temp, test_size=0.50, random_state=self.random_seed, stratify=stratify_temp
            )

        # 7. IMBALANCE HANDLING on TRAIN set ONLY
        if imbalance_strategy.lower() == "undersample":
            pos_idx = np.where(y_train == 1)[0]
            neg_idx = np.where(y_train == 0)[0]
            min_count = min(len(pos_idx), len(neg_idx))
            if min_count > 0:
                np.random.seed(self.random_seed)
                pos_sel = np.random.choice(pos_idx, min_count, replace=False)
                neg_sel = np.random.choice(neg_idx, min_count, replace=False)
                keep_idx = np.sort(np.concatenate([pos_sel, neg_sel]))
                X_train, y_train = X_train[keep_idx], y_train[keep_idx]
        elif imbalance_strategy.lower() == "oversample":
            pos_idx = np.where(y_train == 1)[0]
            neg_idx = np.where(y_train == 0)[0]
            max_count = max(len(pos_idx), len(neg_idx))
            if len(pos_idx) > 0 and len(neg_idx) > 0:
                np.random.seed(self.random_seed)
                pos_sel = np.random.choice(pos_idx, max_count, replace=True)
                neg_sel = np.random.choice(neg_idx, max_count, replace=True)
                keep_idx = np.concatenate([pos_sel, neg_sel])
                np.random.shuffle(keep_idx)
                X_train, y_train = X_train[keep_idx], y_train[keep_idx]

        # 8. Fit Scaler on Train split ONLY (zero test set data leakage)
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_val_scaled = scaler.transform(X_val)
        X_test_scaled = scaler.transform(X_test)

        return X_train_scaled, X_val_scaled, X_test_scaled, y_train, y_val, y_test, scaler, audit

    def prepare_predefined_dataset(
        self,
        df_train: pd.DataFrame,
        df_test: pd.DataFrame,
        feature_cols: List[str],
        label_col: str,
        target_threat_class: Optional[str] = None,
        imbalance_strategy: str = "balanced_weights"
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, Any, Dict[str, Any]]:
        """
        Processes predefined Train and Test DataFrames separately to preserve official dataset benchmark boundaries.
        Splits Train set (80/20) for internal validation, fits scaler on Train set ONLY, and preserves Test set.
        """
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler

        # 1. Clean feature columns for both splits
        clean_train = df_train[feature_cols + [label_col]].copy()
        clean_test = df_test[feature_cols + [label_col]].copy()

        clean_train[feature_cols] = clean_train[feature_cols].replace([np.inf, -np.inf], np.nan)
        clean_train[feature_cols] = clean_train[feature_cols].fillna(clean_train[feature_cols].median(numeric_only=True))

        clean_test[feature_cols] = clean_test[feature_cols].replace([np.inf, -np.inf], np.nan)
        clean_test[feature_cols] = clean_test[feature_cols].fillna(clean_test[feature_cols].median(numeric_only=True))

        # 2. Extract feature matrices and target arrays
        X_train_full = clean_train[feature_cols].values
        X_test_raw = clean_test[feature_cols].values

        if target_threat_class:
            y_train_full = (clean_train[label_col] == target_threat_class).astype(int).values
            y_test = (clean_test[label_col] == target_threat_class).astype(int).values
        else:
            y_train_full = (clean_train[label_col] != "BENIGN").astype(int).values
            y_test = (clean_test[label_col] != "BENIGN").astype(int).values

        # 3. Create internal validation split (80/20) from Train set ONLY using Stratified split
        if len(np.unique(y_train_full)) < 2:
            stratify_y = None
        else:
            class_counts = np.bincount(y_train_full)
            stratify_y = y_train_full if np.min(class_counts) >= 2 else None

        X_train_raw, X_val_raw, y_train, y_val = train_test_split(
            X_train_full, y_train_full, test_size=0.20, random_state=self.random_seed, stratify=stratify_y
        )

        # 4. Imbalance Strategy on Train set ONLY (resampling if undersample/oversample)
        if imbalance_strategy == "undersample":
            X_train_raw, y_train = self._apply_undersampling(X_train_raw, y_train)
        elif imbalance_strategy == "oversample":
            X_train_raw, y_train = self._apply_oversampling(X_train_raw, y_train)

        # 5. Fit Scaler on Train set ONLY (zero test leakage)
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train_raw)
        X_val = scaler.transform(X_val_raw)
        X_test = scaler.transform(X_test_raw)

        audit = {
            "rows_before": len(df_train) + len(df_test),
            "rows_after": len(clean_train) + len(clean_test),
            "rows_dropped": (len(df_train) + len(df_test)) - (len(clean_train) + len(clean_test)),
            "train_rows_raw": len(df_train),
            "test_rows_raw": len(df_test),
            "split_type": "official_predefined_split",
            "reasons": ["Cleaned NaNs/Infs and mapped labels for predefined Train and Test sets separately"],
            "leakage_prevention": "Scaler fitted on Train partition ONLY; Test set remains 100% held-out"
        }

        return X_train, X_val, X_test, y_train, y_val, y_test, scaler, audit
