import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SummaryCard from '../components/SummaryCard';
import DetectionPipeline from '../components/dashboard/DetectionPipeline';
import PassiveEnclaveCard from '../components/dashboard/PassiveEnclaveCard';
import {
  Activity, AlertTriangle, ShieldAlert, Radio, Server,
  PieChart, BarChart3, ChevronRight, Bell, Zap, CheckCircle2
} from 'lucide-react';
import {
  fetchAlerts, fetchCurrentTraffic, fetchHistoricalTraffic,
  createWebSocketConnection, formatThroughput
} from '../services/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    fetchAlerts(null, 100).then(setAlerts).catch(console.error);
    fetchCurrentTraffic().then(setTraffic).catch(console.error);
    fetchHistoricalTraffic().then(setHistory).catch(console.error);

    const ws = createWebSocketConnection(
      (msg) => {
        if (msg.type === 'alert_created' || msg.event === 'alert_created') {
          if (msg.data) {
            setAlerts((prev) => {
              const exists = prev.some(a => a.alert_id === msg.data.alert_id);
              if (exists) return prev;
              return [msg.data, ...prev];
            });

            if (msg.data.severity === 'CRITICAL' || msg.data.severity === 'HIGH') {
              setToastAlert(msg.data);
              setTimeout(() => setToastAlert(null), 6000);
            }
          }
        }

        if (msg.type === 'traffic_update' || msg.event === 'traffic_update') {
          if (msg.data) {
            setTraffic(msg.data);
          }
        }

        if (msg.type === 'state_reset' || msg.event === 'state_reset' || msg.type === 'traffic_reset' || msg.event === 'traffic_reset') {
          setAlerts([]);
          setTraffic({
            active_flows: 0,
            total_packets_sec: 0,
            total_bytes_sec: 0,
            bandwidth_mbps: 0,
            protocol_distribution: { TCP: 0, UDP: 0, ICMP: 0, OTHER: 0 }
          });
          if (msg.data && msg.data.history && msg.data.history.length > 0) {
            setHistory(msg.data.history);
          } else {
            fetchHistoricalTraffic().then(setHistory).catch(console.error);
          }
        }
      },
      (status) => setWsStatus(status)
    );

    return () => ws.close();
  }, []);

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const mediumCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW' || a.severity === 'INFO').length;

  const avgConfidence = alerts.length > 0
    ? (alerts.reduce((acc, curr) => acc + (curr.confidence || 0.85), 0) / alerts.length) * 100
    : 98.4;

  // Threat Class Distribution Mapping (Controlled Color System)
  const threatCounts = {
    'DDoS': { count: alerts.filter(a => a.threat_class?.includes('DDOS')).length, color: '#EF4444' },
    'C2 Beaconing': { count: alerts.filter(a => a.threat_class?.includes('C2')).length, color: '#A855F7' },
    'DGA Domain': { count: alerts.filter(a => a.threat_class?.includes('DGA')).length, color: '#6366F1' },
    'DNS Tunneling': { count: alerts.filter(a => a.threat_class?.includes('TUNNEL')).length, color: '#22D3EE' },
    'Encrypted Malware': { count: alerts.filter(a => a.threat_class?.includes('MALWARE') || a.threat_class?.includes('TLS')).length, color: '#F59E0B' },
    'Recon Scan': { count: alerts.filter(a => a.threat_class?.includes('RECON') || a.threat_class?.includes('SCAN')).length, color: '#38BDF8' },
    'Exfiltration': { count: alerts.filter(a => a.threat_class?.includes('EXFIL')).length, color: '#EC4899' },
  };

  const threatChartData = Object.entries(threatCounts).map(([name, obj]) => ({ name, count: obj.count, fill: obj.color }));

  return (
    <div className="space-y-6 pb-8">
      {/* Toast Notification */}
      {toastAlert && (
        <div className="bg-[rgba(220,38,38,0.9)] border border-[#EF4444] p-4 rounded-xl flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-white shrink-0" />
            <div>
              <p className="text-xs font-mono text-white font-bold uppercase tracking-wider">NEW THREAT INCIDENT DETECTED</p>
              <p className="text-sm font-semibold text-white font-mono">
                [{toastAlert.severity}] {toastAlert.threat_class} — {toastAlert.source_ip} → {toastAlert.destination_ip}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/alert-details?id=${toastAlert.alert_id}`)}
            className="bg-[#050816] hover:bg-[#080D1C] text-white text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-[#EF4444] transition-colors shrink-0 cursor-pointer"
          >
            Inspect Evidence →
          </button>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1C2A45] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-[#F8FAFC] tracking-tight uppercase">COMMAND CENTER</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,211,238,0.10)] border border-[#22D3EE]/30 text-[#22D3EE]">
              UNIDIRECTIONAL ENCLAVE
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5 font-medium">
            Real-time passive network threat intelligence & zero-packet-transmission observation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsStatus === 'connected' ? 'bg-[#22C55E] opacity-75' : 'bg-[#F59E0B] opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsStatus === 'connected' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}></span>
          </span>
          <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase">
            LIVE TELEMETRY {wsStatus === 'connected' ? '● STREAMING' : wsStatus === 'reconnecting' ? '● RECONNECTING' : '● OFFLINE'}
          </span>
        </div>
      </div>

      {/* KPI Row (5 Distinct Security Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Active Flows"
          value={traffic ? traffic.active_flows.toLocaleString() : '0'}
          subtitle="Observed sessions"
          icon={Activity}
          color="cyan"
        />
        <SummaryCard
          title="Traffic Rate"
          value={traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 B/s'}
          subtitle="Ingested throughput"
          icon={Radio}
          color="indigo"
        />
        <SummaryCard
          title="Threats Detected"
          value={alerts.length}
          subtitle="Security findings"
          icon={AlertTriangle}
          color="purple"
        />
        <SummaryCard
          title="High Risk"
          value={`${criticalCount + highCount}`}
          subtitle="Critical + High severity"
          icon={ShieldAlert}
          color="red"
        />
        <SummaryCard
          title="Detection Confidence"
          value={`${avgConfidence.toFixed(1)}%`}
          subtitle="Model F1 confidence"
          icon={Zap}
          color="green"
        />
      </div>

      {/* Main Command Center Grid: 2 Columns (~65% Left / ~35% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left ~65% (8 cols): Live Network Telemetry Chart */}
        <div className="lg:col-span-8 bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 border-b border-[#1C2A45] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 font-sans">
                <Server className="h-4 w-4 text-[#22D3EE]" />
                LIVE NETWORK TELEMETRY
              </h3>
              <p className="text-[11px] font-mono text-[#94A3B8]">Sliding ingress packet volume stream over time</p>
            </div>
            <div className="flex items-center space-x-2 font-mono text-[10px]">
              <span className="px-2 py-1 rounded bg-[#050816] border border-[#1C2A45] text-[#94A3B8]">
                60 POINT WINDOW
              </span>
              <span className="px-2 py-1 rounded bg-[rgba(34,197,94,0.12)] border border-[#22C55E]/30 text-[#22C55E] font-bold">
                ● STREAMING
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="tcpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="udpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#080D1C', borderColor: '#1C2A45', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="tcp_packets" stroke="#22D3EE" strokeWidth={2} fillOpacity={1} fill="url(#tcpGrad)" name="TCP Packets (Cyan)" />
                  <Area type="monotone" dataKey="udp_packets" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#udpGrad)" name="UDP Packets (Indigo)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#64748B] text-xs font-mono border border-dashed border-[#1C2A45] rounded-lg p-6 bg-[#050816]">
                <Radio className="h-8 w-8 text-[#64748B] mb-2 animate-pulse" />
                <span className="font-bold text-[#CBD5E1]">WAITING FOR TELEMETRY</span>
                <span className="text-[11px] text-[#64748B] mt-1">Passive traffic stream has not received observations yet. Launch a scenario in Demo Lab.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right ~35% (4 cols): Real-Time Threat Activity Feed */}
        <div className="lg:col-span-4 bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg flex flex-col h-[340px]">
          <div className="flex justify-between items-center mb-3 border-b border-[#1C2A45] pb-2 shrink-0">
            <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 font-sans">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
              THREAT ACTIVITY FEED
            </h3>
            <span className="text-[10px] font-mono text-[#22D3EE] font-bold bg-[rgba(34,211,238,0.10)] border border-[#22D3EE]/30 px-2 py-0.5 rounded">
              REAL-TIME
            </span>
          </div>

          <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#64748B] text-xs font-mono">
                <CheckCircle2 className="h-6 w-6 text-[#22C55E] mb-2" />
                <span className="font-bold text-[#CBD5E1]">NO ACTIVE THREATS</span>
                <span className="text-[10px] text-[#64748B] mt-0.5">Monitoring passive telemetry...</span>
              </div>
            ) : (
              alerts.slice(0, 15).map((a) => (
                <div
                  key={a.alert_id}
                  onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                  className={`p-2.5 rounded-lg bg-[#050816] border transition-colors cursor-pointer space-y-1 font-mono text-xs ${
                    a.severity === 'CRITICAL' ? 'border-l-4 border-l-[#DC2626] border-[#1C2A45] hover:border-[#DC2626]' :
                    a.severity === 'HIGH' ? 'border-l-4 border-l-[#EF4444] border-[#1C2A45] hover:border-[#EF4444]' :
                    a.severity === 'MEDIUM' ? 'border-l-4 border-l-[#F59E0B] border-[#1C2A45] hover:border-[#F59E0B]' :
                    'border-l-4 border-l-[#22D3EE] border-[#1C2A45] hover:border-[#22D3EE]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      a.severity === 'CRITICAL' ? 'bg-[rgba(220,38,38,0.15)] text-[#DC2626] border border-[#DC2626]/30' :
                      a.severity === 'HIGH' ? 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[#EF4444]/30' :
                      a.severity === 'MEDIUM' ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[#F59E0B]/30' :
                      'bg-[rgba(34,211,238,0.15)] text-[#22D3EE] border border-[#22D3EE]/30'
                    }`}>
                      {a.severity}
                    </span>
                    <span className="font-bold text-[#F8FAFC] truncate max-w-[140px]">{a.threat_class}</span>
                    <span className="text-[10px] text-[#64748B]">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-0.5">
                    <span>{a.source_ip} → {a.destination_ip || '192.168.1.1'}</span>
                    <span className="text-[#22D3EE] font-bold">{(a.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Detection Pipeline Horizontal Visualization */}
      <DetectionPipeline />

      {/* Threat Distribution & Severity Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat Distribution Chart (2 cols) */}
        <div className="lg:col-span-2 bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-[#F8FAFC] mb-4 flex items-center gap-2 border-b border-[#1C2A45] pb-3 font-sans">
            <BarChart3 className="h-4 w-4 text-[#A855F7]" />
            THREAT VECTOR DISTRIBUTION
          </h3>
          <div className="h-56 w-full">
            {alerts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <YAxis dataKey="name" type="category" stroke="#CBD5E1" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#080D1C', borderColor: '#1C2A45', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'JetBrains Mono' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {threatChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#64748B] text-xs font-mono">
                No active threat alerts detected in current monitoring window.
              </div>
            )}
          </div>
        </div>

        {/* Severity Breakdown Card (1 col) */}
        <div className="bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC] mb-4 flex items-center gap-2 border-b border-[#1C2A45] pb-3 font-sans">
              <PieChart className="h-4 w-4 text-[#6366F1]" />
              SEVERITY BREAKDOWN
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#DC2626]">CRITICAL</span>
                  <span className="text-[#F8FAFC] font-bold">{criticalCount}</span>
                </div>
                <div className="w-full bg-[#050816] h-2 rounded-full overflow-hidden border border-[#1C2A45]">
                  <div className="bg-[#DC2626] h-2 rounded-full" style={{ width: `${alerts.length ? (criticalCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#EF4444]">HIGH</span>
                  <span className="text-[#F8FAFC] font-bold">{highCount}</span>
                </div>
                <div className="w-full bg-[#050816] h-2 rounded-full overflow-hidden border border-[#1C2A45]">
                  <div className="bg-[#EF4444] h-2 rounded-full" style={{ width: `${alerts.length ? (highCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#F59E0B]">MEDIUM</span>
                  <span className="text-[#F8FAFC] font-bold">{mediumCount}</span>
                </div>
                <div className="w-full bg-[#050816] h-2 rounded-full overflow-hidden border border-[#1C2A45]">
                  <div className="bg-[#F59E0B] h-2 rounded-full" style={{ width: `${alerts.length ? (mediumCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#22D3EE]">LOW / INFO</span>
                  <span className="text-[#F8FAFC] font-bold">{lowCount}</span>
                </div>
                <div className="w-full bg-[#050816] h-2 rounded-full overflow-hidden border border-[#1C2A45]">
                  <div className="bg-[#22D3EE] h-2 rounded-full" style={{ width: `${alerts.length ? (lowCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#050816] border border-[#1C2A45] rounded-lg text-[11px] text-[#94A3B8] font-mono">
            <span className="font-bold text-[#22D3EE]">Enclave Note:</span> Risk scores are normalized anomaly metrics derived from hybrid statistical rules and Random Forest inference.
          </div>
        </div>
      </div>

      {/* Passive Security Architecture Enclave Card */}
      <PassiveEnclaveCard />

      {/* Recent Detection Findings Table */}
      <div className="bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-[#1C2A45] pb-3">
          <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight font-mono uppercase">
            RECENT PASSIVE DETECTION FINDINGS
          </h3>
          <button
            onClick={() => navigate('/alerts')}
            className="text-xs font-mono font-semibold text-[#22D3EE] hover:underline flex items-center gap-1 cursor-pointer"
          >
            View Incident Table <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-10 text-[#64748B] font-mono text-xs border border-dashed border-[#1C2A45] rounded-lg bg-[#050816]">
            No active threat alerts recorded in current window. Passive observation system operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-[#CBD5E1]">
              <thead className="bg-[#050816] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#1C2A45]">
                <tr>
                  <th className="py-3 px-3">Alert ID</th>
                  <th className="py-3 px-3">Threat Class</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Source IP → Destination IP</th>
                  <th className="py-3 px-3">Risk Score</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2A45]">
                {alerts.slice(0, 10).map((a) => {
                  const riskVal = a.evidence && a.evidence.risk_score ? a.evidence.risk_score : 0.85;
                  return (
                    <tr
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className="hover:bg-[#111B32] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-[#22D3EE]">{a.alert_id}</td>
                      <td className="py-3 px-3 font-semibold text-[#F8FAFC]">{a.threat_class}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.severity === 'CRITICAL' ? 'bg-[rgba(220,38,38,0.15)] text-[#DC2626] border border-[#DC2626]/30' :
                          a.severity === 'HIGH' ? 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[#EF4444]/30' :
                          a.severity === 'MEDIUM' ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[#F59E0B]/30' :
                          'bg-[rgba(34,211,238,0.15)] text-[#22D3EE] border border-[#22D3EE]/30'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#CBD5E1]">
                        {a.source_ip} → {a.destination_ip || '192.168.1.1'}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#F59E0B]">
                        {riskVal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-[#94A3B8]">
                        {(a.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[11px] font-semibold text-[#22D3EE] hover:underline">Inspect →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
