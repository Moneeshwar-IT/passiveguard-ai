# PassiveGuard AI — Feature Engine Documentation (Module 2)

This document provides technical documentation for all features calculated by the **PassiveGuard AI Feature Engine**.

---

## Data Abstraction Layers

To maintain architectural transparency and strict passive security constraints, data is separated into three distinct abstraction layers:

1. **Raw Observed Metadata**: Telemetry directly extracted from passive PCAP headers or flow records (e.g. packet lengths, TCP flags, timestamp floats, unencrypted SNI strings).
2. **Calculated Feature**: Deterministic numerical or categorical transformations computed by Module 2 (e.g., Shannon entropy, coefficient of variation, packet rate, JA3 hash).
3. **Model Output**: Statistical anomaly scores and threat classifications computed downstream by AI detection models in Module 3 (e.g., DDoS score, C2 probability). *Features are NEVER confused with calibrated probabilities.*

---

## 1. Flow Features

| Feature Name | Type | Calculation / Formula | Threat Relevance |
| :--- | :--- | :--- | :--- |
| `flow_packet_count` | Raw/Calculated | Total count of observed packets in flow | Volumetric DDoS, Scanning |
| `flow_byte_count` | Raw/Calculated | Total byte volume in flow | Data Exfiltration, Flooding |
| `flow_duration` | Calculated | `last_packet_time - first_packet_time` (seconds) | Long-lived C2, Slowloris |
| `flow_packets_per_sec` | Calculated | `flow_packet_count / max(flow_duration, 0.000001)` | Volumetric DDoS detection |
| `flow_bytes_per_sec` | Calculated | `flow_byte_count / max(flow_duration, 0.000001)` | High-bandwidth egress / Exfiltration |
| `flow_mean_packet_size` | Calculated | `mean(packet_lengths)` | Protocol anomaly, Tunneling |
| `flow_min_packet_size` | Calculated | `min(packet_lengths)` | Port scan probes, SYN floods |
| `flow_max_packet_size` | Calculated | `max(packet_lengths)` | Jumbo frame exfiltration |
| `flow_std_packet_size` | Calculated | `std_dev(packet_lengths)` | Fixed-size C2 heartbeats vs payload streams |
| `tcp_syn_count` | Raw/Count | Sum of SYN flags in TCP headers | SYN Flood DDoS, Port Scanning |
| `tcp_syn_ack_count` | Raw/Count | Sum of SYN-ACK flags | Connection handshakes |
| `tcp_ack_count` | Raw/Count | Sum of ACK flags | Sustained session volume |
| `tcp_fin_count` | Raw/Count | Sum of FIN flags | Session termination rate |
| `tcp_rst_count` | Raw/Count | Sum of RST flags | Scanning, Connection rejection |
| `tcp_psh_count` | Raw/Count | Sum of PSH flags | Interactive C2 shell data transfer |
| `direction_src_to_dst_bytes` | Calculated | Bytes transmitted from source to destination | Egress exfiltration volume |
| `direction_dst_to_src_bytes` | Calculated | Bytes transmitted from destination to source | Ingress response volume |
| `directional_byte_ratio` | Calculated | `src_to_dst_bytes / (src_to_dst_bytes + dst_to_src_bytes)` | High ratio (>0.9) indicates Data Exfiltration |

---

## 2. DNS Features

| Feature Name | Type | Calculation / Formula | Threat Relevance |
| :--- | :--- | :--- | :--- |
| `dns_query_length` | Calculated | Character length of clean domain query string | DNS Tunneling payload carrying |
| `dns_label_count` | Calculated | Count of dot-separated labels (e.g. `a.b.c.com` = 4) | Subdomain tunneling |
| `dns_max_label_length` | Calculated | Character length of longest domain label | Base64/Base32 encoded subdomains |
| `dns_digit_ratio` | Calculated | `digits_count / total_char_length` | DGA domain detection |
| `dns_alpha_ratio` | Calculated | `alpha_count / total_char_length` | Lexical DGA character distribution |
| `dns_unique_character_ratio` | Calculated | `unique_chars_count / total_char_length` | High uniqueness in DGA names |
| `dns_entropy` | Calculated | Shannon Entropy $H(X) = -\sum p(x) \log_2 p(x)$ | High entropy (>4.0) indicates DGA / Tunneling |
| `dns_query_frequency` | Calculated | Queries per minute from source host | High-rate DNS tunneling / DGA sweeps |
| `dns_unique_query_count` | Calculated | Count of unique domains queried | DGA storm sweep behavior |
| `dns_nxdomain_ratio` | Calculated | `nxdomain_responses / total_queries` | High NXDOMAIN ratio indicates active DGA |
| `dns_ngrams_top_freq` | Calculated | Top 2-gram character frequency distribution | Unnatural character transitions in DGA |

---

## 3. TLS / QUIC Metadata Features (NO Decryption)

| Feature Name | Type | Calculation / Formula | Threat Relevance |
| :--- | :--- | :--- | :--- |
| `tls_version` | Unencrypted Raw | Protocol version in Client Hello (e.g. TLS 1.2, TLS 1.3) | Deprecated SSL/TLS protocol exploit |
| `tls_cipher` | Unencrypted Raw | Cipher suite identifier selected/offered | Weak/Outdated cipher suite detection |
| `tls_ja3` | Calculated | MD5 hash of Client Hello SSLVersion, Ciphers, Extensions, EllipticCurves, PointFormats | Passive malware client fingerprinting |
| `tls_ja3s` | Calculated | MD5 hash of Server Hello response parameters | Passive C2 server fingerprinting |
| `tls_ja4` | Calculated | JA4 network fingerprint string (`t13d...`) | Modern TLS 1.3 client fingerprinting |
| `tls_packet_count` | Calculated | Count of TLS application data records | Encrypted session length |
| `tls_byte_count` | Calculated | Total byte volume of encrypted TLS session | Encrypted exfiltration volume |
| `tls_mean_packet_size` | Calculated | Mean size of encrypted TLS payload records | Encrypted C2 beacon vs file download |
| `tls_std_packet_size` | Calculated | Standard deviation of TLS record sizes | Encrypted shell interactive typing vs streaming |

---

## 4. Temporal & Time-Series Features

| Feature Name | Type | Calculation / Formula | Threat Relevance |
| :--- | :--- | :--- | :--- |
| `temporal_mean_iat` | Calculated | `mean(inter_arrival_times)` | Average pacing between connections |
| `temporal_std_iat` | Calculated | `std_dev(inter_arrival_times)` | Connection timing variance |
| `temporal_min_iat` | Calculated | `min(inter_arrival_times)` | Minimum gap between pulses |
| `temporal_max_iat` | Calculated | `max(inter_arrival_times)` | Maximum gap between pulses |
| `temporal_cv_iat` | Calculated | Coefficient of Variation $CV = \frac{\text{std\_iat}}{\text{mean\_iat}}$ | Standardized timing dispersion |
| `temporal_burstiness` | Calculated | Burstiness Index $B = \frac{\text{std\_iat} - \text{mean\_iat}}{\text{std\_iat} + \text{mean\_iat}} \in [-1, 1]$ | $+1$ = Bursty traffic, $-1$ = Periodic traffic |
| `temporal_periodicity` | Calculated | Periodicity Score $P = \frac{1}{1 + CV} \in [0, 1]$ | High score ($P \ge 0.85$) indicates C2 Beaconing |
| `temporal_event_frequency` | Calculated | Connection events per minute | High rate indicates scanning / flood |
| `temporal_recurrence_count` | Calculated | Total recurring events within bounded window | Repeated beacon count |
