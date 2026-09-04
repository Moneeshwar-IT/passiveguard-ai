"""
PassiveGuard AI — TLS / QUIC Feature Extraction Module (Module 2)

STRICT PASSIVE CONSTRAINT:
TLS and QUIC features are strictly derived from unencrypted Client/Server Hello metadata
and observed packet size/timing statistics.
Payload decryption, MITM proxying, and key extraction are ABSOLUTELY PROHIBITED.
Missing fields remain None; false fingerprints are NEVER fabricated.
"""
import math
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from app.ingestion.models import FlowRecord


class TLSFeatures(BaseModel):
    """
    Structured container for metadata-only TLS and QUIC features.
    """
    tls_version: Optional[str] = None
    tls_cipher: Optional[str] = None
    tls_ja3: Optional[str] = None
    tls_ja3s: Optional[str] = None
    tls_ja4: Optional[str] = None
    tls_handshake_metadata: Optional[Dict[str, Any]] = None
    tls_packet_count: Optional[int] = None
    tls_byte_count: Optional[int] = None
    tls_mean_packet_size: Optional[float] = None
    tls_std_packet_size: Optional[float] = None
    tls_mean_iat: Optional[float] = None
    tls_std_iat: Optional[float] = None


def extract_tls_features(
    flow: FlowRecord,
    tls_handshake_meta: Optional[Dict[str, Any]] = None,
    packet_sizes: Optional[List[int]] = None,
    timestamps: Optional[List[float]] = None
) -> TLSFeatures:
    """
    Extracts unencrypted TLS / QUIC metadata and traffic distribution features.
    If no TLS handshake or protocol metadata is present, returns TLSFeatures with explicit None fields.
    """
    if not tls_handshake_meta and flow.protocol not in ["TCP", "UDP"]:
        return TLSFeatures()

    # Read unencrypted handshake metadata if present
    meta = tls_handshake_meta or {}
    tls_version = meta.get("tls_version")
    tls_cipher = meta.get("cipher")
    ja3 = meta.get("ja3")
    ja3s = meta.get("ja3s")
    ja4 = meta.get("ja4")

    # If this is not a TLS flow and has no TLS metadata, return empty TLSFeatures
    if not (tls_version or tls_cipher or ja3 or ja4 or meta.get("is_tls")):
        return TLSFeatures()

    # Packet size statistics for TLS session
    sizes = packet_sizes or []
    if sizes:
        mean_size = sum(sizes) / len(sizes)
        var_size = sum((s - mean_size) ** 2 for s in sizes) / len(sizes)
        std_size = math.sqrt(var_size)
    else:
        mean_size = None
        std_size = None

    # Inter-arrival time statistics for TLS session
    ts_list = sorted(timestamps) if timestamps and len(timestamps) > 1 else []
    if len(ts_list) > 1:
        iats = [ts_list[i] - ts_list[i - 1] for i in range(1, len(ts_list))]
        mean_iat = sum(iats) / len(iats)
        var_iat = sum((x - mean_iat) ** 2 for x in iats) / len(iats)
        std_iat = math.sqrt(var_iat)
    else:
        mean_iat = None
        std_iat = None

    return TLSFeatures(
        tls_version=tls_version,
        tls_cipher=tls_cipher,
        tls_ja3=ja3,
        tls_ja3s=ja3s,
        tls_ja4=ja4,
        tls_handshake_metadata=meta if meta else None,
        tls_packet_count=flow.packet_count,
        tls_byte_count=flow.byte_count,
        tls_mean_packet_size=round(mean_size, 4) if mean_size is not None else None,
        tls_std_packet_size=round(std_size, 4) if std_size is not None else None,
        tls_mean_iat=round(mean_iat, 6) if mean_iat is not None else None,
        tls_std_iat=round(std_iat, 6) if std_iat is not None else None
    )
