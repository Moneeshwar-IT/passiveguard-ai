"""
PassiveGuard AI — UNSW-NB15 Dataset Adapter (Module 16)

STRICT PASSIVE CONSTRAINT:
Operates strictly on LOCAL files under data/raw/unsw_nb15/.
Zero automatic Internet downloading. Maps UNSW-NB15 features and attack categories
defensibly into the PassiveGuard feature schema and DDoS target classes.
Excludes metadata CSVs (e.g., UNSW-NB15_features.csv, NUSW-NB15_features.csv) from traffic concatenation.
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
DEFAULT_UNSW_DIR = os.path.join(PROJECT_ROOT, "data", "raw", "unsw_nb15")

METADATA_FILENAME_KEYWORDS = [
    "features", "feature", "metadata", "list", "description", "events", "names"
]

UNSW_RAW_49_COLUMNS = [
    "srcip", "sport", "dstip", "dsport", "proto", "state", "dur", "sbytes", "dbytes",
    "sttl", "dttl", "sloss", "dloss", "service", "sload", "dload", "spkts", "dpkts",
    "swin", "dwin", "stcpb", "dtcpb", "smeansz", "dmeansz", "trans_depth", "res_bdy_len",
    "sjit", "djit", "stime", "ltime", "sintpkt", "dintpkt", "tcprtt", "synack", "ackdat",
    "is_sm_ips_ports", "ct_state_ttl", "ct_flw_http_mthd", "is_ftp_login", "ct_ftp_cmd",
    "ct_srv_src", "ct_srv_dst", "ct_dst_ltm", "ct_src_ltm", "ct_src_dport_ltm",
    "ct_dst_sport_ltm", "ct_dst_src_ltm", "attack_cat", "label"
]


class UNSWNB15Adapter(BaseDatasetAdapter):
    """
    Adapter for the UNSW-NB15 cybersecurity dataset.
    """

    def __init__(self, data_dir: Optional[str] = None):
        super().__init__(data_dir=data_dir or DEFAULT_UNSW_DIR)

    @property
    def dataset_name(self) -> str:
        return "UNSW-NB15"

    @property
    def dataset_version(self) -> str:
        return "2015"

    @property
    def source_description(self) -> str:
        return "Australian Centre for Cyber Security (ACCS), 2015"

    @property
    def has_predefined_splits(self) -> bool:
        """Returns True if both UNSW_NB15_training-set.csv and UNSW_NB15_testing-set.csv exist."""
        if not self.data_dir or not os.path.exists(self.data_dir) or os.path.isfile(self.data_dir):
            return False
        files = self.discover_local_files()
        train_files = [f for f in files if "training-set" in os.path.basename(f).lower()]
        test_files = [f for f in files if "testing-set" in os.path.basename(f).lower()]
        return len(train_files) > 0 and len(test_files) > 0

    def load_splits(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Loads predefined official UNSW-NB15 training and testing DataFrames separately.
        UNSW_NB15_training-set.csv -> train_df
        UNSW_NB15_testing-set.csv -> test_df
        """
        files = self.discover_local_files()
        train_files = [f for f in files if "training-set" in os.path.basename(f).lower()]
        test_files = [f for f in files if "testing-set" in os.path.basename(f).lower()]

        if not train_files or not test_files:
            raise FileNotFoundError("UNSW-NB15 predefined training-set.csv and testing-set.csv files not found.")

        logger.info(f"Loading predefined UNSW-NB15 training partition: {os.path.basename(train_files[0])}")
        df_train = self._read_csv_robust(train_files[0])

        logger.info(f"Loading predefined UNSW-NB15 testing partition: {os.path.basename(test_files[0])}")
        df_test = self._read_csv_robust(test_files[0])

        df_train.columns = [str(c).strip().lower() for c in df_train.columns]
        df_test.columns = [str(c).strip().lower() for c in df_test.columns]

        return df_train, df_test

    def is_metadata_file(self, filename_or_path: str) -> bool:
        """Returns True if file is dataset metadata/documentation rather than traffic data."""
        base = os.path.basename(filename_or_path).lower()
        return any(kw in base for kw in METADATA_FILENAME_KEYWORDS)

    def discover_local_files(self) -> List[str]:
        """
        Discovers traffic CSV files in local UNSW-NB15 directory deterministically.
        Explicitly excludes feature metadata CSV files (e.g. UNSW-NB15_features.csv, NUSW-NB15_features.csv).
        """
        if not os.path.exists(self.data_dir):
            return []

        # If data_dir is directly a single file path
        if os.path.isfile(self.data_dir):
            if self.is_metadata_file(self.data_dir):
                raise ValueError(
                    f"Specified file '{self.data_dir}' is dataset metadata, not traffic data. "
                    "Metadata CSV files cannot be loaded as traffic training/testing datasets."
                )
            return [self.data_dir]

        # Search for CSV files in directory
        all_csvs = glob.glob(os.path.join(self.data_dir, "*.csv")) + glob.glob(os.path.join(self.data_dir, "**", "*.csv"), recursive=True)
        all_csvs = sorted(list(set(all_csvs)))

        # Filter out metadata files
        traffic_csvs = [f for f in all_csvs if not self.is_metadata_file(f)]

        if not traffic_csvs:
            return []

        # Prioritize standard UNSW-NB15 partition sets
        train_test_set = [f for f in traffic_csvs if "training-set" in os.path.basename(f).lower() or "testing-set" in os.path.basename(f).lower()]
        if train_test_set:
            # Deterministic sorting: training-set first, testing-set second
            train_test_set.sort(key=lambda x: (0 if "training-set" in os.path.basename(x).lower() else 1, os.path.basename(x)))
            return train_test_set

        raw_4_set = [f for f in traffic_csvs if any(f"unsw-nb15_{i}" in os.path.basename(f).lower() or f"unsw_nb15_{i}" in os.path.basename(f).lower() for i in range(1, 5))]
        if raw_4_set:
            raw_4_set.sort(key=lambda x: os.path.basename(x))
            return raw_4_set

        return traffic_csvs

    def _read_csv_robust(self, file_path: str) -> pd.DataFrame:
        """
        Reads CSV file with robust encoding fallback (utf-8 -> utf-8-sig -> cp1252 -> latin-1).
        Logs the encoding successfully used.
        """
        encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1"]
        last_err: Optional[Exception] = None

        for enc in encodings:
            try:
                df = pd.read_csv(file_path, encoding=enc, low_memory=False)
                logger.info(f"Successfully loaded UNSW-NB15 file '{os.path.basename(file_path)}' using encoding '{enc}'.")
                return df
            except (UnicodeDecodeError, UnicodeError) as e:
                logger.debug(f"Encoding '{enc}' failed for '{os.path.basename(file_path)}': {e}. Trying fallback...")
                last_err = e
                continue

        raise UnicodeError(f"Could not decode UNSW-NB15 file '{file_path}' using encodings {encodings}. Last error: {last_err}")

    def load(self, file_path: Optional[str] = None) -> pd.DataFrame:
        """
        Loads dataset CSV into DataFrame using explicit file discovery and robust encoding fallback.
        """
        if file_path:
            if self.is_metadata_file(file_path):
                raise ValueError(f"File '{file_path}' is dataset metadata, not traffic data.")
            target_files = [file_path]
        else:
            target_files = self.discover_local_files()

        if not target_files or not os.path.exists(target_files[0]):
            discovered_all = glob.glob(os.path.join(self.data_dir, "*.csv")) if os.path.exists(self.data_dir) else []
            discovered_names = [os.path.basename(f) for f in discovered_all]
            expected_files = ["UNSW_NB15_training-set.csv", "UNSW_NB15_testing-set.csv"]
            missing_files = [f for f in expected_files if f not in discovered_names]

            raise FileNotFoundError(
                f"No valid UNSW-NB15 traffic CSV files found in '{self.data_dir}'.\n"
                f"  Expected Filenames:       {expected_files} (or UNSW-NB15_1.csv..4.csv)\n"
                f"  Discovered CSV Filenames: {discovered_names}\n"
                f"  Missing Required Files:   {missing_files}\n"
                "Place UNSW_NB15_training-set.csv and UNSW_NB15_testing-set.csv under data/raw/unsw_nb15/."
            )

        dfs = []
        for f in target_files:
            df_part = self._read_csv_robust(f)

            # Header handling for raw 49-column files without headers
            if len(df_part.columns) == 49 and not any(c in df_part.columns for c in ["dur", "spkts", "sbytes", "attack_cat", "label"]):
                df_part.columns = UNSW_RAW_49_COLUMNS

            dfs.append(df_part)

        df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
        # Normalize column headers
        df.columns = [str(c).strip().lower() for c in df.columns]
        return df

    def map_labels(self, df: pd.DataFrame, target_threat_class: str = "DDOS") -> Tuple[pd.DataFrame, Dict[str, int]]:
        """
        Maps UNSW-NB15 attack categories to BENIGN, target_threat_class (DDOS or RECON_SCAN), or EXCLUDED.
        UNSW-NB15 attack_cat taxonomy:
        - 'Normal' -> BENIGN
        - 'DoS' -> DDOS (when target_threat_class is DDOS/DOS)
        - 'Reconnaissance' -> RECON_SCAN (when target_threat_class is RECON_SCAN/RECON)
        - Other categories -> EXCLUDED
        """
        df = df.copy()
        target_norm = target_threat_class.upper().strip()

        label_counts: Dict[str, int] = {"BENIGN": 0, target_norm: 0, "EXCLUDED": 0}

        # Check for attack_cat column
        if "attack_cat" in df.columns:
            df["attack_cat_norm"] = df["attack_cat"].astype(str).str.strip().str.lower()
            
            def mapper(cat: str):
                if cat in ["normal", "nan", "none", "", "0"]:
                    return "BENIGN"
                elif target_norm in ["RECON_SCAN", "RECON"] and "recon" in cat:
                    return target_norm
                elif target_norm in ["DDOS", "DOS"] and ("dos" in cat or "ddos" in cat):
                    return target_norm
                else:
                    return "EXCLUDED"

            df["mapped_label"] = df["attack_cat_norm"].apply(mapper)
        elif "label" in df.columns:
            def mapper_num(lbl):
                try:
                    val = int(lbl)
                    return target_norm if val == 1 else "BENIGN"
                except Exception:
                    return "BENIGN"

            df["mapped_label"] = df["label"].apply(mapper_num)
        else:
            raise KeyError("UNSW-NB15 DataFrame missing both 'attack_cat' and 'label' columns.")

        # Compute label breakdown
        counts = df["mapped_label"].value_counts().to_dict()
        label_counts.update(counts)

        # Filter out EXCLUDED rows
        df_filtered = df[df["mapped_label"] != "EXCLUDED"].copy()
        logger.info(f"UNSW-NB15 Label Breakdown: BENIGN={label_counts.get('BENIGN', 0)}, {target_norm}={label_counts.get(target_norm, 0)}, EXCLUDED={label_counts.get('EXCLUDED', 0)}")
        return df_filtered, label_counts

    def map_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """
        Maps UNSW-NB15 columns into PassiveGuard feature schema.
        """
        df_mapped = pd.DataFrame(index=df.index)
        availability: Dict[str, str] = {}

        # 1. flow_duration (dur)
        if "dur" in df.columns:
            df_mapped["flow_duration"] = pd.to_numeric(df["dur"], errors="coerce").fillna(0.0)
            availability["flow_duration"] = "DIRECTLY AVAILABLE"
        else:
            df_mapped["flow_duration"] = 1.0
            availability["flow_duration"] = "NOT AVAILABLE"

        # 2. flow_packet_count (spkts + dpkts)
        spkts = pd.to_numeric(df.get("spkts", 0), errors="coerce").fillna(0)
        dpkts = pd.to_numeric(df.get("dpkts", 0), errors="coerce").fillna(0)
        df_mapped["flow_packet_count"] = spkts + dpkts
        availability["flow_packet_count"] = "DERIVABLE" if ("spkts" in df.columns or "dpkts" in df.columns) else "NOT AVAILABLE"

        # 3. flow_byte_count (sbytes + dbytes)
        sbytes = pd.to_numeric(df.get("sbytes", 0), errors="coerce").fillna(0)
        dbytes = pd.to_numeric(df.get("dbytes", 0), errors="coerce").fillna(0)
        df_mapped["flow_byte_count"] = sbytes + dbytes
        availability["flow_byte_count"] = "DERIVABLE" if ("sbytes" in df.columns or "dbytes" in df.columns) else "NOT AVAILABLE"

        # 4. flow_packets_per_sec (rate)
        if "rate" in df.columns:
            df_mapped["flow_packets_per_sec"] = pd.to_numeric(df["rate"], errors="coerce").fillna(0.0)
            availability["flow_packets_per_sec"] = "DIRECTLY AVAILABLE"
        else:
            dur = np.maximum(df_mapped["flow_duration"], 0.001)
            df_mapped["flow_packets_per_sec"] = df_mapped["flow_packet_count"] / dur
            availability["flow_packets_per_sec"] = "DERIVABLE"

        # 5. flow_bytes_per_sec
        if "sload" in df.columns and "dload" in df.columns:
            df_mapped["flow_bytes_per_sec"] = (pd.to_numeric(df["sload"], errors="coerce").fillna(0) + pd.to_numeric(df["dload"], errors="coerce").fillna(0)) / 8.0
            availability["flow_bytes_per_sec"] = "DERIVABLE"
        else:
            dur = np.maximum(df_mapped["flow_duration"], 0.001)
            df_mapped["flow_bytes_per_sec"] = df_mapped["flow_byte_count"] / dur
            availability["flow_bytes_per_sec"] = "DERIVABLE"

        # 6. tcp_syn_count (synack or tcprtt)
        if "synack" in df.columns:
            df_mapped["tcp_syn_count"] = (pd.to_numeric(df["synack"], errors="coerce").fillna(0) * 10.0).astype(int)
            availability["tcp_syn_count"] = "DERIVABLE"
        elif "tcprtt" in df.columns:
            df_mapped["tcp_syn_count"] = (pd.to_numeric(df["tcprtt"], errors="coerce").fillna(0) * 10.0).astype(int)
            availability["tcp_syn_count"] = "DERIVABLE"
        else:
            df_mapped["tcp_syn_count"] = 0
            availability["tcp_syn_count"] = "NOT AVAILABLE"

        # 7. tcp_ack_count (ackdat)
        if "ackdat" in df.columns:
            df_mapped["tcp_ack_count"] = (pd.to_numeric(df["ackdat"], errors="coerce").fillna(0) * 10.0).astype(int)
            availability["tcp_ack_count"] = "DERIVABLE"
        else:
            df_mapped["tcp_ack_count"] = 0
            availability["tcp_ack_count"] = "NOT AVAILABLE"

        # 8. tcp_syn_ack_ratio
        syn_c = df_mapped["tcp_syn_count"]
        ack_c = df_mapped["tcp_ack_count"]
        df_mapped["tcp_syn_ack_ratio"] = syn_c / np.maximum(ack_c, 1)
        availability["tcp_syn_ack_ratio"] = "DERIVABLE"

        # 9. directional_byte_ratio (sbytes / max(sbytes + dbytes, 1))
        total_bytes = np.maximum(sbytes + dbytes, 1)
        df_mapped["directional_byte_ratio"] = sbytes / total_bytes
        availability["directional_byte_ratio"] = "DERIVABLE"

        # 10. directional_packet_ratio (spkts / max(spkts + dpkts, 1))
        total_pkts = np.maximum(spkts + dpkts, 1)
        df_mapped["directional_packet_ratio"] = spkts / total_pkts
        availability["directional_packet_ratio"] = "DERIVABLE"

        # 11. packet_size_mean ((sbytes + dbytes) / max(spkts + dpkts, 1))
        df_mapped["packet_size_mean"] = (sbytes + dbytes) / total_pkts
        availability["packet_size_mean"] = "DERIVABLE"

        # 12. packet_size_std (sjit + djit or derived)
        if "sjit" in df.columns and "djit" in df.columns:
            sjit = pd.to_numeric(df["sjit"], errors="coerce").fillna(0)
            djit = pd.to_numeric(df["djit"], errors="coerce").fillna(0)
            df_mapped["packet_size_std"] = (sjit + djit) / 2.0
            availability["packet_size_std"] = "DERIVABLE"
        else:
            df_mapped["packet_size_std"] = 0.0
            availability["packet_size_std"] = "NOT AVAILABLE"

        # Copy target mapped label if present
        if "mapped_label" in df.columns:
            df_mapped["mapped_label"] = df["mapped_label"]

        df_cleaned = self.clean_dataframe(df_mapped, PASSIVEGUARD_FEATURE_SCHEMA)
        return df_cleaned, availability
