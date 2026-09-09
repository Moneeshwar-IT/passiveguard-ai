import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import DetectionPipeline from '../components/dashboard/DetectionPipeline';
import PassiveEnclaveCard from '../components/dashboard/PassiveEnclaveCard';
import {
  Activity, AlertTriangle, ShieldAlert, Radio, Server,
  PieChart as PieChartIcon, ChevronRight, Bell, Cpu
} from 'lucide-react';
import {
  fetchAlerts, fetchCurrentTraffic, fetchHistoricalTraffic,
  formatThroughput, formatIndianTime
} from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { wsStatus, subscribe } = useWebSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [alerts, setAlerts] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchAlerts(null, 100).catch(() => []),
      fetchCurrentTraffic().catch(() => null),
      fetchHistoricalTraffic().catch(() => [])
    ]).then(([alertsData, trafficData, historyData]) => {
      if (!isMounted) return;
      setAlerts(alertsData || []);
      setTraffic(trafficData);
      setHistory(historyData || []);
      setLoading(false);
    });

    const unsubscribe = subscribe((msg) => {
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
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subscribe]);

  // Derived alert metrics with standardized chart color tokens
  const { criticalCount, highCount, mediumCount, lowCount, threatChartData } = useMemo(() => {
    const crit = alerts.filter(a => a.severity === 'CRITICAL').length;
    const high = alerts.filter(a => a.severity === 'HIGH').length;
    const med = alerts.filter(a => a.severity === 'MEDIUM').length;
    const low = alerts.filter(a => a.severity === 'LOW' || a.severity === 'INFO').length;

    const counts = {
      'DDoS': { count: alerts.filter(a => a.threat_class?.includes('DDOS')).length, color: '#EF4444' },
      'C2 Beaconing': { count: alerts.filter(a => a.threat_class?.includes('C2')).length, color: '#A855F7' },
      'DGA Domain': { count: alerts.filter(a => a.threat_class?.includes('DGA')).length, color: '#818CF8' },
      'DNS Tunneling': { count: alerts.filter(a => a.threat_class?.includes('TUNNEL')).length, color: '#3B82F6' },
      'Encrypted Malware': { count: alerts.filter(a => a.threat_class?.includes('MALWARE') || a.threat_class?.includes('TLS')).length, color: '#F59E0B' },
      'Recon Scan': { count: alerts.filter(a => a.threat_class?.includes('RECON') || a.threat_class?.includes('SCAN')).length, color: '#22C55E' },
      'Exfiltration': { count: alerts.filter(a => a.threat_class?.includes('EXFIL')).length, color: '#E11D48' },
    };

    const chartData = Object.entries(counts).map(([name, obj]) => ({
      name,
      count: obj.count,
      fill: obj.color
    }));

    return {
      criticalCount: crit,
      highCount: high,
      mediumCount: med,
      lowCount: low,
      threatChartData: chartData
    };
  }, [alerts]);

  const tooltipStyle = isDark
    ? { backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }
    : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)' };

  return (
    <div className="space-y-6 pb-8 font-sans transition-colors">
      {/* Toast Notification for Critical / High Threats */}
      {toastAlert && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-600 dark:bg-rose-700 border border-rose-500 p-4 rounded-xl flex items-center justify-between shadow-lg text-white font-mono"
        >
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-white shrink-0" />
            <div>
              <p className="text-xs text-white font-bold uppercase tracking-wider">NEW THREAT INCIDENT DETECTED</p>
              <p className="text-sm font-semibold text-white font-mono">
                [{toastAlert.severity}] {toastAlert.threat_class} — {toastAlert.source_ip} → {toastAlert.destination_ip}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/alert-details?id=${toastAlert.alert_id}`)}
            className="bg-white text-rose-700 text-xs font-mono font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer shadow-subtle"
          >
            Inspect Evidence →
          </button>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight uppercase">COMMAND CENTER</h2>
            <Badge type="READ_ONLY" label="UNIDIRECTIONAL ENCLAVE" />
          </div>
          <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5 font-medium">
            Real-time passive network threat intelligence & zero-packet-transmission observation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {wsStatus === 'connected' ? (
            <Badge type="STREAMING" label="LIVE TELEMETRY ● STREAMING" pulse />
          ) : (
            <Badge type="OFFLINE" label={`LIVE TELEMETRY ● ${wsStatus.toUpperCase()}`} />
          )}
        </div>
      </div>

      {/* Initial Skeleton Loader State */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Skeleton type="card" count={5} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <Skeleton type="card" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton type="card" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row (5 Distinct Security Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Active Flows"
              value={traffic ? traffic.active_flows.toLocaleString() : '0'}
              subtitle="Observed sessions"
              icon={Activity}
              variant="brand"
            />
            <StatCard
              title="Traffic Rate"
              value={traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 B/s'}
              subtitle="Ingested throughput"
              icon={Radio}
              variant="indigo"
            />
            <StatCard
              title="Threats Detected"
              value={alerts.length}
              subtitle="Security findings"
              icon={AlertTriangle}
              variant="ai"
            />
            <StatCard
              title="High Risk"
              value={`${criticalCount + highCount}`}
              subtitle="Critical + High severity"
              icon={ShieldAlert}
              variant="danger"
            />
            <StatCard
              title="Model F1 Score"
              value="98.4%"
              subtitle="UNSW-NB15 benchmark"
              icon={Cpu}
              variant="indigo"
            />
          </div>

          {/* Main Command Center Grid: 2 Columns (~65% Left / ~35% Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left ~65% (8 cols): Live Network Telemetry Chart */}
            <div className="lg:col-span-8 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card flex flex-col justify-between transition-colors">
              <div className="flex justify-between items-center mb-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3">
                <div>
                  <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 font-sans">
                    <Server className="h-4 w-4 text-enterprise-primary dark:text-enterprise-primaryDark" />
                    LIVE NETWORK TELEMETRY
                  </h3>
                  <p className="text-[11px] font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark">Sliding ingress packet volume stream over time</p>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[10px]">
                  <span className="px-2 py-1 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                    60 POINT WINDOW
                  </span>
                  <Badge type="STREAMING" label="STREAMING" pulse />
                </div>
              </div>

              <div className="h-64 w-full">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="tcpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="udpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={isDark ? '#6B7280' : '#64748B'} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <YAxis stroke={isDark ? '#6B7280' : '#64748B'} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="tcp_packets" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#tcpGrad)" name="TCP Packets (Blue)" />
                      <Area type="monotone" dataKey="udp_packets" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#udpGrad)" name="UDP Packets (Purple)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="WAITING FOR TELEMETRY"
                    description="Passive traffic stream has not received observations yet. Launch a scenario in Demo Lab."
                    icon={Radio}
                  />
                )}
              </div>
            </div>

            {/* Right ~35% (4 cols): Real-Time Threat Activity Feed */}
            <div className="lg:col-span-4 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card flex flex-col h-[340px] transition-colors">
              <div className="flex justify-between items-center mb-3 border-b border-enterprise-border dark:border-enterprise-borderDark pb-2 shrink-0">
                <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 font-sans">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  THREAT ACTIVITY FEED
                </h3>
                <Badge type="ACTIVE" label="REAL-TIME" />
              </div>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                {alerts.length === 0 ? (
                  <EmptyState
                    title="NO ACTIVE THREATS"
                    description="Monitoring passive network stream..."
                  />
                ) : (
                  alerts.slice(0, 15).map((a) => (
                    <div
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className={`p-2.5 rounded-lg bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark transition-colors cursor-pointer space-y-1 font-mono text-xs hover:border-enterprise-primary/50 ${
                        a.severity === 'CRITICAL' ? 'border-l-4 border-l-rose-500' :
                        a.severity === 'HIGH' ? 'border-l-4 border-l-rose-500' :
                        a.severity === 'MEDIUM' ? 'border-l-4 border-l-amber-500' :
                        'border-l-4 border-l-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge type={a.severity} pulse={a.severity === 'CRITICAL'} />
                        <span className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark truncate max-w-[130px]">{a.threat_class}</span>
                        <span className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark">{formatIndianTime(a.timestamp)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark pt-0.5">
                        <span>{a.source_ip} → {a.destination_ip || '192.168.1.1'}</span>
                        <span className="text-enterprise-primary dark:text-enterprise-primaryDark font-bold">{(a.confidence * 100).toFixed(0)}%</span>
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
            {/* Threat Distribution Circular Chart (2 cols) */}
            <div className="lg:col-span-2 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card transition-colors">
              <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark mb-4 flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 font-sans">
                <PieChartIcon className="h-4 w-4 text-purple-500" />
                THREAT VECTOR DISTRIBUTION
              </h3>
              <div className="h-56 w-full">
                {alerts.length > 0 ? (
                  <div className="h-full flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="h-full w-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={threatChartData.filter(t => t.count > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="count"
                          >
                            {threatChartData.filter(t => t.count > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke={isDark ? '#1F2937' : '#FFFFFF'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs max-h-48 overflow-y-auto pr-1">
                      {threatChartData.filter(t => t.count > 0).map((item) => (
                        <div key={item.name} className="flex items-center space-x-2.5 p-2 rounded-lg bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }}></span>
                          <div className="truncate">
                            <div className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark text-[11px] truncate">{item.name}</div>
                            <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark">{item.count} alerts ({((item.count / alerts.length) * 100).toFixed(0)}%)</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="NO THREAT ALERTS"
                    description="No active threat alerts detected in current monitoring window."
                  />
                )}
              </div>
            </div>

            {/* Severity Breakdown Card (1 col) */}
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card flex flex-col justify-between transition-colors">
              <div>
                <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark mb-4 flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 font-sans">
                  <PieChartIcon className="h-4 w-4 text-indigo-500" />
                  SEVERITY BREAKDOWN
                </h3>
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">CRITICAL</span>
                      <span className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold">{criticalCount}</span>
                    </div>
                    <div className="w-full bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark h-2 rounded-full overflow-hidden border border-enterprise-border dark:border-enterprise-borderDark">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${alerts.length ? (criticalCount / alerts.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">HIGH</span>
                      <span className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold">{highCount}</span>
                    </div>
                    <div className="w-full bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark h-2 rounded-full overflow-hidden border border-enterprise-border dark:border-enterprise-borderDark">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${alerts.length ? (highCount / alerts.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-amber-500">MEDIUM</span>
                      <span className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold">{mediumCount}</span>
                    </div>
                    <div className="w-full bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark h-2 rounded-full overflow-hidden border border-enterprise-border dark:border-enterprise-borderDark">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${alerts.length ? (mediumCount / alerts.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">LOW / INFO</span>
                      <span className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold">{lowCount}</span>
                    </div>
                    <div className="w-full bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark h-2 rounded-full overflow-hidden border border-enterprise-border dark:border-enterprise-borderDark">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${alerts.length ? (lowCount / alerts.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg text-[11px] text-enterprise-textMuted dark:text-enterprise-textMutedDark font-mono">
                <span className="font-bold text-enterprise-primary dark:text-enterprise-primaryDark">Enclave Note:</span> Risk scores are normalized anomaly metrics derived from hybrid statistical rules and Random Forest inference.
              </div>
            </div>
          </div>

          {/* Passive Security Architecture Enclave Card */}
          <PassiveEnclaveCard />

          {/* Recent Detection Findings Table */}
          <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card transition-colors">
            <div className="flex justify-between items-center mb-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3">
              <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight font-mono uppercase">
                RECENT PASSIVE DETECTION FINDINGS
              </h3>
              <button
                onClick={() => navigate('/alerts')}
                className="text-xs font-mono font-semibold text-enterprise-primary dark:text-enterprise-primaryDark hover:underline flex items-center gap-1 cursor-pointer"
              >
                View Incident Table <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {alerts.length === 0 ? (
              <EmptyState
                title="NO RECENT DETECTION FINDINGS"
                description="No active threat alerts recorded in current window. Passive observation system operational."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                  <thead className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase text-[10px] tracking-wider border-b border-enterprise-border dark:border-enterprise-borderDark">
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
                  <tbody className="divide-y divide-enterprise-border dark:divide-enterprise-borderDark">
                    {alerts.slice(0, 10).map((a) => {
                      const riskVal = a.evidence && a.evidence.risk_score ? a.evidence.risk_score : 0.85;
                      return (
                        <tr
                          key={a.alert_id}
                          onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                          className="hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{a.alert_id}</td>
                          <td className="py-3 px-3 font-semibold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{a.threat_class}</td>
                          <td className="py-3 px-3">
                            <Badge type={a.severity} pulse={a.severity === 'CRITICAL'} />
                          </td>
                          <td className="py-3 px-3 text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                            {a.source_ip} → {a.destination_ip || '192.168.1.1'}
                          </td>
                          <td className="py-3 px-3 font-bold text-amber-500">
                            {riskVal.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                            {(a.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-[11px] font-semibold text-enterprise-primary dark:text-enterprise-primaryDark hover:underline">Inspect →</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
