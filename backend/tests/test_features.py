import ast
import os
import math
import pytest
from app.ingestion.models import FlowRecord
from app.features.models import FeatureVector
from app.features.flow_features import extract_flow_features, FlowFeatures
from app.features.dns_features import extract_dns_features, calculate_shannon_entropy, extract_ngrams, DNSFeatures
from app.features.tls_features import extract_tls_features, TLSFeatures
from app.features.temporal_features import (
    extract_temporal_features,
    calculate_periodicity,
    TemporalFeatures,
    TemporalFeatureExtractor
)
from app.features import FeatureEngine


@pytest.fixture
def sample_flow():
    return FlowRecord(
        timestamp=1700000000.0,
        flow_id="FLOW-000001",
        src_ip="192.168.1.10",
        dst_ip="10.0.0.1",
        src_port=54321,
        dst_port=80,
        protocol="TCP",
        packet_count=10,
        byte_count=1000,
        duration=2.0
    )


# --- 1. FLOW FEATURES TESTS ---

def test_flow_features_basic(sample_flow):
    ff = extract_flow_features(sample_flow)
    assert isinstance(ff, FlowFeatures)
    assert ff.flow_packet_count == 10
    assert ff.flow_byte_count == 1000
    assert ff.flow_duration == 2.0
    assert ff.flow_packets_per_sec == 5.0
    assert ff.flow_bytes_per_sec == 500.0


def test_flow_features_packet_statistics(sample_flow):
    sizes = [60, 100, 200, 300, 340]
    ff = extract_flow_features(sample_flow, packet_sizes=sizes)
    assert ff.flow_min_packet_size == 60
    assert ff.flow_max_packet_size == 340
    assert ff.flow_mean_packet_size == 200.0
    assert ff.flow_std_packet_size > 0.0


def test_flow_features_tcp_flags(sample_flow):
    flags = {"SYN": 1, "ACK": 8, "FIN": 1, "RST": 0, "PSH": 2}
    ff = extract_flow_features(sample_flow, tcp_flags=flags)
    assert ff.tcp_syn_count == 1
    assert ff.tcp_ack_count == 8
    assert ff.tcp_fin_count == 1
    assert ff.tcp_psh_count == 2
    assert ff.tcp_rst_count == 0


def test_flow_features_directional(sample_flow):
    ff = extract_flow_features(
        sample_flow,
        direction_packets=(8, 2),
        direction_bytes=(900, 100)
    )
    assert ff.direction_src_to_dst_packets == 8
    assert ff.direction_dst_to_src_packets == 2
    assert ff.direction_src_to_dst_bytes == 900
    assert ff.direction_dst_to_src_bytes == 100
    assert ff.directional_packet_ratio == 0.8
    assert ff.directional_byte_ratio == 0.9


# --- 2. DNS FEATURES TESTS ---

def test_dns_entropy_edge_cases():
    assert calculate_shannon_entropy("") == 0.0
    assert calculate_shannon_entropy("a") == 0.0
    assert calculate_shannon_entropy("aaaaa") == 0.0


def test_dns_entropy_normal_vs_high():
    normal_ent = calculate_shannon_entropy("google.com")
    dga_ent = calculate_shannon_entropy("x8q1z9a7w2e.biz")
    
    assert 2.0 < normal_ent < 3.5
    assert dga_ent > 3.7
    assert dga_ent > normal_ent


def test_dns_features_extraction():
    df = extract_dns_features(domain_name="sub.testdomain123.com", nxdomain_count=1)
    assert df.dns_query_length == 21
    assert df.dns_label_count == 3
    assert df.dns_max_label_length == 13
    assert df.dns_digit_ratio > 0.0
    assert df.dns_alpha_ratio > 0.0
    assert df.dns_entropy > 0.0
    assert df.dns_ngrams_top_freq is not None


def test_dns_features_none():
    df = extract_dns_features(domain_name=None)
    assert df.dns_query_length is None
    assert df.dns_entropy is None


# --- 3. TLS FEATURES TESTS ---

def test_tls_features_metadata(sample_flow):
    meta = {
        "tls_version": "TLS 1.3",
        "cipher": "TLS_AES_256_GCM_SHA384",
        "ja3": "771,4865-4866-4867,0-23-65281,29-23-24,0",
        "ja4": "t13d151600_002f_0005"
    }
    tf = extract_tls_features(sample_flow, tls_handshake_meta=meta)
    assert tf.tls_version == "TLS 1.3"
    assert tf.tls_cipher == "TLS_AES_256_GCM_SHA384"
    assert tf.tls_ja3 is not None
    assert tf.tls_ja4 is not None


def test_tls_features_missing_metadata(sample_flow):
    tf = extract_tls_features(sample_flow, tls_handshake_meta=None)
    assert tf.tls_version is None
    assert tf.tls_cipher is None
    assert tf.tls_ja3 is None
    assert tf.tls_ja4 is None


def test_verify_no_tls_decryption_in_code():
    forbidden_calls = {"decrypt(", "ssl_decrypt(", "rsa_decrypt(", "aes_decrypt(", "private_key_file"}
    features_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "features"))
    py_files = [os.path.join(features_dir, f) for f in os.listdir(features_dir) if f.endswith(".py")]

    for filepath in py_files:
        with open(filepath, "r", encoding="utf-8") as f:
            code = f.read().lower()
        for forbidden in forbidden_calls:
            assert forbidden not in code, f"Forbidden active decryption call '{forbidden}' found in {filepath}"


# --- 4. TEMPORAL FEATURES TESTS ---

def test_temporal_periodic_vs_irregular():
    # Periodic timestamps (10s intervals)
    periodic_ts = [100.0, 110.0, 120.0, 130.0, 140.0]
    tf_periodic = extract_temporal_features(periodic_ts)
    
    # Irregular timestamps (2s, 17s, 4s, 31s)
    irregular_ts = [100.0, 102.0, 119.0, 123.0, 154.0]
    tf_irregular = extract_temporal_features(irregular_ts)

    assert tf_periodic.temporal_periodicity > 0.85
    assert tf_irregular.temporal_periodicity < 0.65
    assert tf_periodic.temporal_periodicity > tf_irregular.temporal_periodicity


def test_temporal_insufficient_events():
    tf = extract_temporal_features([100.0])
    assert tf.temporal_mean_iat == 0.0
    assert tf.temporal_periodicity == 0.0
    assert tf.temporal_recurrence_count == 1


def test_temporal_bounded_history_and_eviction():
    extractor = TemporalFeatureExtractor(max_history=5, state_timeout=1.0)
    
    for i in range(10):
        extractor.add_timestamp("host_1", float(i * 10))
    
    assert len(extractor._history["host_1"]) == 5
    assert extractor._history["host_1"] == [50.0, 60.0, 70.0, 80.0, 90.0]

    # Test stale eviction
    evicted_count = extractor.evict_stale_state(current_time=10000.0)
    assert evicted_count == 1
    assert "host_1" not in extractor._history


# --- 5. INTEGRATION TESTS ---

def test_feature_engine_integration(sample_flow):
    engine = FeatureEngine()
    fv = engine.create_feature_vector(
        flow=sample_flow,
        packet_sizes=[60, 140, 200, 300, 300],
        tcp_flags={"SYN": 1, "ACK": 4},
        dns_domain="malicious-dga-test99.biz",
        tls_handshake_meta={"tls_version": "TLS 1.2", "cipher": "ECDHE-RSA-AES128-GCM-SHA256"},
        packet_timestamps=[1700000000.0, 1700000001.0, 1700000002.0]
    )

    assert isinstance(fv, FeatureVector)
    assert fv.flow_id == "FLOW-000001"
    assert fv.flow_packet_count == 10
    assert fv.flow_byte_count == 1000
    assert fv.tcp_syn_count == 1
    assert fv.dns_query_length == 24
    assert fv.dns_entropy > 3.0
    assert fv.tls_version == "TLS 1.2"
    assert fv.temporal_periodicity > 0.80


def test_feature_engine_determinism(sample_flow):
    engine = FeatureEngine()
    kwargs = dict(
        flow=sample_flow,
        packet_sizes=[100, 200],
        tcp_flags={"SYN": 1},
        dns_domain="example.com",
        packet_timestamps=[100.0, 110.0, 120.0]
    )
    fv1 = engine.create_feature_vector(**kwargs)
    fv2 = engine.create_feature_vector(**kwargs)

    assert fv1.model_dump() == fv2.model_dump()
