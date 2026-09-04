"""
PassiveGuard AI — Incremental Flow Stream Aggregator (Module 1)

STRICT PASSIVE CONSTRAINT:
Flow aggregation operates in-memory on observed packet headers.
It does NOT contact either endpoint, perform reverse lookups, or transmit network control messages.
"""
import logging
import time
from typing import Dict, List, Optional, Tuple, NamedTuple, Generator, AsyncGenerator
from dataclasses import dataclass, field
from app.ingestion.models import ObservedPacket, FlowRecord

logger = logging.getLogger(__name__)


class FlowKey(NamedTuple):
    """
    Immutable 5-tuple identifier defining a unidirectional IP flow stream.
    """
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str


@dataclass
class ActiveFlowState:
    """
    Internal state tracking active flow metrics before timeout emission.
    """
    start_time: float
    last_time: float
    key: FlowKey
    packet_count: int = 0
    byte_count: int = 0
    flow_number: int = 0

    def to_flow_record(self) -> FlowRecord:
        """Converts active flow state into an immutable FlowRecord."""
        duration = max(0.0, self.last_time - self.start_time)
        return FlowRecord(
            timestamp=self.start_time,
            flow_id=f"FLOW-{self.flow_number:06d}",
            src_ip=self.key.src_ip,
            dst_ip=self.key.dst_ip,
            src_port=self.key.src_port,
            dst_port=self.key.dst_port,
            protocol=self.key.protocol,
            packet_count=self.packet_count,
            byte_count=self.byte_count,
            duration=round(duration, 6)
        )


class FlowStream:
    """
    Incremental Flow Aggregator.
    
    Consumes ObservedPacket instances one by one, maintains in-memory 5-tuple flow state,
    and emits FlowRecord instances when flows time out or complete stream processing.
    """

    def __init__(self, flow_timeout: float = 30.0):
        self.flow_timeout = flow_timeout
        self._active_flows: Dict[FlowKey, ActiveFlowState] = {}
        
        # Telemetry processing metrics
        self.packets_processed: int = 0
        self.flows_created: int = 0
        self.completed_flows_count: int = 0
        self.bytes_processed: int = 0
        self.start_processing_time: Optional[float] = None
        self.end_processing_time: Optional[float] = None

    @property
    def active_flows_count(self) -> int:
        """Returns current count of active flows in memory."""
        return len(self._active_flows)

    def process_packet(self, packet: ObservedPacket) -> Optional[FlowRecord]:
        """
        Processes a single ObservedPacket incrementally.
        
        If a packet belongs to an existing active flow and does not exceed flow_timeout,
        the flow state is updated. If flow_timeout is exceeded, the existing flow is emitted
        and a new flow is initialized.
        """
        if self.start_processing_time is None:
            self.start_processing_time = time.time()

        self.packets_processed += 1
        self.bytes_processed += packet.packet_length

        # Skip packets lacking valid 5-tuple IP/Port metadata
        if not packet.src_ip or not packet.dst_ip:
            logger.debug("Packet missing IP metadata; skipping 5-tuple flow aggregation")
            return None

        src_port = packet.src_port if packet.src_port is not None else 0
        dst_port = packet.dst_port if packet.dst_port is not None else 0

        key = FlowKey(
            src_ip=packet.src_ip,
            dst_ip=packet.dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            protocol=packet.protocol
        )

        emitted_flow: Optional[FlowRecord] = None

        if key in self._active_flows:
            flow_state = self._active_flows[key]
            idle_time = packet.timestamp - flow_state.last_time

            # Timeout check: if idle time exceeds flow_timeout, emit old flow and start new
            if idle_time > self.flow_timeout:
                logger.debug(f"Flow {key} timed out (idle {idle_time:.2f}s > {self.flow_timeout}s). Emitting record.")
                emitted_flow = flow_state.to_flow_record()
                self.completed_flows_count += 1

                # Start fresh flow for this key
                self.flows_created += 1
                self._active_flows[key] = ActiveFlowState(
                    start_time=packet.timestamp,
                    last_time=packet.timestamp,
                    key=key,
                    packet_count=1,
                    byte_count=packet.packet_length,
                    flow_number=self.flows_created
                )
            else:
                # Update existing flow
                flow_state.packet_count += 1
                flow_state.byte_count += packet.packet_length
                flow_state.last_time = packet.timestamp
        else:
            # Create new active flow
            self.flows_created += 1
            self._active_flows[key] = ActiveFlowState(
                start_time=packet.timestamp,
                last_time=packet.timestamp,
                key=key,
                packet_count=1,
                byte_count=packet.packet_length,
                flow_number=self.flows_created
            )

        return emitted_flow

    def check_timeouts(self, current_timestamp: float) -> List[FlowRecord]:
        """
        Evicts and returns all active flows whose idle duration exceeds flow_timeout.
        """
        expired: List[FlowKey] = []
        emitted_records: List[FlowRecord] = []

        for key, state in self._active_flows.items():
            if (current_timestamp - state.last_time) > self.flow_timeout:
                expired.append(key)
                emitted_records.append(state.to_flow_record())
                self.completed_flows_count += 1

        for key in expired:
            del self._active_flows[key]

        return emitted_records

    def flush(self) -> List[FlowRecord]:
        """
        Flushes and evicts all remaining active flows upon stream completion.
        """
        self.end_processing_time = time.time()
        emitted_records: List[FlowRecord] = []

        for state in self._active_flows.values():
            emitted_records.append(state.to_flow_record())
            self.completed_flows_count += 1

        self._active_flows.clear()
        return emitted_records

    def get_metrics(self) -> dict:
        """
        Returns local PCAP replay processing performance metrics.
        """
        end = self.end_processing_time or time.time()
        start = self.start_processing_time or end
        wall_seconds = max(end - start, 0.000001)

        return {
            "packets_processed": self.packets_processed,
            "flows_created": self.flows_created,
            "active_flows": self.active_flows_count,
            "completed_flows": self.completed_flows_count,
            "bytes_processed": self.bytes_processed,
            "processing_duration_sec": round(wall_seconds, 4),
            "observed_packets_per_sec": round(self.packets_processed / wall_seconds, 2),
            "observed_bytes_per_sec": round(self.bytes_processed / wall_seconds, 2),
            "observed_flows_per_sec": round(self.flows_created / wall_seconds, 2),
        }
