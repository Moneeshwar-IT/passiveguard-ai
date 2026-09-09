import React, { useEffect, useState } from 'react';
import { fetchCurrentTraffic, fetchHistoricalTraffic, formatThroughput, formatBytes } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { PieChart, BarChart3, Server, Radio, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrafficAnalytics() {
  const { subscribe } = useWebSocket();
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

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Header */}
      <div className="border-b border-soc-border pb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold font-mono text-soc-textPrimary tracking-tight uppercase">
            TRAFFIC INTELLIGENCE & PROTOCOL ANALYTICS
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ai-50 border border-ai-200 text-ai">
            CYBER INTELLIGENCE
          </span>
        </div>
        <p className="text-xs text-soc-textSecondary mt-0.5 font-medium">
          Real-time packet rates, byte throughput, and transport layer protocol distributions.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6 font-mono text-xs text-soc-textMuted">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-soc-surface border border-soc-border rounded-xl p-4 h-24 animate-pulse">
                <div className="h-3 bg-soc-border rounded w-1/2 mb-3"></div>
                <div className="h-6 bg-soc-border rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="h-64 bg-soc-surface border border-soc-border rounded-xl animate-pulse p-6">
            <div className="h-4 bg-soc-border rounded w-1/4 mb-4"></div>
            <div className="h-44 bg-soc-surfaceSubtle rounded"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-brand p-4 rounded-xl shadow-card hover:shadow-cardHover transition-all">
              <div className="flex justify-between items-center text-soc-textMuted text-xs font-mono mb-2">
                <span>PACKET INGESTION RATE</span>
                <Activity className="h-4 w-4 text-brand" />
              </div>
              <p className="text-2xl font-mono font-bold text-soc-textPrimary">
                {traffic ? traffic.total_packets_sec.toFixed(1) : '0.0'} <span className="text-xs text-soc-textMuted">pkt/s</span>
              </p>
            </div>

            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-indigoAcc p-4 rounded-xl shadow-card hover:shadow-cardHover transition-all">
              <div className="flex justify-between items-center text-soc-textMuted text-xs font-mono mb-2">
                <span>BYTE INGESTION RATE</span>
                <BarChart3 className="h-4 w-4 text-indigoAcc" />
              </div>
              <p className="text-2xl font-mono font-bold text-soc-textPrimary">
                {traffic ? formatBytes(traffic.total_bytes_sec) + '/s' : '0 B/s'}
              </p>
            </div>

            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-ai p-4 rounded-xl shadow-card hover:shadow-cardHover transition-all">
              <div className="flex justify-between items-center text-soc-textMuted text-xs font-mono mb-2">
                <span>BANDWIDTH THROUGHPUT</span>
                <Radio className="h-4 w-4 text-ai" />
              </div>
              <p className="text-2xl font-mono font-bold text-ai">
                {traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 Mbps'}
              </p>
            </div>

            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-success p-4 rounded-xl shadow-card hover:shadow-cardHover transition-all">
              <div className="flex justify-between items-center text-soc-textMuted text-xs font-mono mb-2">
                <span>ACTIVE MONITORED FLOWS</span>
                <Server className="h-4 w-4 text-success" />
              </div>
              <p className="text-2xl font-mono font-bold text-brand">
                {traffic ? traffic.active_flows.toLocaleString() : '0'}
              </p>
            </div>
          </div>

          {/* Protocol Breakdown & Historical Timeline Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Protocol Distribution Card (5 cols) */}
            <div className="lg:col-span-5 bg-soc-surface border border-soc-border rounded-xl p-5 shadow-card hover:shadow-cardHover transition-all space-y-4">
              <h3 className="text-sm font-bold text-soc-textPrimary tracking-tight flex items-center gap-2 border-b border-soc-border pb-3 uppercase font-mono">
                <PieChart className="h-4 w-4 text-ai" />
                PROTOCOL DISTRIBUTION BREAKDOWN
              </h3>

              {traffic && traffic.protocol_distribution ? (
                <div className="space-y-3 font-mono text-xs">
                  {Object.entries(traffic.protocol_distribution).map(([proto, count]) => {
                    const pct = totalProtocolFlows > 0 ? ((count / totalProtocolFlows) * 100).toFixed(1) : 0;
                    return (
                      <div key={proto} className="space-y-1.5 bg-soc-surfaceSubtle p-3 rounded-lg border border-soc-border">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-brand">{proto}</span>
                          <span className="text-soc-textTechnical font-mono">{count.toLocaleString()} pkts ({pct}%)</span>
                        </div>
                        <div className="w-full bg-soc-border rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigoAcc h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-soc-textMuted font-mono text-xs py-8 text-center bg-soc-surfaceSubtle rounded-lg border border-dashed border-soc-border">
                  Loading protocol distribution telemetry...
                </div>
              )}
            </div>

            {/* Live Historical Timeline Chart (7 cols) */}
            <div className="lg:col-span-7 bg-soc-surface border border-soc-border rounded-xl p-5 shadow-card hover:shadow-cardHover transition-all flex flex-col justify-between">
              <h3 className="text-sm font-bold text-soc-textPrimary tracking-tight flex items-center gap-2 border-b border-soc-border pb-3 uppercase font-mono">
                <Server className="h-4 w-4 text-success" />
                HISTORICAL TRAFFIC RATE TIMELINE
              </h3>

              <div className="h-64 w-full pt-2">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <XAxis dataKey="timestamp" stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <YAxis stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#0F172A', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }} />
                      <Area type="monotone" dataKey="tcp_packets" stroke="#2563EB" strokeWidth={2} fill="#2563EB" fillOpacity={0.12} name="TCP Packets" />
                      <Area type="monotone" dataKey="udp_packets" stroke="#7C3AED" strokeWidth={2} fill="#7C3AED" fillOpacity={0.12} name="UDP Packets" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-soc-textMuted text-xs font-mono border border-dashed border-soc-border bg-soc-surfaceSubtle rounded-lg">
                    Awaiting historical traffic timeline telemetry...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
