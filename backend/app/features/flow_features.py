"""
PassiveGuard AI — Flow Feature Extraction Module (Module 2)

STRICT PASSIVE CONSTRAINT:
Calculates statistical and directional flow features directly from observed FlowRecord and packet metadata.
Does not generate or fabricate traffic in reverse directions.
"""
import math
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.ingestion.models import FlowRecord


class FlowFeatures(BaseModel):
    """
    Structured container for statistical and directional flow features.
    Maintains backward compatibility with Module 1 detector contracts.
    """
    flow_packet_count: int = 0
    flow_byte_count: int = 0
    flow_duration: float = 0.0
    flow_packets_per_sec: float = 0.0
    flow_bytes_per_sec: float = 0.0

    # Optional metadata fields for Module 1 compatibility
    flow_id: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: Optional[str] = None
    avg_packet_size: Optional[float] = None

    # Packet size statistics
    flow_mean_packet_size: float = 0.0
    flow_min_packet_size: int = 0
    flow_max_packet_size: int = 0
    flow_std_packet_size: float = 0.0

    # TCP flag counts
    tcp_syn_count: int = 0
    tcp_syn_ack_count: int = 0
    tcp_ack_count: int = 0
    tcp_fin_count: int = 0
    tcp_rst_count: int = 0
    tcp_psh_count: int = 0

    # Directional features
    direction_src_to_dst_packets: int = 0
    direction_dst_to_src_packets: int = 0
    direction_src_to_dst_bytes: int = 0
    direction_dst_to_src_bytes: int = 0
    directional_packet_ratio: float = 0.0
    directional_byte_ratio: float = 0.0

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_kwargs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "packet_count" in data and "flow_packet_count" not in data:
                data["flow_packet_count"] = data["packet_count"]
            if "byte_count" in data and "flow_byte_count" not in data:
                data["flow_byte_count"] = data["byte_count"]
            if "duration" in data and "flow_duration" not in data:
                data["flow_duration"] = data["duration"]
            if "packets_per_sec" in data and "flow_packets_per_sec" not in data:
                data["flow_packets_per_sec"] = data["packets_per_sec"]
            if "bytes_per_sec" in data and "flow_bytes_per_sec" not in data:
                data["flow_bytes_per_sec"] = data["bytes_per_sec"]
        return data

    # Backward compatibility properties for Module 1 detectors
    @property
    def packet_count(self) -> int:
        return self.flow_packet_count

    @property
    def byte_count(self) -> int:
        return self.flow_byte_count

    @property
    def duration(self) -> float:
        return self.flow_duration

    @property
    def packets_per_sec(self) -> float:
        return self.flow_packets_per_sec

    @property
    def bytes_per_sec(self) -> float:
        return self.flow_bytes_per_sec

    model_config = ConfigDict(extra="ignore")


def extract_flow_features(
    flow: FlowRecord,
    packet_sizes: Optional[List[int]] = None,
    tcp_flags: Optional[Dict[str, int]] = None,
    direction_packets: Optional[Tuple[int, int]] = None,
    direction_bytes: Optional[Tuple[int, int]] = None
) -> FlowFeatures:
    """
    Extracts statistical and directional flow features from a FlowRecord and optional observed metadata.
    """
    eff_duration = max(flow.duration, 0.000001)
    packets_per_sec = flow.packet_count / eff_duration
    bytes_per_sec = flow.byte_count / eff_duration

    # Packet size statistics calculation
    sizes = packet_sizes or ([int(flow.byte_count / max(flow.packet_count, 1))] * flow.packet_count)
    if sizes:
        mean_size = float(sum(sizes)) / len(sizes)
        min_size = min(sizes)
        max_size = max(sizes)
        variance = sum((s - mean_size) ** 2 for s in sizes) / len(sizes)
        std_size = math.sqrt(variance)
    else:
        mean_size = 0.0
        min_size = 0
        max_size = 0
        std_size = 0.0

    # TCP flags breakdown
    flags = tcp_flags or {}
    syn_c = flags.get("SYN", 0)
    syn_ack_c = flags.get("SYN_ACK", 0)
    ack_c = flags.get("ACK", 0)
    fin_c = flags.get("FIN", 0)
    rst_c = flags.get("RST", 0)
    psh_c = flags.get("PSH", 0)

    # Directional metrics calculation
    if direction_packets is not None:
        src2dst_pkts, dst2src_pkts = direction_packets
    elif flow.packets_src_to_dst is not None and flow.packets_dst_to_src is not None:
        src2dst_pkts, dst2src_pkts = flow.packets_src_to_dst, flow.packets_dst_to_src
    else:
        src2dst_pkts, dst2src_pkts = flow.packet_count, 0

    if direction_bytes is not None:
        src2dst_bytes, dst2src_bytes = direction_bytes
    elif flow.bytes_src_to_dst is not None and flow.bytes_dst_to_src is not None:
        src2dst_bytes, dst2src_bytes = flow.bytes_src_to_dst, flow.bytes_dst_to_src
    else:
        src2dst_bytes, dst2src_bytes = flow.byte_count, 0

    total_pkts = src2dst_pkts + dst2src_pkts
    total_bytes = src2dst_bytes + dst2src_bytes

    dir_pkt_ratio = src2dst_pkts / total_pkts if total_pkts > 0 else 1.0
    dir_byte_ratio = src2dst_bytes / total_bytes if total_bytes > 0 else 1.0

    return FlowFeatures(
        flow_id=flow.flow_id,
        src_port=flow.src_port,
        dst_port=flow.dst_port,
        protocol=flow.protocol,
        avg_packet_size=round(mean_size, 4),
        flow_packet_count=flow.packet_count,
        flow_byte_count=flow.byte_count,
        flow_duration=flow.duration,
        flow_packets_per_sec=round(packets_per_sec, 4),
        flow_bytes_per_sec=round(bytes_per_sec, 4),
        flow_mean_packet_size=round(mean_size, 4),
        flow_min_packet_size=min_size,
        flow_max_packet_size=max_size,
        flow_std_packet_size=round(std_size, 4),
        tcp_syn_count=syn_c,
        tcp_syn_ack_count=syn_ack_c,
        tcp_ack_count=ack_c,
        tcp_fin_count=fin_c,
        tcp_rst_count=rst_c,
        tcp_psh_count=psh_c,
        direction_src_to_dst_packets=src2dst_pkts,
        direction_dst_to_src_packets=dst2src_pkts,
        direction_src_to_dst_bytes=src2dst_bytes,
        direction_dst_to_src_bytes=dst2src_bytes,
        directional_packet_ratio=round(dir_pkt_ratio, 4),
        directional_byte_ratio=round(dir_byte_ratio, 4)
    )
