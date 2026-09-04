#!/usr/bin/env python3
"""
PassiveGuard AI — Read-Only PCAP Replay Harness (Module 1)

STRICT PASSIVE CONSTRAINT:
This script performs an offline simulation of PCAP replay by parsing packet timestamps
and pushing flow records directly into the internal ingestion queue.
It DOES NOT open raw sockets, bind interfaces, or transmit packets onto any physical network.
Scapy sending functions are NEVER invoked.
"""
import sys
import os
import time
import argparse
import logging

from app.ingestion.pcap_reader import ReadOnlyPcapReader
from app.ingestion.flow_stream import FlowStream, FlowRecord
from app.pipeline.engine import pipeline_engine
import json
import urllib.request


def dispatch_flow(flow: FlowRecord, backend_url: str = "http://localhost:8000/api/traffic/ingest"):
    """
    Dispatches flow observation to running Uvicorn backend server so WebSocket clients update live.
    Falls back to local pipeline engine processing if backend is offline.
    """
    try:
        data = json.dumps(flow.model_dump(mode="json")).encode("utf-8")
        req = urllib.request.Request(backend_url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            pass
    except Exception:
        pipeline_engine.process_flow(flow)


def run_pcap_replay(pcap_path: str, speed_multiplier: float = 1.0, flow_timeout: float = 30.0):
    """
    Executes passive offline PCAP replay simulation.
    """
    print(f"\n{'='*60}")
    print(f"PASSIVEGUARD AI — MODULE 1 PCAP REPLAY")
    print(f"{'='*60}")
    print(f"PCAP File: {pcap_path}")
    print(f"Mode: READ-ONLY (Strict Passive Enclave)")
    print(f"Replay Speed: {speed_multiplier}x multiplier ({'Max Speed' if speed_multiplier == 0 else 'Simulated Pacing'})")
    print(f"Flow Timeout: {flow_timeout} seconds")
    print(f"{'='*60}\n")

    if not os.path.exists(pcap_path):
        logger.error(f"Cannot run replay: File not found at '{pcap_path}'")
        return

    reader = ReadOnlyPcapReader(pcap_path)
    stream = FlowStream(flow_timeout=flow_timeout)
    
    last_pkt_ts = None
    emitted_flows = []

    start_wall_time = time.time()

    for pkt in reader.read_packets():
        # Relative replay pacing simulation
        if speed_multiplier > 0 and last_pkt_ts is not None:
            ts_delta = pkt.timestamp - last_pkt_ts
            if ts_delta > 0:
                time.sleep(ts_delta / speed_multiplier)
        last_pkt_ts = pkt.timestamp

        # Process packet through incremental flow stream
        flow = stream.process_packet(pkt)
        if flow:
            emitted_flows.append(flow)
            dispatch_flow(flow)

        # Periodically check timeouts
        timeout_flows = stream.check_timeouts(pkt.timestamp)
        for tf in timeout_flows:
            emitted_flows.append(tf)
            dispatch_flow(tf)

    # Flush any remaining active flows at end of stream
    flushed_flows = stream.flush()
    for ff in flushed_flows:
        emitted_flows.append(ff)
        dispatch_flow(ff)

    metrics = stream.get_metrics()

    print(f"\n{"="*60}")
    print(f"REPLAY PROCESSING SUMMARY METRICS")
    print(f"{"="*60}")
    print(f"PCAP: {pcap_path}")
    print(f"Mode: READ-ONLY")
    print(f"Packets processed: {metrics['packets_processed']}")
    print(f"Flows created: {metrics['flows_created']}")
    print(f"Flows completed: {metrics['completed_flows']}")
    print(f"Bytes processed: {metrics['bytes_processed']} bytes")
    print(f"Processing rate: {metrics['observed_packets_per_sec']} packets/sec")
    print(f"Throughput rate: {metrics['observed_bytes_per_sec']} bytes/sec")
    print(f"Processing duration: {metrics['processing_duration_sec']} sec")
    print(f"{"="*60}\n")

    if emitted_flows:
        sample_flow = emitted_flows[0]
        print(f"Example Flow Emitted:")
        print(f"  Flow ID:     {sample_flow.flow_id}")
        print(f"  Source:      {sample_flow.src_ip}:{sample_flow.src_port}")
        print(f"  Destination: {sample_flow.dst_ip}:{sample_flow.dst_port}")
        print(f"  Protocol:    {sample_flow.protocol}")
        print(f"  Packets:     {sample_flow.packet_count}")
        print(f"  Bytes:       {sample_flow.byte_count}")
        print(f"  Duration:    {sample_flow.duration:.2f} sec")
        print(f"  Rate:        {sample_flow.packets_per_second:.2f} pkt/s, {sample_flow.bytes_per_second:.2f} B/s")
        print(f"{"="*60}\n")
    else:
        print("No completed flows emitted during replay.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PassiveGuard AI - Module 1 Passive PCAP Replay Harness")
    parser.add_argument("file", type=str, nargs="?", default="./data/samples/sample.pcap", help="Path to input PCAP file")
    parser.add_argument("--speed", type=float, default=1.0, help="Replay speed multiplier (0.0 = max speed)")
    parser.add_argument("--timeout", type=float, default=30.0, help="Flow idle timeout window in seconds")
    args = parser.parse_args()

    run_pcap_replay(args.file, args.speed, args.timeout)
