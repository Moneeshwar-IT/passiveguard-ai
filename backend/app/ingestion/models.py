"""
PassiveGuard AI — Ingestion Data Models (Module 1)

STRICT PASSIVE CONSTRAINT:
These models represent observed network telemetry captured from passive monitoring interfaces
or PCAP files. They are strictly read-only data containers and MUST NOT contain any methods
or logic that perform active network transmission, packet injection, or payload modification.
"""
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


class ObservedPacket(BaseModel):
    """
    Represents a single observed IP packet captured passively from a PCAP file or stream.
    
    Contains only header metadata and timing observed during passive capture.
    No payload content or decrypted application data is stored.
    """
    timestamp: float = Field(..., description="Packet capture epoch timestamp in seconds (microsecond precision)")
    src_ip: Optional[str] = Field(default=None, description="Observed source IP address")
    dst_ip: Optional[str] = Field(default=None, description="Observed destination IP address")
    src_port: Optional[int] = Field(default=None, ge=0, le=65535, description="Observed source port")
    dst_port: Optional[int] = Field(default=None, ge=0, le=65535, description="Observed destination port")
    protocol: str = Field(..., description="Transport/Network protocol name (TCP, UDP, ICMP, IP, etc.)")
    packet_length: int = Field(..., ge=0, description="Total packet length in bytes")
    tcp_flags: Optional[str] = Field(default=None, description="Human-readable TCP flags string (e.g., 'SYN, ACK')")
    direction: Optional[str] = Field(default="inbound", description="Observed directionality label relative to enclave")

    model_config = ConfigDict(frozen=True)


class FlowRecord(BaseModel):
    """
    Represents an aggregated 5-tuple network flow record derived passively from observed packets.
    
    A flow is defined by the 5-tuple: (src_ip, dst_ip, src_port, dst_port, protocol).
    Calculates derived rate metrics (packets/sec, bytes/sec) passively.
    """
    timestamp: float = Field(..., description="Flow start epoch timestamp in seconds")
    flow_id: str = Field(..., description="Unique flow identifier (e.g. FLOW-000001 or 5-tuple hash)")
    src_ip: str = Field(..., description="Source IP address")
    dst_ip: str = Field(..., description="Destination IP address")
    src_port: int = Field(..., ge=0, le=65535, description="Source port")
    dst_port: int = Field(..., ge=0, le=65535, description="Destination port")
    protocol: str = Field(..., description="Transport protocol name (TCP, UDP, ICMP)")
    packet_count: int = Field(..., ge=1, description="Total packet count in flow")
    byte_count: int = Field(..., ge=0, description="Total byte volume in flow")
    duration: float = Field(..., ge=0.0, description="Flow duration in seconds")
    packets_src_to_dst: Optional[int] = Field(default=None, ge=0, description="Packets sent from source to destination")
    packets_dst_to_src: Optional[int] = Field(default=None, ge=0, description="Packets sent from destination to source")
    bytes_src_to_dst: Optional[int] = Field(default=None, ge=0, description="Bytes sent from source to destination")
    bytes_dst_to_src: Optional[int] = Field(default=None, ge=0, description="Bytes sent from destination to source")

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_flow_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "timestamp" not in data and "first_seen" in data:
                data["timestamp"] = data["first_seen"]
            if "duration" not in data:
                if "last_seen" in data and "first_seen" in data:
                    data["duration"] = max(0.0, data["last_seen"] - data["first_seen"])
                else:
                    data["duration"] = 0.0
            if "first_seen" not in data and "timestamp" in data:
                data["first_seen"] = data["timestamp"]
            if "last_seen" not in data and "timestamp" in data:
                data["last_seen"] = data["timestamp"] + data.get("duration", 0.0)

            if "bytes_src_to_dst" not in data and "src_bytes" in data:
                data["bytes_src_to_dst"] = data["src_bytes"]
            if "bytes_dst_to_src" not in data and "dst_bytes" in data:
                data["bytes_dst_to_src"] = data["dst_bytes"]
            if "packets_src_to_dst" not in data and "src_packets" in data:
                data["packets_src_to_dst"] = data["src_packets"]
            if "packets_dst_to_src" not in data and "dst_packets" in data:
                data["packets_dst_to_src"] = data["dst_packets"]
        return data

    @property
    def first_seen(self) -> float:
        return self.timestamp

    @property
    def last_seen(self) -> float:
        return self.timestamp + self.duration

    @property
    def src_packets(self) -> int:
        return self.packets_src_to_dst if self.packets_src_to_dst is not None else (self.packet_count // 2)

    @property
    def dst_packets(self) -> int:
        return self.packets_dst_to_src if self.packets_dst_to_src is not None else (self.packet_count - self.src_packets)

    @property
    def src_bytes(self) -> int:
        return self.bytes_src_to_dst if self.bytes_src_to_dst is not None else (self.byte_count // 2)

    @property
    def dst_bytes(self) -> int:
        return self.bytes_dst_to_src if self.bytes_dst_to_src is not None else (self.byte_count - self.src_bytes)

    @property
    def tcp_flags(self) -> dict:
        return {"SYN": 1, "ACK": max(0, self.packet_count - 1)}

    model_config = ConfigDict(frozen=True, extra="ignore")

    @property
    def packets_per_second(self) -> float:
        """Calculates derived observed packets per second rate."""
        eff_duration = max(self.duration, 0.000001)
        return self.packet_count / eff_duration

    @property
    def bytes_per_second(self) -> float:
        """Calculates derived observed bytes per second rate."""
        eff_duration = max(self.duration, 0.000001)
        return self.byte_count / eff_duration
