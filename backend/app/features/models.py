"""
PassiveGuard AI — Feature Vector Model (Module 2)

STRICT PASSIVE CONSTRAINT:
The FeatureVector represents extracted numerical and categorical features
derived purely from observed traffic metadata. Explicit missing values (None) are used
when protocol metadata (DNS, TLS) is unavailable. Threat outcomes or calibrated probabilities
are NEVER fabricated at the feature layer.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class FeatureVector(BaseModel):
    """
    Standardized, ML-ready feature vector representation for a single network flow or session.
    """
    # Identifiers & Metadata
    flow_id: str = Field(..., description="Unique flow identifier")
    timestamp: float = Field(..., description="Flow start epoch timestamp in seconds")
    protocol: str = Field(..., description="Transport layer protocol (TCP, UDP, ICMP)")

    # Basic Flow Features
    flow_packet_count: int = Field(..., ge=0, description="Total packet count in flow")
    flow_byte_count: int = Field(..., ge=0, description="Total byte volume in flow")
    flow_duration: float = Field(..., ge=0.0, description="Flow duration in seconds")
    flow_packets_per_sec: float = Field(..., ge=0.0, description="Packets per second rate")
    flow_bytes_per_sec: float = Field(..., ge=0.0, description="Bytes per second rate")

    # Packet Size Statistics
    flow_mean_packet_size: float = Field(default=0.0, ge=0.0, description="Mean packet payload/header length")
    flow_min_packet_size: int = Field(default=0, ge=0, description="Minimum packet length")
    flow_max_packet_size: int = Field(default=0, ge=0, description="Maximum packet length")
    flow_std_packet_size: float = Field(default=0.0, ge=0.0, description="Standard deviation of packet length")

    # TCP Flag Metrics
    tcp_syn_count: int = Field(default=0, ge=0, description="Count of SYN flags")
    tcp_syn_ack_count: int = Field(default=0, ge=0, description="Count of SYN-ACK flags")
    tcp_ack_count: int = Field(default=0, ge=0, description="Count of ACK flags")
    tcp_fin_count: int = Field(default=0, ge=0, description="Count of FIN flags")
    tcp_rst_count: int = Field(default=0, ge=0, description="Count of RST flags")
    tcp_psh_count: int = Field(default=0, ge=0, description="Count of PSH flags")

    # Directional Features
    direction_src_to_dst_packets: int = Field(default=0, ge=0, description="Packets sent from source to destination")
    direction_dst_to_src_packets: int = Field(default=0, ge=0, description="Packets sent from destination to source")
    direction_src_to_dst_bytes: int = Field(default=0, ge=0, description="Bytes sent from source to destination")
    direction_dst_to_src_bytes: int = Field(default=0, ge=0, description="Bytes sent from destination to source")
    directional_packet_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of outbound to total packets")
    directional_byte_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of outbound to total bytes")

    # DNS Features (Nullable / Optional)
    dns_query_length: Optional[int] = Field(default=None, description="DNS domain query character length")
    dns_label_count: Optional[int] = Field(default=None, description="Count of labels in domain query (dot-separated)")
    dns_max_label_length: Optional[int] = Field(default=None, description="Length of longest domain label")
    dns_digit_ratio: Optional[float] = Field(default=None, description="Ratio of numeric digits in domain query")
    dns_alpha_ratio: Optional[float] = Field(default=None, description="Ratio of alphabetic characters in domain query")
    dns_unique_character_ratio: Optional[float] = Field(default=None, description="Ratio of unique characters to total query length")
    dns_entropy: Optional[float] = Field(default=None, description="Shannon entropy H(X) of domain query string")
    dns_query_frequency: Optional[float] = Field(default=None, description="Query frequency rate per minute")
    dns_unique_query_count: Optional[int] = Field(default=None, description="Number of unique domain queries from host")
    dns_nxdomain_ratio: Optional[float] = Field(default=None, description="Ratio of NXDOMAIN responses")
    dns_ngrams_top_freq: Optional[Dict[str, float]] = Field(default=None, description="Top character n-gram distribution")

    # TLS / QUIC Metadata Features (Nullable / Optional, Metadata-only, NO DECRYPTION)
    tls_version: Optional[str] = Field(default=None, description="Observed unencrypted TLS protocol version")
    tls_cipher: Optional[str] = Field(default=None, description="Selected/offered cipher suite name or ID")
    tls_ja3: Optional[str] = Field(default=None, description="JA3 passive client handshake fingerprint hash")
    tls_ja3s: Optional[str] = Field(default=None, description="JA3S passive server response fingerprint hash")
    tls_ja4: Optional[str] = Field(default=None, description="JA4 passive network fingerprint string")
    tls_handshake_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Unencrypted Client Hello metadata")
    tls_packet_count: Optional[int] = Field(default=None, description="TLS application data packet count")
    tls_byte_count: Optional[int] = Field(default=None, description="TLS application data byte count")
    tls_mean_packet_size: Optional[float] = Field(default=None, description="Mean TLS payload packet size")
    tls_std_packet_size: Optional[float] = Field(default=None, description="Standard deviation of TLS packet size")
    tls_mean_iat: Optional[float] = Field(default=None, description="Mean TLS packet inter-arrival time")
    tls_std_iat: Optional[float] = Field(default=None, description="Standard deviation of TLS packet IAT")

    # QUIC Metadata Features (Nullable / Optional, Metadata-only, NO DECRYPTION)
    quic_version: Optional[str] = Field(default=None, description="Observed unencrypted QUIC version string")
    quic_packet_count: Optional[int] = Field(default=None, description="QUIC packet count")
    quic_byte_count: Optional[int] = Field(default=None, description="QUIC byte count")
    quic_mean_packet_size: Optional[float] = Field(default=None, description="Mean QUIC packet payload size")
    quic_std_packet_size: Optional[float] = Field(default=None, description="Standard deviation of QUIC packet size")
    quic_mean_iat: Optional[float] = Field(default=None, description="Mean QUIC inter-arrival time")
    quic_std_iat: Optional[float] = Field(default=None, description="Standard deviation of QUIC IAT")

    # Temporal Features
    temporal_mean_iat: float = Field(default=0.0, ge=0.0, description="Mean packet inter-arrival time in seconds")
    temporal_std_iat: float = Field(default=0.0, ge=0.0, description="Standard deviation of inter-arrival time")
    temporal_min_iat: float = Field(default=0.0, ge=0.0, description="Minimum inter-arrival time")
    temporal_max_iat: float = Field(default=0.0, ge=0.0, description="Maximum inter-arrival time")
    temporal_cv_iat: float = Field(default=0.0, ge=0.0, description="Coefficient of Variation (std / mean)")
    temporal_burstiness: float = Field(default=0.0, description="Traffic burstiness index in [-1.0, 1.0]")
    temporal_periodicity: float = Field(default=0.0, ge=0.0, le=1.0, description="Beaconing periodicity score")
    temporal_event_frequency: float = Field(default=0.0, ge=0.0, description="Connection events per minute")
    temporal_recurrence_count: int = Field(default=0, ge=0, description="Number of recurring connections within state window")

    # Sliding-Window & Aggregation Features (Optional / Nullable)
    source_count: Optional[int] = Field(default=None, description="Number of unique active source IPs in window")
    destination_count: Optional[int] = Field(default=None, description="Number of unique target destination IPs in window")
    source_entropy: Optional[float] = Field(default=None, description="Normalized source IP entropy in window [0.0, 1.0]")
    destination_concentration: Optional[float] = Field(default=None, description="Destination traffic concentration index [0.0, 1.0]")
    short_flow_ratio: Optional[float] = Field(default=None, description="Ratio of short-lived flows (<1s) in window")

    model_config = ConfigDict(frozen=True)
