import React, { useEffect, useState } from 'react';
import { fetchCurrentTraffic, fetchHistoricalTraffic, createWebSocketConnection, formatThroughput, formatBytes } from '../services/api';
import { PieChart, BarChart3, Server, Radio, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrafficAnalytics() {
  const [traffic, setTraffic] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchCurrentTraffic().then(setTraffic).catch(console.error);
    fetchHistoricalTraffic().then(setHistory).catch(console.error);

    const ws = createWebSocketConnection((msg) => {
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

    return () => ws.close();
  }, []);

  const totalProtocolFlows = traffic && traffic.protocol_distribution
    ? Object.values(traffic.protocol_distribution).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Traffic Telemetry & Protocol Distribution</h2>
        <p className="text-sm text-slate-400">Passive monitoring stream statistics across transport layer protocols.</p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Packets Ingested / Sec</span>
            <Activity className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{traffic ? traffic.total_packets_sec.toFixed(1) : '0'} pkt/s</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Bytes Ingested / Sec</span>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{traffic ? formatBytes(traffic.total_bytes_sec) + '/s' : '0 B/s'}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Bandwidth Throughput</span>
            <Radio className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400">
            {traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 Mbps'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Active Monitored Flows</span>
            <Server className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-sky-400">{traffic ? traffic.active_flows : '0'}</p>
        </div>
      </div>

      {/* Protocol Breakdown & Live Ingestion Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-sky-400" />
            Protocol Distribution Breakdown
          </h3>
          {traffic && traffic.protocol_distribution ? (
            <div className="space-y-4">
              {Object.entries(traffic.protocol_distribution).map(([proto, count]) => {
                const pct = totalProtocolFlows > 0 ? ((count / totalProtocolFlows) * 100).toFixed(1) : 0;
                return (
                  <div key={proto} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono text-slate-300 font-bold">{proto}</span>
                      <span className="text-slate-400 font-mono">{count} packets ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-sky-400 h-2.5 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">Loading protocol distribution...</div>
          )}
        </div>

        {/* Live Historical Timeline Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-emerald-400" />
            Historical Traffic Rate Timeline
          </h3>
          <div className="h-56 w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Area type="monotone" dataKey="tcp_packets" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} name="TCP Packets" />
                  <Area type="monotone" dataKey="udp_packets" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="UDP Packets" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Awaiting historical traffic timeline telemetry...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
