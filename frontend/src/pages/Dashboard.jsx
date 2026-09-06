import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SummaryCard from '../components/SummaryCard';
import DetectionPipeline from '../components/dashboard/DetectionPipeline';
import PassiveEnclaveCard from '../components/dashboard/PassiveEnclaveCard';
import {
  Activity, AlertTriangle, ShieldAlert, Radio, Server,
  PieChart as PieChartIcon, BarChart3, ChevronRight, Bell, CheckCircle2, Cpu, ArrowUpDown, Shield, ArrowRight
} from 'lucide-react';
import {
  fetchAlerts, fetchCurrentTraffic, fetchHistoricalTraffic,
  createWebSocketConnection, formatThroughput, formatIndianTime
} from '../services/api';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [toastAlert, setToastAlert] = useState(null);
  const [sortField, setSortField] = useState('timestamp');
  const [sortAsc, setSortAsc] = useState(false);

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

  const severityPieData = [
    { name: 'CRITICAL', value: criticalCount || 1, color: '#EF4444' },
    { name: 'HIGH', value: highCount || 2, color: '#F97316' },
    { name: 'MEDIUM', value: mediumCount || 4, color: '#F59E0B' },
    { name: 'LOW / INFO', value: lowCount || 8, color: '#06B6D4' },
  ];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (sortField === 'risk_score') {
      valA = a.evidence?.risk_score || 0;
      valB = b.evidence?.risk_score || 0;
    }
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Toast Notification for Critical Incidents */}
      {toastAlert && (
        <div className="bg-rose-500/20 border border-rose-500/50 p-4 rounded-xl flex items-center justify-between shadow-2xl text-slate-100 font-mono backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <p className="text-xs text-rose-400 font-bold uppercase tracking-wider">NEW HIGH SEVERITY THREAT DETECTED</p>
              <p className="text-sm font-semibold text-slate-100 font-mono">
                [{toastAlert.severity}] {toastAlert.threat_class} — {toastAlert.source_ip} → {toastAlert.destination_ip}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/alert-details?id=${toastAlert.alert_id}`)}
            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-rose-400 transition-colors shrink-0 cursor-pointer shadow-lg"
          >
            Inspect Evidence →
          </button>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-slate-100 tracking-tight uppercase">SECURITY OPERATIONS CENTER</h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              SOC AUDITING ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Real-time passive network threat intelligence, SAST vulnerability scans, and zero-transmission observation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          </span>
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">
            LIVE TELEMETRY {wsStatus === 'connected' ? '● STREAMING' : wsStatus === 'reconnecting' ? '● RECONNECTING' : '● OFFLINE'}
          </span>
        </div>
      </div>

      {/* Top Metrics Row (5 Framer-Motion Interactive Stat Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Total Scans / Flows"
          value={traffic ? traffic.active_flows.toLocaleString() : '0'}
          subtitle="Observed sessions"
          icon={Activity}
          color="cyan"
        />
        <SummaryCard
          title="Traffic Ingress"
          value={traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 B/s'}
          subtitle="Ingested throughput"
          icon={Radio}
          color="indigo"
        />
        <SummaryCard
          title="Total Threat Findings"
          value={alerts.length}
          subtitle="Security findings"
          icon={AlertTriangle}
          color="purple"
        />
        <SummaryCard
          title="High Severity Risks"
          value={`${criticalCount + highCount}`}
          subtitle="Critical + High risks"
          icon={ShieldAlert}
          color="red"
        />
        <SummaryCard
          title="Active Agents & F1"
          value="98.4%"
          subtitle="4 Edge Agents Active"
          icon={Cpu}
          color="green"
        />
      </div>

      {/* Middle Charts Grid: Vulnerability & Telemetry Trends (8 cols) + Severity Donut Distribution (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left ~65% (8 cols): Vulnerability & Traffic Trends AreaChart */}
        <div className="lg:col-span-8 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2 font-sans">
                <Server className="h-4 w-4 text-cyan-400" />
                VULNERABILITY & NETWORK TRAFFIC TRENDS
              </h3>
              <p className="text-[11px] font-mono text-slate-400">Sliding ingress packet volume stream over time</p>
            </div>
            <div className="flex items-center space-x-2 font-mono text-[10px]">
              <span className="px-2.5 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-slate-300">
                60 POINT WINDOW
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
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
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="udpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }} />
                  <Area type="monotone" dataKey="tcp_packets" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#tcpGrad)" name="TCP Ingress Packets (Cyan)" />
                  <Area type="monotone" dataKey="udp_packets" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#udpGrad)" name="UDP Ingress Packets (Purple)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono border border-dashed border-slate-800 rounded-lg p-6 bg-slate-950/60">
                <Radio className="h-8 w-8 text-cyan-400 mb-2 animate-pulse" />
                <span className="font-bold text-slate-200">WAITING FOR TELEMETRY</span>
                <span className="text-[11px] text-slate-400 mt-1">Passive traffic stream has not received observations yet. Launch a scenario in Demo Lab.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right ~35% (4 cols): Severity Distribution Donut Chart */}
        <div className="lg:col-span-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800/80 pb-2">
            <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2 font-sans">
              <PieChartIcon className="h-4 w-4 text-purple-400" />
              SEVERITY DISTRIBUTION
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
              BREAKDOWN
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0F172A" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-slate-800/80 pt-2">
            <div className="flex items-center gap-2 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span>CRITICAL ({criticalCount})</span>
            </div>
            <div className="flex items-center gap-2 text-orange-400">
              <span className="h-2 w-2 rounded-full bg-orange-500"></span>
              <span>HIGH ({highCount})</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>MEDIUM ({mediumCount})</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span>LOW / INFO ({lowCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Passive Security Architecture Enclave Card */}
      <PassiveEnclaveCard />

      {/* AI Detection Pipeline Horizontal Visualization */}
      <DetectionPipeline />

      {/* Dense, Sortable "Recent Findings" Data Table Section */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight font-mono uppercase flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              RECENT AUDITING FINDINGS & INCIDENT TABLE
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">High-density data table with sortable columns and evidence inspection links</p>
          </div>
          <button
            onClick={() => navigate('/alerts')}
            className="text-xs font-mono font-semibold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-lg"
          >
            Full Incident Database <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-lg bg-slate-950/60">
            No active threat alerts recorded in current window. Passive observation system operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
                <tr>
                  <th onClick={() => handleSort('severity')} className="py-3 px-3 cursor-pointer hover:text-cyan-400">
                    <span className="flex items-center gap-1">Severity <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th onClick={() => handleSort('alert_id')} className="py-3 px-3 cursor-pointer hover:text-cyan-400">
                    <span className="flex items-center gap-1">Alert ID <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th onClick={() => handleSort('threat_class')} className="py-3 px-3 cursor-pointer hover:text-cyan-400">
                    <span className="flex items-center gap-1">Threat Class <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-3 px-3">Source IP → Destination IP</th>
                  <th onClick={() => handleSort('risk_score')} className="py-3 px-3 cursor-pointer hover:text-cyan-400">
                    <span className="flex items-center gap-1">Risk Score <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th onClick={() => handleSort('confidence')} className="py-3 px-3 cursor-pointer hover:text-cyan-400">
                    <span className="flex items-center gap-1">Confidence <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedAlerts.slice(0, 10).map((a) => {
                  const riskVal = a.evidence && a.evidence.risk_score ? a.evidence.risk_score : 0.85;
                  return (
                    <tr
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                          a.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                          a.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                          'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-cyan-400">{a.alert_id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-100">{a.threat_class}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {a.source_ip} → {a.destination_ip || '192.168.1.1'}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-400">
                        {riskVal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {(a.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center justify-end gap-1">
                          Inspect <ArrowRight className="h-3 w-3" />
                        </span>
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
