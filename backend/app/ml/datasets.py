"""
PassiveGuard AI — Dataset Metadata Registry (Module 12)

STRICT PASSIVE & HONEST METRICS DIRECTIVE:
Documents public network security datasets and their defensible semantic mapping to PassiveGuard threat classes.
Under NO circumstances does it automatically download datasets on startup or claim a dataset supports a threat category
unless its labels and features genuinely support it.
"""
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


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


class DatasetRegistry:
    """
    Registry of evaluated cybersecurity datasets.
    """

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
    def list_datasets(cls) -> List[DatasetMetadata]:
        """Returns metadata for all registered datasets."""
        return list(cls._REGISTRY.values())

    @classmethod
    def get_dataset(cls, name: str) -> Optional[DatasetMetadata]:
        """Retrieves dataset metadata by name."""
        return cls._REGISTRY.get(name)
