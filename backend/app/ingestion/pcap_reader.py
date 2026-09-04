"""
PassiveGuard AI — Read-Only PCAP Reader (Module 1)

STRICT PASSIVE CONSTRAINT:
This reader parses packet bytes directly from offline PCAP files.
Under NO circumstances does it open raw socket emitters or transmit packets over a network.
Scapy sending methods (send, sendp, sr, sr1, srp, srp1) are strictly prohibited.
"""
import os
import logging
from typing import Generator, Optional
from app.ingestion.models import ObservedPacket

logger = logging.getLogger(__name__)


class ReadOnlyPcapReader:
    """
    Read-only PCAP packet iterator.
    
    Reads PCAP files incrementally using Scapy's streaming PcapReader interface,
    converting raw packet headers into immutable ObservedPacket objects.
    """

    def __init__(self, filepath: str):
        self.filepath = filepath
        if not os.path.exists(filepath):
            logger.error(f"PCAP file not found: {filepath}")
            raise FileNotFoundError(f"PCAP file not found at path: {filepath}")

    @staticmethod
    def _extract_tcp_flags_str(flags_obj) -> str:
        """Helper to convert Scapy TCP flags to a standardized human-readable string."""
        flag_names = []
        try:
            # Scapy Flag object or int
            f_str = str(flags_obj)
            if 'F' in f_str: flag_names.append("FIN")
            if 'S' in f_str: flag_names.append("SYN")
            if 'R' in f_str: flag_names.append("RST")
            if 'P' in f_str: flag_names.append("PSH")
            if 'A' in f_str: flag_names.append("ACK")
            if 'U' in f_str: flag_names.append("URG")
            if 'E' in f_str: flag_names.append("ECE")
            if 'C' in f_str: flag_names.append("CWR")
        except Exception:
            pass
        return ", ".join(flag_names) if flag_names else "NONE"

    def read_packets(self) -> Generator[ObservedPacket, None, None]:
        """
        Yields ObservedPacket objects incrementally from the PCAP file.
        
        Preserves original packet microsecond timestamps, layer 3/4 headers,
        and skips non-IP or malformed packets safely without throwing unhandled exceptions.
        """
        from scapy.all import PcapReader as ScapyPcapReader, IP, IPv6, TCP, UDP, ICMP

        logger.info(f"Opening PCAP for passive read-only processing: {self.filepath}")

        try:
            with ScapyPcapReader(self.filepath) as reader:
                for pkt in reader:
                    try:
                        timestamp = float(pkt.time)
                        pkt_len = len(pkt)

                        src_ip: Optional[str] = None
                        dst_ip: Optional[str] = None
                        src_port: Optional[int] = None
                        dst_port: Optional[int] = None
                        protocol: str = "OTHER"
                        tcp_flags_str: Optional[str] = None

                        if IP in pkt:
                            ip_layer = pkt[IP]
                            src_ip = ip_layer.src
                            dst_ip = ip_layer.dst
                            protocol = "IP"
                        elif IPv6 in pkt:
                            ip6_layer = pkt[IPv6]
                            src_ip = ip6_layer.src
                            dst_ip = ip6_layer.dst
                            protocol = "IPv6"
                        else:
                            # Unsupported or non-IP packet (e.g. ARP, STP)
                            logger.debug(f"Skipping non-IP packet of length {pkt_len}")
                            continue

                        if TCP in pkt:
                            tcp_layer = pkt[TCP]
                            src_port = tcp_layer.sport
                            dst_port = tcp_layer.dport
                            protocol = "TCP"
                            tcp_flags_str = self._extract_tcp_flags_str(tcp_layer.flags)
                        elif UDP in pkt:
                            udp_layer = pkt[UDP]
                            src_port = udp_layer.sport
                            dst_port = udp_layer.dport
                            protocol = "UDP"
                        elif ICMP in pkt:
                            protocol = "ICMP"

                        yield ObservedPacket(
                            timestamp=timestamp,
                            src_ip=src_ip,
                            dst_ip=dst_ip,
                            src_port=src_port,
                            dst_port=dst_port,
                            protocol=protocol,
                            packet_length=pkt_len,
                            tcp_flags=tcp_flags_str,
                            direction="inbound"
                        )
                    except Exception as pkt_err:
                        logger.error(f"Error parsing individual packet in {self.filepath}: {pkt_err}")
                        continue
        except Exception as file_err:
            logger.error(f"Failed to process PCAP file {self.filepath}: {file_err}")
            raise


# Alias for backward compatibility
PCAPReader = ReadOnlyPcapReader
