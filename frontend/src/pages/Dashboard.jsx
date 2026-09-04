import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SummaryCard from '../components/SummaryCard';
import { Activity, AlertTriangle, ShieldAlert, Radio, Server, PieChart, BarChart3, ChevronRight, Bell } from 'lucide-react';
import { fetchHealth, fetchAlerts, fetchCurrentTraffic, fetchHistoricalTraffic, createWebSocketConnection, formatThroughput } from '../services/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    // Initial REST API Snapshot
    fetchAlerts(null, 100).then(setAlerts).catch(console.error);
    fetchCurrentTraffic().then(setTraffic).catch(console.error);
    fetchHistoricalTraffic().then(setHistory).catch(console.error);

    // Live WebSocket Stream
    const ws = createWebSocketConnection(
      (msg) => {
        if (msg.type === 'alert_created' || msg.event === 'alert_created') {
          if (msg.data) {
            setAlerts((prev) => {
              const exists = prev.some(a => a.alert_id === msg.data.alert_id);
              if (exists) return prev;
              return [msg.data, ...prev];
            });

            // Trigger notification toast for high/critical findings
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

  // Threat Class Distribution Count
  const threatCounts = {
    'DDoS': alerts.filter(a => a.threat_class.includes('DDOS')).length,
    'C2 Beacon': alerts.filter(a => a.threat_class.includes('C2')).length,
    'DGA Domain': alerts.filter(a => a.threat_class.includes('DGA')).length,
    'DNS Tunnel': alerts.filter(a => a.threat_class.includes('TUNNEL')).length,
    'Encrypted Malware': alerts.filter(a => a.threat_class.includes('MALWARE') || a.threat_class.includes('TLS')).length,
    'Recon Sweep': alerts.filter(a => a.threat_class.includes('RECON') || a.threat_class.includes('SCAN')).length,
    'Exfiltration': alerts.filter(a => a.threat_class.includes('EXFIL')).length,
  };

  const threatChartData = Object.entries(threatCounts).map(([name, count]) => ({ name, count }));

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastAlert && (
        <div className="bg-red-950 border border-red-500/50 p-4 rounded-xl flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-red-400 animate-pulse" />
            <div>
              <p className="text-xs font-mono text-red-400 font-bold">NEW THREAT ALERT DETECTED</p>
              <p className="text-sm font-semibold text-white">
                [{toastAlert.severity}] {toastAlert.threat_class} from {toastAlert.source_ip}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/alert-details?id=${toastAlert.alert_id}`)}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            Inspect Evidence
          </button>
        </div>
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Security Operations Dashboard</h2>
          <p className="text-sm text-slate-400">Real-time passive threat telemetry & unidirectional IP traffic analytics.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${wsStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">
            {wsStatus === 'connected' ? '● LIVE STREAM' : wsStatus === 'reconnecting' ? '● RECONNECTING' : '● OFFLINE'}
          </span>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <SummaryCard
          title="Active Flows"
          value={traffic ? traffic.active_flows.toLocaleString() : '0'}
          subtitle="Currently observed sessions"
          icon={Activity}
          color="sky"
        />
        <SummaryCard
          title="Total Alerts"
          value={alerts.length}
          subtitle="Detected threat findings"
          icon={AlertTriangle}
          color="amber"
        />
        <SummaryCard
          title="Critical / High"
          value={`${criticalCount} / ${highCount}`}
          subtitle="Action required by SOC analyst"
          icon={ShieldAlert}
          color="red"
        />
        <SummaryCard
          title="Bandwidth"
          value={traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 B/s'}
          subtitle="Ingested traffic throughput"
          icon={Radio}
          color="emerald"
        />
      </div>

      {/* Live Traffic Timeline Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-400" />
            Live Traffic Rate Timeline
          </h3>
          <span className="text-xs font-mono text-slate-400">Bounded 60-Point Window</span>
        </div>
        <div className="h-64 w-full">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="tcpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="udpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Area type="monotone" dataKey="tcp_packets" stroke="#38bdf8" fillOpacity={1} fill="url(#tcpGrad)" name="TCP Packets" />
                <Area type="monotone" dataKey="udp_packets" stroke="#10b981" fillOpacity={1} fill="url(#udpGrad)" name="UDP Packets" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Waiting for live traffic stream...
            </div>
          )}
        </div>
      </div>

      {/* Threat & Severity Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat Distribution Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            Threat Distribution by Class
          </h3>
          <div className="h-56 w-full">
            {alerts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatChartData}>
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {threatChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No active threat alerts detected in current monitoring window.
              </div>
            )}
          </div>
        </div>

        {/* Severity Breakdown Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              Severity Breakdown
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-red-400">CRITICAL</span>
                  <span className="font-mono text-slate-300">{criticalCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${alerts.length ? (criticalCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-rose-400">HIGH</span>
                  <span className="font-mono text-slate-300">{highCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${alerts.length ? (highCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-amber-400">MEDIUM</span>
                  <span className="font-mono text-slate-300">{mediumCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${alerts.length ? (mediumCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-sky-400">LOW / INFO</span>
                  <span className="font-mono text-slate-300">{lowCount}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${alerts.length ? (lowCount / alerts.length) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
            <span className="font-bold text-sky-400">Enclave Note:</span> Risk scores are normalized $[0.0, 1.0]$ heuristic anomaly metrics.
          </div>
        </div>
      </div>

      {/* Recent Detection Findings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Passive Detection Findings</h3>
          <button
            onClick={() => navigate('/alerts')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            View All Alerts <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No active threat alerts detected in current traffic window. System operational.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-3 px-4">Alert ID</th>
                  <th className="py-3 px-4">Threat Class</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Source IP → Destination IP</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alerts.slice(0, 10).map((a) => {
                  const riskVal = a.evidence && a.evidence.risk_score ? a.evidence.risk_score : 0.75;
                  return (
                    <tr
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-sky-400 font-semibold">{a.alert_id}</td>
                      <td className="py-3 px-4 font-semibold text-white">{a.threat_class}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          a.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          a.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          a.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-300">
                        {a.source_ip} → {a.destination_ip || '192.168.1.1'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {riskVal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {(a.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-semibold text-sky-400 hover:underline">Inspect →</span>
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
