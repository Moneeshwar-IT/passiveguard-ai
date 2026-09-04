"""
PassiveGuard AI — Base Dataset Adapter Interface (Module 16)

STRICT PASSIVE & HONEST METRICS DIRECTIVE:
Defines the standard abstract adapter interface for loading, validating,
mapping labels, and categorizing feature availability for cybersecurity datasets.

Zero network transmission, zero automatic internet downloading, zero fabricated metrics.
"""
import os
import json
import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Standard PassiveGuard Flow Feature Schema
PASSIVEGUARD_FEATURE_SCHEMA = [
    "flow_duration",
    "flow_packet_count",
    "flow_byte_count",
    "flow_packets_per_sec",
    "flow_bytes_per_sec",
    "tcp_syn_count",
    "tcp_ack_count",
    "tcp_syn_ack_ratio",
    "directional_byte_ratio",
    "directional_packet_ratio",
    "packet_size_mean",
    "packet_size_std"
]


class BaseDatasetAdapter(ABC):
    """
    Abstract base class for cybersecurity dataset adapters.
    Operates strictly on LOCAL files.
    """

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir
        self.cleaning_audit: Dict[str, Any] = {
            "initial_rows": 0,
            "cleaned_rows": 0,
            "dropped_rows": 0,
            "dropped_reasons": []
        }

    @property
    @abstractmethod
    def dataset_name(self) -> str:
        """Name of dataset (e.g. UNSW-NB15, CSE-CIC-IDS2018)."""
        pass

    @property
    @abstractmethod
    def dataset_version(self) -> str:
        """Version tag or release year of dataset."""
        pass

    @property
    @abstractmethod
    def source_description(self) -> str:
        """Academic or institutional source description."""
        pass

    @property
    def has_predefined_splits(self) -> bool:
        """Returns True if dataset provides explicit predefined train/test files."""
        return False

    def load_splits(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Loads predefined (train_df, test_df) DataFrames if available.
        Raises NotImplementedError if no predefined splits exist.
        """
        raise NotImplementedError("This dataset adapter does not provide predefined train/test splits.")

    @abstractmethod
    def discover_local_files(self) -> List[str]:
        """Discovers supported local dataset CSV files."""
        pass

    @abstractmethod
    def load(self, file_path: Optional[str] = None) -> pd.DataFrame:
        """Loads dataset from local file(s) into DataFrame."""
        pass

    @abstractmethod
    def map_labels(self, df: pd.DataFrame, target_threat_class: str = "DDOS") -> Tuple[pd.DataFrame, Dict[str, int]]:
        """Maps dataset attack labels into BENIGN, target_threat_class, or EXCLUDED."""
        pass

    @abstractmethod
    def map_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """
        Maps raw dataset columns into PassiveGuard feature schema.
        Returns mapped DataFrame and feature availability dict (DIRECTLY AVAILABLE, DERIVABLE, NOT AVAILABLE).
        """
        pass

    def clean_dataframe(self, df: pd.DataFrame, feature_cols: List[str]) -> pd.DataFrame:
        """
        Cleans invalid, infinite, or missing values from feature columns.
        """
        initial_len = len(df)
        self.cleaning_audit["initial_rows"] = initial_len

        # Replace infinite values with NaN
        df[feature_cols] = df[feature_cols].replace([np.inf, -np.inf], np.nan)

        # Drop rows with NaN in feature columns
        df_clean = df.dropna(subset=feature_cols).copy()
        
        dropped_count = initial_len - len(df_clean)
        self.cleaning_audit["cleaned_rows"] = len(df_clean)
        self.cleaning_audit["dropped_rows"] = dropped_count
        if dropped_count > 0:
            self.cleaning_audit["dropped_reasons"].append(f"Dropped {dropped_count} rows containing NaN or infinite values")

        return df_clean

    def get_provenance(self, file_paths: List[str]) -> Dict[str, Any]:
        """Returns provenance dictionary for dataset manifest."""
        return {
            "dataset_name": self.dataset_name,
            "dataset_version": self.dataset_version,
            "dataset_source": self.source_description,
            "dataset_files": [os.path.basename(f) for f in file_paths],
            "is_local_file": True
        }
