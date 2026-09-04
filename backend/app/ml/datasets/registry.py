"""
PassiveGuard AI — Central Dataset Adapter Registry (Module 16)

Provides unified discovery and instantiation of cybersecurity dataset adapters.
Does NOT execute automatic Internet downloads.
"""
import os
import logging
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field

from app.ml.datasets.base import BaseDatasetAdapter, PASSIVEGUARD_FEATURE_SCHEMA
from app.ml.datasets.unsw_nb15 import UNSWNB15Adapter
from app.ml.datasets.cse_cic_ids2018 import CSECICIDS2018Adapter
from app.ml.datasets.synthetic_fixture import SyntheticFixtureAdapter

logger = logging.getLogger(__name__)


class DatasetMetadata(BaseModel):
    """
    Schema for documenting dataset provenance, features, labels, and PassiveGuard threat mappings.
    """
    name: str = Field(..., description="Unique dataset identifier")
    source: str = Field(..., description="Official dataset source or academic reference")
    version: str = Field(default="1.0", description="Dataset version or release year")
    available_labels: List[str] = Field(default_factory=list, description="Raw label categories in dataset")
    available_features: List[str] = Field(default_factory=list, description="Raw feature columns in dataset")
    supported_threat_classes: List[str] = Field(default_factory=list, description="PassiveGuard threat classes genuinely supported")
    limitations: str = Field(..., description="Documented limitations, missing classes, or synthetic constraints")


class DatasetAdapterRegistry:
    """
    Central registry for dataset adapters and metadata documentation.
    """

    _ADAPTERS: Dict[str, Type[BaseDatasetAdapter]] = {
        "unsw_nb15": UNSWNB15Adapter,
        "unsw-nb15": UNSWNB15Adapter,
        "unsw": UNSWNB15Adapter,
        "cse_cic_ids2018": CSECICIDS2018Adapter,
        "cse-cic-ids2018": CSECICIDS2018Adapter,
        "cic_ids2018": CSECICIDS2018Adapter,
        "cic2018": CSECICIDS2018Adapter,
        "synthetic": SyntheticFixtureAdapter,
        "synthetic_fixture": SyntheticFixtureAdapter,
        "demo": SyntheticFixtureAdapter
    }

    _REGISTRY: Dict[str, DatasetMetadata] = {
        "UNSW-NB15": DatasetMetadata(
            name="UNSW-NB15",
            source="Australian Centre for Cyber Security (ACCS), 2015",
            version="2015",
            available_labels=["Normal", "DoS", "Reconnaissance", "Exploits", "Fuzzers", "Generic", "Analysis", "Backdoors", "Shellcode", "Worms"],
            available_features=[
                "dur", "proto", "service", "state", "spkts", "dpkts", "sbytes", "dbytes",
                "rate", "sttl", "dttl", "sload", "dload", "sloss", "dloss", "sinpkt", "dinpkt", "sjit", "djit"
            ],
            supported_threat_classes=["DDOS", "RECON_SCAN"],
            limitations="High DoS and Recon representation; lacks modern encrypted QUIC sessions, DGA strings, and DNS tunnel payloads."
        ),
        "CSE-CIC-IDS2018": DatasetMetadata(
            name="CSE-CIC-IDS2018",
            source="Communications Security Establishment (CSE) & Canadian Institute for Cybersecurity (CIC), 2018",
            version="2018",
            available_labels=["Benign", "DDoS attacks-LOIC-HTTP", "DDOS attack-HOIC", "DoS attacks-Hulk", "Bot", "Infiltration", "FTP-BruteForce", "SSH-Bruteforce"],
            available_features=[
                "Dst Port", "Protocol", "Flow Duration", "Tot Fwd Pkts", "Tot Bwd Pkts",
                "TotLen Fwd Pkts", "TotLen Bwd Pkts", "Fwd Pkt Len Max", "Fwd Pkt Len Min",
                "Flow Byts/s", "Flow Pkts/s", "Fwd IAT Mean", "Bwd IAT Mean"
            ],
            supported_threat_classes=["DDOS", "C2_BEACON", "RECON_SCAN"],
            limitations="Rich volumetric and botnet telemetry; limited DNS tunnel and DGA query string granularity."
        ),
        "CIC-DDoS2019": DatasetMetadata(
            name="CIC-DDoS2019",
            source="Canadian Institute for Cybersecurity (CIC), 2019",
            version="2019",
            available_labels=["Benign", "DNS", "LDAP", "MSSQL", "NTP", "NetBIOS", "SNMP", "SSDP", "UDP", "UDP-Lag", "WebDDoS", "SYN"],
            available_features=[
                "Flow ID", "Source IP", "Source Port", "Destination IP", "Destination Port",
                "Protocol", "Timestamp", "Flow Duration", "Total Fwd Packets", "Total Backward Packets"
            ],
            supported_threat_classes=["DDOS"],
            limitations="Specialized volumetric DDoS and reflection amplification dataset; contains zero C2 or Exfiltration events."
        ),
        "CTU-13": DatasetMetadata(
            name="CTU-13",
            source="CTU University, Czech Republic, 2011",
            version="2011",
            available_labels=["Botnet", "Normal", "Background"],
            available_features=["StartTime", "Dur", "Proto", "SrcAddr", "Sport", "Dir", "DstAddr", "Dport", "State", "sTotBytes", "dTotBytes"],
            supported_threat_classes=["C2_BEACON"],
            limitations="Real botnet C2 capture dataset; labels focus primarily on botnet C2 channels."
        ),
        "DGA-Dataset-2020": DatasetMetadata(
            name="DGA-Dataset-2020",
            source="Academic DNS Threat Corpus, 2020",
            version="2020",
            available_labels=["alexa_legit", "dga_conficker", "dga_zeus", "dga_necurs", "dga_cryptolocker"],
            available_features=["domain", "length", "entropy", "consonant_ratio", "digit_ratio"],
            supported_threat_classes=["DGA_DOMAIN", "DNS_TUNNEL"],
            limitations="Lexical domain query string dataset; lacks transport layer packet timing metrics."
        )
    }

    @classmethod
    def get_adapter(cls, dataset_name: str, data_dir: Optional[str] = None) -> BaseDatasetAdapter:
        """
        Retrieves an adapter instance for a given dataset name or alias.
        """
        key = dataset_name.strip().lower()
        adapter_cls = cls._ADAPTERS.get(key)
        if not adapter_cls:
            if os.path.exists(dataset_name) or dataset_name.endswith(".csv"):
                return SyntheticFixtureAdapter(data_dir=dataset_name)
            raise KeyError(f"Unsupported dataset '{dataset_name}'. Supported options: {list(cls._ADAPTERS.keys())}")
        return adapter_cls(data_dir=data_dir)

    @classmethod
    def list_adapters(cls) -> List[str]:
        """Returns unique list of supported dataset adapter names."""
        return ["UNSW-NB15", "CSE-CIC-IDS2018", "synthetic"]

    @classmethod
    def get_dataset(cls, name: str) -> Optional[DatasetMetadata]:
        """Retrieves dataset metadata by name."""
        return cls._REGISTRY.get(name) or cls._REGISTRY.get(name.upper())

    @classmethod
    def list_datasets(cls) -> List[DatasetMetadata]:
        """Returns metadata for all registered datasets."""
        return list(cls._REGISTRY.values())


# Backwards compatibility alias
DatasetRegistry = DatasetAdapterRegistry
dataset_registry = DatasetAdapterRegistry()
