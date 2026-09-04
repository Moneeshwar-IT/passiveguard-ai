"""
PassiveGuard AI — Synthetic Fixture Dataset Adapter (Module 16)

Provides a controlled, reproducible synthetic dataset fixture for ML pipeline verification
when real local dataset CSV files are unavailable.
Interleaves BENIGN and DDOS records across temporal sequence so time-aware splits
naturally contain both classes in train, validation, and test partitions.
"""
import os
import logging
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

from app.ml.datasets.base import BaseDatasetAdapter, PASSIVEGUARD_FEATURE_SCHEMA

logger = logging.getLogger(__name__)


class SyntheticFixtureAdapter(BaseDatasetAdapter):
    """
    Adapter for generating synthetic training/evaluation benchmark fixtures or loading generic CSVs.
    """

    def __init__(self, data_dir: Optional[str] = None, n_samples: int = 1000, random_seed: int = 42):
        super().__init__(data_dir=data_dir or "./data/processed")
        self.n_samples = n_samples
        self.random_seed = random_seed

    @property
    def dataset_name(self) -> str:
        return "synthetic_fixture"

    @property
    def dataset_version(self) -> str:
        return "v1.0-benchmark"

    @property
    def source_description(self) -> str:
        return "Controlled Offline Synthetic Benchmark Fixture"

    def discover_local_files(self) -> List[str]:
        if self.data_dir and os.path.exists(self.data_dir) and self.data_dir.endswith(".csv"):
            return [self.data_dir]
        return ["synthetic_in_memory_fixture"]

    def load(self, file_path: Optional[str] = None) -> pd.DataFrame:
        """Loads generic CSV if specified or generates synthetic DataFrame."""
        target = file_path or self.data_dir
        if target and os.path.exists(target) and target.endswith(".csv"):
            logger.info(f"Loading custom CSV file: {target}")
            df = pd.read_csv(target)
            df.columns = [c.strip().lower() for c in df.columns]
            return df

        np.random.seed(self.random_seed)
        records = []

        # Interleave BENIGN and DDOS records so time-aware splits contain both classes in all splits
        for i in range(self.n_samples // 2):
            # 1. BENIGN sample
            dur_b = np.random.uniform(0.1, 10.0)
            pkt_cnt_b = np.random.randint(5, 200)
            byte_cnt_b = int(pkt_cnt_b * np.random.uniform(60, 1200))
            pkt_rate_b = round(pkt_cnt_b / dur_b, 2)
            byte_rate_b = round(byte_cnt_b / dur_b, 2)
            syn_c_b = np.random.randint(0, 5)
            ack_c_b = np.random.randint(5, 100)
            syn_ack_r_b = round(syn_c_b / max(ack_c_b, 1), 4)

            records.append({
                "flow_duration": dur_b,
                "flow_packet_count": pkt_cnt_b,
                "flow_byte_count": byte_cnt_b,
                "flow_packets_per_sec": pkt_rate_b,
                "flow_bytes_per_sec": byte_rate_b,
                "tcp_syn_count": syn_c_b,
                "tcp_ack_count": ack_c_b,
                "tcp_syn_ack_ratio": syn_ack_r_b,
                "directional_byte_ratio": np.random.uniform(0.3, 0.7),
                "directional_packet_ratio": np.random.uniform(0.3, 0.7),
                "packet_size_mean": np.random.uniform(100.0, 800.0),
                "packet_size_std": np.random.uniform(10.0, 150.0),
                "label": "BENIGN"
            })

            # 2. DDOS sample
            dur_d = np.random.uniform(0.01, 1.0)
            pkt_cnt_d = np.random.randint(500, 10000)
            byte_cnt_d = int(pkt_cnt_d * np.random.uniform(60, 1200))
            pkt_rate_d = round(pkt_cnt_d / dur_d, 2)
            byte_rate_d = round(byte_cnt_d / dur_d, 2)
            syn_c_d = np.random.randint(500, 10000)
            ack_c_d = np.random.randint(0, 20)
            syn_ack_r_d = round(syn_c_d / max(ack_c_d, 1), 4)

            records.append({
                "flow_duration": dur_d,
                "flow_packet_count": pkt_cnt_d,
                "flow_byte_count": byte_cnt_d,
                "flow_packets_per_sec": pkt_rate_d,
                "flow_bytes_per_sec": byte_rate_d,
                "tcp_syn_count": syn_c_d,
                "tcp_ack_count": ack_c_d,
                "tcp_syn_ack_ratio": syn_ack_r_d,
                "directional_byte_ratio": np.random.uniform(0.85, 1.0),
                "directional_packet_ratio": np.random.uniform(0.85, 1.0),
                "packet_size_mean": np.random.uniform(60.0, 120.0),
                "packet_size_std": np.random.uniform(1.0, 15.0),
                "label": "DDOS"
            })

        return pd.DataFrame(records)

    def map_labels(self, df: pd.DataFrame, target_threat_class: str = "DDOS") -> Tuple[pd.DataFrame, Dict[str, int]]:
        df = df.copy()
        label_col = "label" if "label" in df.columns else df.columns[-1]

        def mapper(lbl):
            sl = str(lbl).strip().upper()
            if sl in ["BENIGN", "0", "NORMAL"]:
                return "BENIGN"
            else:
                return target_threat_class

        df["mapped_label"] = df[label_col].apply(mapper)
        counts = df["mapped_label"].value_counts().to_dict()
        return df, counts

    def map_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        availability = {}
        df_mapped = pd.DataFrame(index=df.index)
        for col in PASSIVEGUARD_FEATURE_SCHEMA:
            if col in df.columns:
                df_mapped[col] = pd.to_numeric(df[col], errors="coerce")
                availability[col] = "DIRECTLY AVAILABLE"
            else:
                df_mapped[col] = 0.0
                availability[col] = "NOT AVAILABLE"

        if "mapped_label" in df.columns:
            df_mapped["mapped_label"] = df["mapped_label"]

        df_cleaned = self.clean_dataframe(df_mapped, PASSIVEGUARD_FEATURE_SCHEMA)
        return df_cleaned, availability
