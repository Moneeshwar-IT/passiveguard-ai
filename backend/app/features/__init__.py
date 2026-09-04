"""
PassiveGuard AI — Feature Engine Package (Module 2)

Converts observed network flows (FlowRecord) and optional protocol metadata (DNS, TLS)
into a standardized numerical FeatureVector for AI detection models.
"""
from typing import Dict, List, Optional, Tuple, Any
from app.ingestion.models import FlowRecord
from app.features.models import FeatureVector
from app.features.flow_features import FlowFeatures, extract_flow_features
from app.features.dns_features import DNSFeatures, extract_dns_features, calculate_shannon_entropy, extract_ngrams
from app.features.tls_features import TLSFeatures, extract_tls_features
from app.features.temporal_features import TemporalFeatures, TemporalFeatureExtractor, extract_temporal_features, calculate_periodicity


class FeatureEngine:
    """
    Unified Feature Extraction Engine.
    
    Orchestrates flow, DNS, TLS metadata, and temporal feature computation
    to produce a standardized FeatureVector.
    """

    def __init__(self, temporal_extractor: Optional[TemporalFeatureExtractor] = None):
        self.temporal_extractor = temporal_extractor or TemporalFeatureExtractor()

    def create_feature_vector(
        self,
        flow: FlowRecord,
        packet_sizes: Optional[List[int]] = None,
        tcp_flags: Optional[Dict[str, int]] = None,
        direction_packets: Optional[Tuple[int, int]] = None,
        direction_bytes: Optional[Tuple[int, int]] = None,
        dns_domain: Optional[str] = None,
        dns_history: Optional[List[str]] = None,
        dns_nxdomain_count: int = 0,
        tls_handshake_meta: Optional[Dict[str, Any]] = None,
        packet_timestamps: Optional[List[float]] = None
    ) -> FeatureVector:
        """
        Calculates all feature sub-components and merges them into a unified FeatureVector.
        """
        # 1. Flow Features
        ff = extract_flow_features(
            flow=flow,
            packet_sizes=packet_sizes,
            tcp_flags=tcp_flags,
            direction_packets=direction_packets,
            direction_bytes=direction_bytes
        )

        # 2. DNS Features
        df = extract_dns_features(
            domain_name=dns_domain,
            query_history=dns_history,
            nxdomain_count=dns_nxdomain_count
        )

        # 3. TLS Features
        tf = extract_tls_features(
            flow=flow,
            tls_handshake_meta=tls_handshake_meta,
            packet_sizes=packet_sizes,
            timestamps=packet_timestamps
        )

        # 4. Temporal Features
        ts_list = packet_timestamps or [flow.timestamp, flow.timestamp + flow.duration]
        temp_f = self.temporal_extractor.extract_temporal_features(ts_list)

        return FeatureVector(
            flow_id=flow.flow_id,
            timestamp=flow.timestamp,
            protocol=flow.protocol,

            # Flow
            flow_packet_count=ff.flow_packet_count,
            flow_byte_count=ff.flow_byte_count,
            flow_duration=ff.flow_duration,
            flow_packets_per_sec=ff.flow_packets_per_sec,
            flow_bytes_per_sec=ff.flow_bytes_per_sec,
            flow_mean_packet_size=ff.flow_mean_packet_size,
            flow_min_packet_size=ff.flow_min_packet_size,
            flow_max_packet_size=ff.flow_max_packet_size,
            flow_std_packet_size=ff.flow_std_packet_size,
            tcp_syn_count=ff.tcp_syn_count,
            tcp_syn_ack_count=ff.tcp_syn_ack_count,
            tcp_ack_count=ff.tcp_ack_count,
            tcp_fin_count=ff.tcp_fin_count,
            tcp_rst_count=ff.tcp_rst_count,
            tcp_psh_count=ff.tcp_psh_count,
            direction_src_to_dst_packets=ff.direction_src_to_dst_packets,
            direction_dst_to_src_packets=ff.direction_dst_to_src_packets,
            direction_src_to_dst_bytes=ff.direction_src_to_dst_bytes,
            direction_dst_to_src_bytes=ff.direction_dst_to_src_bytes,
            directional_packet_ratio=ff.directional_packet_ratio,
            directional_byte_ratio=ff.directional_byte_ratio,

            # DNS
            dns_query_length=df.dns_query_length,
            dns_label_count=df.dns_label_count,
            dns_max_label_length=df.dns_max_label_length,
            dns_digit_ratio=df.dns_digit_ratio,
            dns_alpha_ratio=df.dns_alpha_ratio,
            dns_unique_character_ratio=df.dns_unique_character_ratio,
            dns_entropy=df.dns_entropy,
            dns_query_frequency=df.dns_query_frequency,
            dns_unique_query_count=df.dns_unique_query_count,
            dns_nxdomain_ratio=df.dns_nxdomain_ratio,
            dns_ngrams_top_freq=df.dns_ngrams_top_freq,

            # TLS
            tls_version=tf.tls_version,
            tls_cipher=tf.tls_cipher,
            tls_ja3=tf.tls_ja3,
            tls_ja3s=tf.tls_ja3s,
            tls_ja4=tf.tls_ja4,
            tls_handshake_metadata=tf.tls_handshake_metadata,
            tls_packet_count=tf.tls_packet_count,
            tls_byte_count=tf.tls_byte_count,
            tls_mean_packet_size=tf.tls_mean_packet_size,
            tls_std_packet_size=tf.tls_std_packet_size,
            tls_mean_iat=tf.tls_mean_iat,
            tls_std_iat=tf.tls_std_iat,

            # Temporal
            temporal_mean_iat=temp_f.temporal_mean_iat,
            temporal_std_iat=temp_f.temporal_std_iat,
            temporal_min_iat=temp_f.temporal_min_iat,
            temporal_max_iat=temp_f.temporal_max_iat,
            temporal_cv_iat=temp_f.temporal_cv_iat,
            temporal_burstiness=temp_f.temporal_burstiness,
            temporal_periodicity=temp_f.temporal_periodicity,
            temporal_event_frequency=temp_f.temporal_event_frequency,
            temporal_recurrence_count=temp_f.temporal_recurrence_count
        )


__all__ = [
    "FeatureVector",
    "FeatureEngine",
    "FlowFeatures",
    "extract_flow_features",
    "DNSFeatures",
    "extract_dns_features",
    "calculate_shannon_entropy",
    "extract_ngrams",
    "TLSFeatures",
    "extract_tls_features",
    "TemporalFeatures",
    "TemporalFeatureExtractor",
    "extract_temporal_features",
    "calculate_periodicity"
]
