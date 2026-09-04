"""
Ingestion module for PassiveGuard AI (Module 1).
Handles passive read-only packet reading and 5-tuple flow record streaming.
"""
from app.ingestion.models import ObservedPacket, FlowRecord
from app.ingestion.pcap_reader import ReadOnlyPcapReader, PCAPReader
from app.ingestion.flow_stream import FlowStream, FlowKey

__all__ = [
    "ObservedPacket",
    "FlowRecord",
    "ReadOnlyPcapReader",
    "PCAPReader",
    "FlowStream",
    "FlowKey"
]
