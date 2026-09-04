"""
PassiveGuard AI — CSE-CIC-IDS2018 Dataset Adapter (Module 16)

STRICT PASSIVE CONSTRAINT:
Operates strictly on LOCAL files under data/raw/cse_cic_ids2018/.
Zero automatic Internet downloading. Maps CSE-CIC-IDS2018 flow metrics
defensibly into the PassiveGuard feature schema and DDoS target classes.
"""
import os
import glob
import logging
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

from app.ml.datasets.base import BaseDatasetAdapter, PASSIVEGUARD_FEATURE_SCHEMA

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DEFAULT_CIC_DIR = os.path.join(PROJECT_ROOT, "data", "raw", "cse_cic_ids2018")


class CSECICIDS2018Adapter(BaseDatasetAdapter):
    """
    Adapter for the CSE-CIC-IDS2018 cybersecurity dataset.
    """

    def __init__(self, data_dir: Optional[str] = None):
        super().__init__(data_dir=data_dir or DEFAULT_CIC_DIR)

    @property
    def dataset_name(self) -> str:
        return "CSE-CIC-IDS2018"

    @property
    def dataset_version(self) -> str:
        return "2018"

    @property
    def source_description(self) -> str:
        return "Communications Security Establishment (CSE) & Canadian Institute for Cybersecurity (CIC), 2018"

    def discover_local_files(self) -> List[str]:
        """Discovers CSV files in local CSE-CIC-IDS2018 directory."""
        if not os.path.exists(self.data_dir):
            return []
        files = glob.glob(os.path.join(self.data_dir, "*.csv")) + glob.glob(os.path.join(self.data_dir, "**", "*.csv"), recursive=True)
        return sorted(list(set(files)))

    def load(self, file_path: Optional[str] = None) -> pd.DataFrame:
        """Loads dataset CSV into DataFrame."""
        target_files = [file_path] if file_path else self.discover_local_files()
        if not target_files or not os.path.exists(target_files[0]):
            raise FileNotFoundError(f"No CSE-CIC-IDS2018 CSV files found in '{self.data_dir}'. Place CSE-CIC-IDS2018 dataset CSVs under data/raw/cse_cic_ids2018/")

        dfs = []
        for f in target_files:
            logger.info(f"Loading local CSE-CIC-IDS2018 file: {os.path.basename(f)}")
            df_part = pd.read_csv(f, low_memory=False)
            dfs.append(df_part)

        df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
        # Normalize column headers
        df.columns = [c.strip().lower() for c in df.columns]
        return df

    def map_labels(self, df: pd.DataFrame, target_threat_class: str = "DDOS") -> Tuple[pd.DataFrame, Dict[str, int]]:
        """
        Maps CSE-CIC-IDS2018 attack labels to BENIGN, target_threat_class (DDOS), or EXCLUDED.
        """
        df = df.copy()
        label_col = "label" if "label" in df.columns else df.columns[-1]

        label_counts: Dict[str, int] = {"BENIGN": 0, "DDOS": 0, "EXCLUDED": 0}

        df["raw_label_norm"] = df[label_col].astype(str).str.strip().str.lower()

        def mapper(lbl: str):
            if "benign" in lbl or lbl in ["0", "normal"]:
                return "BENIGN"
            elif any(k in lbl for k in ["ddos", "dos", "loic", "hoic", "hulk"]):
                return "DDOS"
            else:
                return "EXCLUDED"

        df["mapped_label"] = df["raw_label_norm"].apply(mapper)

        # Compute label breakdown
        counts = df["mapped_label"].value_counts().to_dict()
        label_counts.update(counts)

        # Filter out EXCLUDED rows
        df_filtered = df[df["mapped_label"] != "EXCLUDED"].copy()
        logger.info(f"CSE-CIC-IDS2018 Label Breakdown: BENIGN={label_counts.get('BENIGN', 0)}, DDOS={label_counts.get('DDOS', 0)}, EXCLUDED={label_counts.get('EXCLUDED', 0)}")
        return df_filtered, label_counts

    def map_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """
        Maps CSE-CIC-IDS2018 columns into PassiveGuard feature schema.
        """
        df_mapped = pd.DataFrame(index=df.index)
        availability: Dict[str, str] = {}

        # 1. flow_duration (flow duration in microseconds -> convert to seconds)
        if "flow duration" in df.columns:
            dur_raw = pd.to_numeric(df["flow duration"], errors="coerce").fillna(0.0)
            df_mapped["flow_duration"] = dur_raw / 1_000_000.0
            availability["flow_duration"] = "DERIVABLE"
        elif "dur" in df.columns:
            df_mapped["flow_duration"] = pd.to_numeric(df["dur"], errors="coerce").fillna(0.0)
            availability["flow_duration"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["flow_duration"] = 1.0
            availability["flow_duration"] = "NOT AVAILABLE"

        # 2. flow_packet_count (tot fwd pkts + tot bwd pkts)
        fwd_pkts = pd.to_numeric(df.get("tot fwd pkts", df.get("total fwd packets", 0)), errors="coerce").fillna(0)
        bwd_pkts = pd.to_numeric(df.get("tot bwd pkts", df.get("total backward packets", 0)), errors="coerce").fillna(0)
        df_mapped["flow_packet_count"] = fwd_pkts + bwd_pkts
        availability["flow_packet_count"] = "DERIVABLE"

        # 3. flow_byte_count (totlen fwd pkts + totlen bwd pkts)
        fwd_bytes = pd.to_numeric(df.get("totlen fwd pkts", df.get("fwd header length", 0)), errors="coerce").fillna(0)
        bwd_bytes = pd.to_numeric(df.get("totlen bwd pkts", df.get("bwd header length", 0)), errors="coerce").fillna(0)
        df_mapped["flow_byte_count"] = fwd_bytes + bwd_bytes
        availability["flow_byte_count"] = "DERIVABLE"

        # 4. flow_packets_per_sec (flow pkts/s)
        if "flow pkts/s" in df.columns:
            df_mapped["flow_packets_per_sec"] = pd.to_numeric(df["flow pkts/s"], errors="coerce").fillna(0.0)
            availability["flow_packets_per_sec"] = "DIRECTLY AVAILABLE"
        else:
            dur = np.maximum(df_mapped["flow_duration"], 0.001)
            df_mapped["flow_packets_per_sec"] = df_mapped["flow_packet_count"] / dur
            availability["flow_packets_per_sec"] = "DERIVABLE"

        # 5. flow_bytes_per_sec (flow byts/s)
        if "flow byts/s" in df.columns:
            df_mapped["flow_bytes_per_sec"] = pd.to_numeric(df["flow byts/s"], errors="coerce").fillna(0.0)
            availability["flow_bytes_per_sec"] = "DIRECTLY AVAILABLE"
        else:
            dur = np.maximum(df_mapped["flow_duration"], 0.001)
            df_mapped["flow_bytes_per_sec"] = df_mapped["flow_byte_count"] / dur
            availability["flow_bytes_per_sec"] = "DERIVABLE"

        # 6. tcp_syn_count (syn flag cnt)
        if "syn flag cnt" in df.columns:
            df_mapped["tcp_syn_count"] = pd.to_numeric(df["syn flag cnt"], errors="coerce").fillna(0).astype(int)
            availability["tcp_syn_count"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["tcp_syn_count"] = 0
            availability["tcp_syn_count"] = "NOT AVAILABLE"

        # 7. tcp_ack_count (ack flag cnt)
        if "ack flag cnt" in df.columns:
            df_mapped["tcp_ack_count"] = pd.to_numeric(df["ack flag cnt"], errors="coerce").fillna(0).astype(int)
            availability["tcp_ack_count"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["tcp_ack_count"] = 0
            availability["tcp_ack_count"] = "NOT AVAILABLE"

        # 8. tcp_syn_ack_ratio
        syn_c = df_mapped["tcp_syn_count"]
        ack_c = df_mapped["tcp_ack_count"]
        df_mapped["tcp_syn_ack_ratio"] = syn_c / np.maximum(ack_c, 1)
        availability["tcp_syn_ack_ratio"] = "DERIVABLE"

        # 9. directional_byte_ratio (totlen fwd pkts / max(totlen fwd pkts + totlen bwd pkts, 1))
        tot_bytes = np.maximum(fwd_bytes + bwd_bytes, 1)
        df_mapped["directional_byte_ratio"] = fwd_bytes / tot_bytes
        availability["directional_byte_ratio"] = "DERIVABLE"

        # 10. directional_packet_ratio (tot fwd pkts / max(tot fwd pkts + tot bwd pkts, 1))
        tot_pkts = np.maximum(fwd_pkts + bwd_pkts, 1)
        df_mapped["directional_packet_ratio"] = fwd_pkts / tot_pkts
        availability["directional_packet_ratio"] = "DERIVABLE"

        # 11. packet_size_mean (pkt len mean)
        if "pkt len mean" in df.columns:
            df_mapped["packet_size_mean"] = pd.to_numeric(df["pkt len mean"], errors="coerce").fillna(0.0)
            availability["packet_size_mean"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["packet_size_mean"] = (fwd_bytes + bwd_bytes) / tot_pkts
            availability["packet_size_mean"] = "DERIVABLE"

        # 12. packet_size_std (pkt len std)
        if "pkt len std" in df.columns:
            df_mapped["packet_size_std"] = pd.to_numeric(df["pkt len std"], errors="coerce").fillna(0.0)
            availability["packet_size_std"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["packet_size_std"] = 0.0
            availability["packet_size_std"] = "NOT AVAILABLE"

        # Copy target mapped label if present
        if "mapped_label" in df.columns:
            df_mapped["mapped_label"] = df["mapped_label"]

        df_cleaned = self.clean_dataframe(df_mapped, PASSIVEGUARD_FEATURE_SCHEMA)
        return df_cleaned, availability
