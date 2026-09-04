"""
PassiveGuard AI — Controlled Threat Simulation & Demo Telemetry Generator (Module 14)

STRICT PASSIVE CONSTRAINT:
Generates deterministic synthetic flow telemetry in memory for SIH demonstration and pipeline testing.
Zero network packet transmission, zero active scanning, zero DNS query resolution, and zero TLS decryption.
All telemetry objects are explicitly tagged with source="controlled_demo".
"""
import sys
import os
import time
import random
import numpy as np
from typing import List, Dict, Any, Optional

# Ensure backend directory is on Python search path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
backend_dir = os.path.join(project_root, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.ingestion.models import FlowRecord


# Available Controlled Demo Scenarios
SCENARIOS_CATALOG = {
    "ddos": "High-volume Volumetric & SYN Flood Attack Simulation",
    "c2": "Low-and-Slow Periodic C2 Beaconing Session Sequence",
    "dga": "High-Entropy Algorithmically Generated Domain Query Telemetry",
    "dns_tunnel": "DNS Tunnelling & Covert Exfiltration Subdomain Sequence",
    "tls_malware": "Metadata-only Suspicious Encrypted Session (JA3 & Size Uniformity)",
    "recon": "Vertical Port Scanning & Reconnaissance Sweep Sequence",
    "exfiltration": "High-Volume Asymmetric Data Exfiltration Session",
    "mixed": "Multi-Stage Cyber Attack Chain (Recon -> C2 -> DGA -> Tunnel -> TLS -> Exfil -> DDoS)",
    "all": "Executes all controlled threat scenarios sequentially"
}


def set_reproducible_seed(seed: int = 42) -> None:
    """Sets deterministic random seed for 100% reproducible demo telemetry."""
    random.seed(seed)
    np.random.seed(seed)


class DemoFlowRecord(FlowRecord):
    """
    Subclass of FlowRecord carrying optional metadata (domain_name, tls_ja3, demo_campaign_id, source).
    """
    domain_name: Optional[str] = None
    dns_query: Optional[str] = None
    dns_entropy: Optional[float] = None
    dns_query_length: Optional[int] = None
    dns_digit_ratio: Optional[float] = None
    dns_unique_character_ratio: Optional[float] = None
    dns_nxdomain_ratio: Optional[float] = None
    dns_query_frequency: Optional[float] = None
    tls_ja3: Optional[str] = None
    tls_version: Optional[str] = None
    tls_cipher: Optional[str] = None
    tls_std_packet_size: Optional[float] = None
    tls_mean_packet_size: Optional[float] = None
    temporal_periodicity: Optional[float] = None
    source_entropy: Optional[float] = None
    demo_campaign_id: Optional[str] = None
    source: str = "controlled_demo"


def generate_ddos_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates high-rate SYN flood telemetry targeting internal server."""
    t0 = base_time or time.time()
    return [
        DemoFlowRecord(
            flow_id="DEMO-DDOS-001",
            timestamp=t0,
            src_ip="192.168.1.150",
            dst_ip="10.0.0.5",
            src_port=54321,
            dst_port=80,
            protocol="TCP",
            packet_count=20000,
            byte_count=24000000,
            duration=0.50,
            packets_src_to_dst=19990,
            packets_dst_to_src=10,
            bytes_src_to_dst=23990000,
            bytes_dst_to_src=10000,
            tcp_flags={"SYN": 19990, "ACK": 10},
            source_entropy=0.95,
            demo_campaign_id=campaign_id,
            source="controlled_demo"
        )
    ]


def generate_c2_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates sequence of 5 repeated periodic flows to simulate C2 beaconing heartbeats."""
    t0 = base_time or time.time()
    flows = []
    intervals = [0.0, 10.01, 20.02, 30.01, 40.03]
    for idx, offset in enumerate(intervals):
        flows.append(
            DemoFlowRecord(
                flow_id=f"DEMO-C2-00{idx+1}",
                timestamp=t0 + offset,
                src_ip="192.168.1.150",
                dst_ip="10.0.0.5",
                src_port=54000 + idx,
                dst_port=443,
                protocol="TCP",
                packet_count=12,
                byte_count=1200,
                duration=1.0,
                packets_src_to_dst=6,
                packets_dst_to_src=6,
                bytes_src_to_dst=600,
                bytes_dst_to_src=600,
                temporal_periodicity=0.95,
                demo_campaign_id=campaign_id,
                source="controlled_demo"
            )
        )
    return flows


def generate_dga_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates DNS query telemetry with high-entropy algorithmically generated domain name."""
    t0 = base_time or time.time()
    return [
        DemoFlowRecord(
            flow_id="DEMO-DGA-001",
            timestamp=t0,
            src_ip="192.168.1.150",
            dst_ip="10.0.0.53",
            src_port=53123,
            dst_port=53,
            protocol="UDP",
            packet_count=2,
            byte_count=240,
            duration=1.0,
            packets_src_to_dst=1,
            packets_dst_to_src=1,
            bytes_src_to_dst=120,
            bytes_dst_to_src=120,
            directional_byte_ratio=0.5,
            domain_name="x7k9m2p1q4z8w3r9u2v.com",
            dns_query="x7k9m2p1q4z8w3r9u2v.com",
            dns_entropy=4.50,
            dns_query_length=26,
            dns_digit_ratio=0.35,
            dns_unique_character_ratio=0.88,
            demo_campaign_id=campaign_id,
            source="controlled_demo"
        )
    ]


def generate_dns_tunnel_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates sequence of 4 DNS queries with long, encoded subdomain labels under same parent domain."""
    t0 = base_time or time.time()
    subdomains = [
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
        "z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0",
        "m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0",
        "k9j8i7h6g5f4e3d2c1b0a9z8y7x6w5v4u3t2s1r0"
    ]
    parent = "covert-dns-tunnel.com"
    flows = []
    for idx, sub in enumerate(subdomains):
        full_domain = f"{sub}.{parent}"
        flows.append(
            DemoFlowRecord(
                flow_id=f"DEMO-TUNNEL-00{idx+1}",
                timestamp=t0 + (idx * 0.2),
                src_ip="192.168.1.150",
                dst_ip="10.0.0.53",
                src_port=53200 + idx,
                dst_port=53,
                protocol="UDP",
                packet_count=2,
                byte_count=350,
                duration=1.0,
                packets_src_to_dst=1,
                packets_dst_to_src=1,
                bytes_src_to_dst=175,
                bytes_dst_to_src=175,
                directional_byte_ratio=0.5,
                domain_name=full_domain,
                dns_query=full_domain,
                dns_query_length=len(full_domain),
                dns_entropy=4.75,
                dns_query_frequency=35.0,
                demo_campaign_id=campaign_id,
                source="controlled_demo"
            )
        )
    return flows


def generate_tls_malware_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates metadata-only encrypted session with fixed packet size uniformity and suspicious JA3 hash."""
    t0 = base_time or time.time()
    return [
        DemoFlowRecord(
            flow_id="DEMO-TLS-001",
            timestamp=t0,
            src_ip="192.168.1.150",
            dst_ip="10.0.0.88",
            src_port=54500,
            dst_port=443,
            protocol="TCP",
            packet_count=20,
            byte_count=2400,
            duration=2.0,
            packets_src_to_dst=18,
            packets_dst_to_src=2,
            bytes_src_to_dst=2280,
            bytes_dst_to_src=120,
            tls_ja3="e7d705a3286e19ea42f587b344ee6865",
            tls_version="SSLv3",
            sni_hostname="malware-c2-beacon.internal",
            tls_cipher="TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
            tls_std_packet_size=1.2,
            tls_mean_packet_size=120.0,
            temporal_periodicity=0.90,
            demo_campaign_id=campaign_id,
            source="controlled_demo"
        )
    ]


def generate_recon_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates vertical port scan sequence targeting 25 ports on target 10.0.0.10."""
    t0 = base_time or time.time()
    target_ports = [
        21, 22, 23, 25, 53, 80, 110, 135, 139, 143,
        443, 445, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900,
        8080, 8443, 8888, 9000, 9200
    ]
    flows = []
    for idx, port in enumerate(target_ports):
        flows.append(
            DemoFlowRecord(
                flow_id=f"DEMO-RECON-00{idx+1}",
                timestamp=t0 + (idx * 0.01),
                src_ip="10.10.10.50",
                dst_ip="10.0.0.10",
                src_port=60000 + idx,
                dst_port=port,
                protocol="TCP",
                packet_count=1,
                byte_count=60,
                duration=0.5,
                packets_src_to_dst=1,
                packets_dst_to_src=0,
                bytes_src_to_dst=60,
                bytes_dst_to_src=0,
                demo_campaign_id=campaign_id,
                source="controlled_demo"
            )
        )
    return flows


def generate_exfiltration_scenario(base_time: Optional[float] = None, campaign_id: Optional[str] = None) -> List[DemoFlowRecord]:
    """Generates high outbound byte volume session with asymmetric transfer ratio."""
    t0 = base_time or time.time()
    return [
        DemoFlowRecord(
            flow_id="DEMO-EXFIL-001",
            timestamp=t0,
            src_ip="192.168.1.150",
            dst_ip="203.0.113.88",
            src_port=54321,
            dst_port=443,
            protocol="TCP",
            packet_count=10000,
            byte_count=150000000,
            duration=120.0,
            packets_src_to_dst=9950,
            packets_dst_to_src=50,
            bytes_src_to_dst=149950000,
            bytes_dst_to_src=50000,
            demo_campaign_id=campaign_id,
            source="controlled_demo"
        )
    ]


def generate_mixed_scenario(base_time: Optional[float] = None) -> List[DemoFlowRecord]:
    """Generates multi-stage attack chain telemetry with campaign ID."""
    t0 = base_time or time.time()
    campaign_id = "CAMPAIGN-SIH-2026-DEMO"
    all_flows = []

    # 1. Recon Stage
    all_flows.extend(generate_recon_scenario(t0, campaign_id))

    # 2. C2 Beaconing Stage
    all_flows.extend(generate_c2_scenario(t0 + 1.0, campaign_id))

    # 3. DGA Stage
    all_flows.extend(generate_dga_scenario(t0 + 45.0, campaign_id))

    # 4. DNS Tunnel Stage
    all_flows.extend(generate_dns_tunnel_scenario(t0 + 46.0, campaign_id))

    # 5. Encrypted Malware Stage
    all_flows.extend(generate_tls_malware_scenario(t0 + 47.0, campaign_id))

    # 6. Data Exfiltration Stage
    all_flows.extend(generate_exfiltration_scenario(t0 + 48.0, campaign_id))

    # 7. Simultaneous DDoS Event
    all_flows.extend(generate_ddos_scenario(t0 + 49.0, campaign_id))

    return all_flows


def get_scenario_telemetry(scenario_name: str) -> List[DemoFlowRecord]:
    """Retrieves synthetic telemetry flows for requested scenario."""
    set_reproducible_seed(42)
    s = scenario_name.lower().strip()

    if s == "ddos":
        return generate_ddos_scenario()
    elif s == "c2":
        return generate_c2_scenario()
    elif s == "dga":
        return generate_dga_scenario()
    elif s == "dns_tunnel":
        return generate_dns_tunnel_scenario()
    elif s == "tls_malware":
        return generate_tls_malware_scenario()
    elif s == "recon":
        return generate_recon_scenario()
    elif s == "exfiltration":
        return generate_exfiltration_scenario()
    elif s == "mixed":
        return generate_mixed_scenario()
    elif s == "all":
        flows = []
        flows.extend(generate_ddos_scenario())
        flows.extend(generate_c2_scenario())
        flows.extend(generate_dga_scenario())
        flows.extend(generate_dns_tunnel_scenario())
        flows.extend(generate_tls_malware_scenario())
        flows.extend(generate_recon_scenario())
        flows.extend(generate_exfiltration_scenario())
        return flows
    else:
        raise ValueError(f"Unknown demo scenario: '{scenario_name}'. Use --list to see available options.")


def print_scenarios_list() -> None:
    """Prints catalog of available controlled demonstration scenarios."""
    print("\n======================================================================")
    print("PASSIVEGUARD AI — CONTROLLED DEMO SCENARIO CATALOG")
    print("======================================================================\n")
    print("Available Scenarios:")
    for name, desc in SCENARIOS_CATALOG.items():
        print(f"  --scenario {name:<12} : {desc}")
    print("\nSafety Notice:")
    print("  All telemetry is generated strictly in memory and tagged source='controlled_demo'.")
    print("  Zero network transmission, zero active scanning, zero DNS query resolution.")
    print("======================================================================\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PassiveGuard AI Demo Data Generator")
    parser.add_argument("--scenario", type=str, default="mixed", help="Scenario to generate (e.g. ddos, c2, mixed, all)")
    parser.add_argument("--list", action="store_true", help="List available demo scenarios")

    args = parser.parse_args()
    if args.list:
        print_scenarios_list()
    else:
        flows = get_scenario_telemetry(args.scenario)
        print(f"Generated {len(flows)} synthetic flow observations for scenario '{args.scenario}'.")
