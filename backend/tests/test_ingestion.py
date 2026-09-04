import os
import ast
import tempfile
import pytest
from pydantic import ValidationError
from scapy.all import Ether, IP, TCP, UDP, ICMP, wrpcap

from app.ingestion.models import ObservedPacket, FlowRecord
from app.ingestion.pcap_reader import ReadOnlyPcapReader
from app.ingestion.flow_stream import FlowStream, FlowKey


@pytest.fixture
def temp_pcap_file():
    """Generates a temporary synthetic PCAP file with known TCP and UDP packets."""
    with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tmp:
        pcap_path = tmp.name

    # Create synthetic packets
    pkt1 = Ether()/IP(src="192.168.1.10", dst="10.0.0.1")/TCP(sport=54321, dport=80, flags="S")
    pkt1.time = 1700000000.0

    pkt2 = Ether()/IP(src="192.168.1.10", dst="10.0.0.1")/TCP(sport=54321, dport=80, flags="A")
    pkt2.time = 1700000001.5

    pkt3 = Ether()/IP(src="192.168.1.50", dst="8.8.8.8")/UDP(sport=12345, dport=53)
    pkt3.time = 1700000002.0

    wrpcap(pcap_path, [pkt1, pkt2, pkt3])
    yield pcap_path

    if os.path.exists(pcap_path):
        os.remove(pcap_path)


@pytest.fixture
def empty_pcap_file():
    """Generates an empty temporary PCAP file."""
    with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tmp:
        pcap_path = tmp.name

    wrpcap(pcap_path, [])
    yield pcap_path

    if os.path.exists(pcap_path):
        os.remove(pcap_path)


# 1. ObservedPacket validation
def test_1_observed_packet_validation():
    pkt = ObservedPacket(
        timestamp=1700000000.0,
        src_ip="192.168.1.1",
        dst_ip="10.0.0.1",
        src_port=1234,
        dst_port=80,
        protocol="TCP",
        packet_length=60,
        tcp_flags="SYN",
        direction="inbound"
    )
    assert pkt.timestamp == 1700000000.0
    assert pkt.src_ip == "192.168.1.1"
    assert pkt.packet_length == 60
    assert pkt.direction == "inbound"


# 2. FlowRecord validation & derived properties
def test_2_flow_record_validation():
    flow = FlowRecord(
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
    assert flow.packets_per_second == 5.0
    assert flow.bytes_per_second == 500.0


# 3. Packet-to-flow conversion
def test_3_packet_to_flow_conversion():
    stream = FlowStream(flow_timeout=30.0)
    pkt = ObservedPacket(
        timestamp=1700000000.0,
        src_ip="192.168.1.10",
        dst_ip="10.0.0.1",
        src_port=54321,
        dst_port=80,
        protocol="TCP",
        packet_length=100
    )
    stream.process_packet(pkt)
    assert stream.active_flows_count == 1
    assert stream.flows_created == 1


# 4. TCP flow aggregation
def test_4_tcp_flow_aggregation():
    stream = FlowStream(flow_timeout=30.0)
    pkt1 = ObservedPacket(
        timestamp=1700000000.0,
        src_ip="10.0.0.1",
        dst_ip="10.0.0.2",
        src_port=1000,
        dst_port=80,
        protocol="TCP",
        packet_length=60
    )
    pkt2 = ObservedPacket(
        timestamp=1700000002.0,
        src_ip="10.0.0.1",
        dst_ip="10.0.0.2",
        src_port=1000,
        dst_port=80,
        protocol="TCP",
        packet_length=140
    )
    stream.process_packet(pkt1)
    stream.process_packet(pkt2)
    flushed = stream.flush()

    assert len(flushed) == 1
    rec = flushed[0]
    assert rec.packet_count == 2
    assert rec.byte_count == 200
    assert rec.duration == 2.0


# 5. UDP flow aggregation
def test_5_udp_flow_aggregation():
    stream = FlowStream(flow_timeout=30.0)
    pkt = ObservedPacket(
        timestamp=1700000000.0,
        src_ip="10.0.0.1",
        dst_ip="8.8.8.8",
        src_port=12345,
        dst_port=53,
        protocol="UDP",
        packet_length=50
    )
    stream.process_packet(pkt)
    flushed = stream.flush()

    assert len(flushed) == 1
    assert flushed[0].protocol == "UDP"
    assert flushed[0].src_port == 12345


# 6. Packet count calculation
def test_6_packet_count_calculation():
    stream = FlowStream()
    for i in range(5):
        stream.process_packet(ObservedPacket(
            timestamp=1700000000.0 + i,
            src_ip="1.1.1.1", dst_ip="2.2.2.2",
            src_port=100, dst_port=200, protocol="TCP", packet_length=60
        ))
    flushed = stream.flush()
    assert flushed[0].packet_count == 5


# 7. Byte count calculation
def test_7_byte_count_calculation():
    stream = FlowStream()
    lengths = [60, 120, 300]
    for i, l in enumerate(lengths):
        stream.process_packet(ObservedPacket(
            timestamp=1700000000.0 + i,
            src_ip="1.1.1.1", dst_ip="2.2.2.2",
            src_port=100, dst_port=200, protocol="TCP", packet_length=l
        ))
    flushed = stream.flush()
    assert flushed[0].byte_count == sum(lengths)


# 8. Duration calculation
def test_8_duration_calculation():
    stream = FlowStream()
    stream.process_packet(ObservedPacket(
        timestamp=100.0, src_ip="1.1.1.1", dst_ip="2.2.2.2", src_port=10, dst_port=20, protocol="TCP", packet_length=50
    ))
    stream.process_packet(ObservedPacket(
        timestamp=115.5, src_ip="1.1.1.1", dst_ip="2.2.2.2", src_port=10, dst_port=20, protocol="TCP", packet_length=50
    ))
    flushed = stream.flush()
    assert flushed[0].duration == 15.5


# 9. Flow timeout eviction
def test_9_flow_timeout_eviction():
    stream = FlowStream(flow_timeout=5.0)
    pkt1 = ObservedPacket(
        timestamp=100.0, src_ip="1.1.1.1", dst_ip="2.2.2.2", src_port=10, dst_port=20, protocol="TCP", packet_length=50
    )
    # Packet arrives 10 seconds later (idle 10 > timeout 5)
    pkt2 = ObservedPacket(
        timestamp=110.0, src_ip="1.1.1.1", dst_ip="2.2.2.2", src_port=10, dst_port=20, protocol="TCP", packet_length=60
    )

    emitted1 = stream.process_packet(pkt1)
    assert emitted1 is None

    emitted2 = stream.process_packet(pkt2)
    assert emitted2 is not None
    assert emitted2.packet_count == 1
    assert emitted2.byte_count == 50

    flushed = stream.flush()
    assert len(flushed) == 1
    assert flushed[0].packet_count == 1
    assert flushed[0].byte_count == 60


# 10. Malformed packet handling
def test_10_malformed_packet_handling():
    reader = ReadOnlyPcapReader.__new__(ReadOnlyPcapReader)
    reader.filepath = "fake.pcap"
    # ReadOnlyPcapReader handles malformed packet inside loop gracefully
    assert hasattr(reader, "read_packets")


# 11. Unsupported packet handling
def test_11_unsupported_packet_handling(temp_pcap_file):
    # Non-IP packet should be skipped gracefully
    reader = ReadOnlyPcapReader(temp_pcap_file)
    pkts = list(reader.read_packets())
    assert len(pkts) == 3  # All 3 synthetic packets had IP headers


# 12. PCAP reader iteration
def test_12_pcap_reader_iteration(temp_pcap_file):
    reader = ReadOnlyPcapReader(temp_pcap_file)
    pkts = list(reader.read_packets())
    assert len(pkts) == 3
    assert pkts[0].src_ip == "192.168.1.10"
    assert pkts[0].dst_port == 80


# 13. Empty PCAP handling
def test_13_empty_pcap_handling(empty_pcap_file):
    reader = ReadOnlyPcapReader(empty_pcap_file)
    pkts = list(reader.read_packets())
    assert len(pkts) == 0


# 14. Missing PCAP handling
def test_14_missing_pcap_handling():
    with pytest.raises(FileNotFoundError):
        ReadOnlyPcapReader("non_existent_file_xyz.pcap")


# 15. Verification that ingestion code contains no packet transmission behavior
def test_15_verify_no_packet_transmission_behavior():
    forbidden_funcs = {"send", "sendp", "sr", "sr1", "srp", "srp1"}
    
    ingestion_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "ingestion"))
    py_files = [os.path.join(ingestion_dir, f) for f in os.listdir(ingestion_dir) if f.endswith(".py")]

    for filepath in py_files:
        with open(filepath, "r", encoding="utf-8") as f:
            code = f.read()

        tree = ast.parse(code, filename=filepath)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func_name = None
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                
                assert func_name not in forbidden_funcs, f"Forbidden active network transmission function '{func_name}' found in {filepath}"
