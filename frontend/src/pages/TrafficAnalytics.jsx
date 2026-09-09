import React, { useEffect, useState } from 'react';
import { fetchCurrentTraffic, fetchHistoricalTraffic, formatThroughput, formatBytes } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import { PieChart, BarChart3, Server, Radio, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function TrafficAnalytics() {
  const { subscribe } = useWebSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchCurrentTraffic().catch(() => null),
      fetchHistoricalTraffic().catch(() => [])
    ]).then(([trafficData, historyData]) => {
      if (!isMounted) return;
      setTraffic(trafficData);
      setHistory(historyData || []);
      setLoading(false);
    });

    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'traffic_update' || msg.event === 'traffic_update') {
        if (msg.data) setTraffic(msg.data);
      }
      if (msg.type === 'state_reset' || msg.event === 'state_reset' || msg.type === 'traffic_reset' || msg.event === 'traffic_reset') {
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

  const totalProtocolFlows = traffic && traffic.protocol_distribution
    ? Object.values(traffic.protocol_distribution).reduce((a, b) => a + b, 0)
    : 0;

  const tooltipStyle = isDark
    ? { backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }
    : { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#0F172A', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' };

  return (
    <div className="space-y-6 pb-8 font-sans transition-colors">
      {/* Header */}
      <div className="border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight uppercase">
            TRAFFIC INTELLIGENCE & PROTOCOL ANALYTICS
          </h2>
          <Badge type="AI" label="CYBER INTELLIGENCE" />
        </div>
        <p className="text-xs text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark mt-0.5 font-medium">
          Real-time packet rates, byte throughput, and transport layer protocol distributions.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton type="card" count={4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <Skeleton type="card" />
            </div>
            <div className="lg:col-span-7">
              <Skeleton type="card" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-enterprise-primary dark:border-t-enterprise-primaryDark p-4 rounded-xl shadow-card transition-colors">
              <div className="flex justify-between items-center text-enterprise-textMuted dark:text-enterprise-textMutedDark text-xs font-mono mb-2">
                <span>PACKET INGESTION RATE</span>
                <Activity className="h-4 w-4 text-enterprise-primary dark:text-enterprise-primaryDark" />
              </div>
              <p className="text-2xl font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">
                {traffic ? traffic.total_packets_sec.toFixed(1) : '0.0'} <span className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark">pkt/s</span>
              </p>
            </div>

            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-indigo-500 p-4 rounded-xl shadow-card transition-colors">
              <div className="flex justify-between items-center text-enterprise-textMuted dark:text-enterprise-textMutedDark text-xs font-mono mb-2">
                <span>BYTE INGESTION RATE</span>
                <BarChart3 className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">
                {traffic ? formatBytes(traffic.total_bytes_sec) + '/s' : '0 B/s'}
              </p>
            </div>

            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-purple-500 p-4 rounded-xl shadow-card transition-colors">
              <div className="flex justify-between items-center text-enterprise-textMuted dark:text-enterprise-textMutedDark text-xs font-mono mb-2">
                <span>BANDWIDTH THROUGHPUT</span>
                <Radio className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-purple-500">
                {traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 Mbps'}
              </p>
            </div>

            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-emerald-500 p-4 rounded-xl shadow-card transition-colors">
              <div className="flex justify-between items-center text-enterprise-textMuted dark:text-enterprise-textMutedDark text-xs font-mono mb-2">
                <span>ACTIVE MONITORED FLOWS</span>
                <Server className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-mono font-bold text-enterprise-primary dark:text-enterprise-primaryDark">
                {traffic ? traffic.active_flows.toLocaleString() : '0'}
              </p>
            </div>
          </div>

          {/* Protocol Breakdown & Historical Timeline Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Protocol Distribution Card (5 cols) */}
            <div className="lg:col-span-5 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card transition-colors space-y-4">
              <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase font-mono">
                <PieChart className="h-4 w-4 text-purple-500" />
                PROTOCOL DISTRIBUTION BREAKDOWN
              </h3>

              {traffic && traffic.protocol_distribution ? (
                <div className="space-y-3 font-mono text-xs">
                  {Object.entries(traffic.protocol_distribution).map(([proto, count]) => {
                    const pct = totalProtocolFlows > 0 ? ((count / totalProtocolFlows) * 100).toFixed(1) : 0;
                    return (
                      <div key={proto} className="space-y-1.5 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark p-3 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{proto}</span>
                          <span className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark font-mono">{count.toLocaleString()} pkts ({pct}%)</span>
                        </div>
                        <div className="w-full bg-enterprise-border dark:bg-enterprise-borderDark rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="LOADING PROTOCOL TELEMETRY"
                  description="Awaiting protocol breakdown statistics..."
                />
              )}
            </div>

            {/* Live Historical Timeline Chart (7 cols) */}
            <div className="lg:col-span-7 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card transition-colors flex flex-col justify-between">
              <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase font-mono">
                <Server className="h-4 w-4 text-emerald-500" />
                HISTORICAL TRAFFIC RATE TIMELINE
              </h3>

              <div className="h-64 w-full pt-2">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <XAxis dataKey="timestamp" stroke={isDark ? '#6B7280' : '#64748B'} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <YAxis stroke={isDark ? '#6B7280' : '#64748B'} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="tcp_packets" stroke="#3B82F6" strokeWidth={2} fill="#3B82F6" fillOpacity={0.15} name="TCP Packets" />
                      <Area type="monotone" dataKey="udp_packets" stroke="#A855F7" strokeWidth={2} fill="#A855F7" fillOpacity={0.15} name="UDP Packets" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="AWAITING TIMELINE TELEMETRY"
                    description="Historical traffic stream has not received observations yet."
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
