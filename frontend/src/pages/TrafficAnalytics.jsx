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
    <div className="space-y-6 pb-8 font-sans">
      {/* Header */}
      <div className="border-b border-[#1C2A45] pb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold font-mono text-[#F8FAFC] tracking-tight uppercase">
            TRAFFIC INTELLIGENCE & PROTOCOL ANALYTICS
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(168,85,247,0.12)] border border-[#A855F7]/30 text-[#A855F7]">
            CYBER INTELLIGENCE
          </span>
        </div>
        <p className="text-xs text-[#94A3B8] mt-0.5 font-medium">
          Real-time packet rates, byte throughput, and transport layer protocol distributions.
        </p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1426] border border-[#1C2A45] border-t-4 border-t-[#22D3EE] p-4 rounded-xl shadow-xs hover:shadow-sm transition-all">
          <div className="flex justify-between items-center text-[#94A3B8] text-xs font-mono mb-2">
            <span>PACKET INGESTION RATE</span>
            <Activity className="h-4 w-4 text-[#22D3EE]" />
          </div>
          <p className="text-2xl font-mono font-bold text-[#F8FAFC]">
            {traffic ? traffic.total_packets_sec.toFixed(1) : '0.0'} <span className="text-xs text-[#94A3B8]">pkt/s</span>
          </p>
        </div>

        <div className="bg-[#0D1426] border border-[#1C2A45] border-t-4 border-t-[#6366F1] p-4 rounded-xl shadow-xs hover:shadow-sm transition-all">
          <div className="flex justify-between items-center text-[#94A3B8] text-xs font-mono mb-2">
            <span>BYTE INGESTION RATE</span>
            <BarChart3 className="h-4 w-4 text-[#6366F1]" />
          </div>
          <p className="text-2xl font-mono font-bold text-[#F8FAFC]">
            {traffic ? formatBytes(traffic.total_bytes_sec) + '/s' : '0 B/s'}
          </p>
        </div>

        <div className="bg-[#0D1426] border border-[#1C2A45] border-t-4 border-t-[#A855F7] p-4 rounded-xl shadow-xs hover:shadow-sm transition-all">
          <div className="flex justify-between items-center text-[#94A3B8] text-xs font-mono mb-2">
            <span>BANDWIDTH THROUGHPUT</span>
            <Radio className="h-4 w-4 text-[#A855F7]" />
          </div>
          <p className="text-2xl font-mono font-bold text-[#A855F7]">
            {traffic ? (traffic.bandwidth_mbps ? `${traffic.bandwidth_mbps} Mbps` : formatThroughput(traffic.total_bytes_sec)) : '0 Mbps'}
          </p>
        </div>

        <div className="bg-[#0D1426] border border-[#1C2A45] border-t-4 border-t-[#22C55E] p-4 rounded-xl shadow-xs hover:shadow-sm transition-all">
          <div className="flex justify-between items-center text-[#94A3B8] text-xs font-mono mb-2">
            <span>ACTIVE MONITORED FLOWS</span>
            <Server className="h-4 w-4 text-[#22C55E]" />
          </div>
          <p className="text-2xl font-mono font-bold text-[#22D3EE]">
            {traffic ? traffic.active_flows.toLocaleString() : '0'}
          </p>
        </div>
      </div>

      {/* Protocol Breakdown & Historical Timeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Protocol Distribution Card (5 cols) */}
        <div className="lg:col-span-5 bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-xs hover:shadow-sm transition-all space-y-4">
          <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 border-b border-[#1C2A45] pb-3 uppercase font-mono">
            <PieChart className="h-4 w-4 text-[#A855F7]" />
            PROTOCOL DISTRIBUTION BREAKDOWN
          </h3>

          {traffic && traffic.protocol_distribution ? (
            <div className="space-y-3 font-mono text-xs">
              {Object.entries(traffic.protocol_distribution).map(([proto, count]) => {
                const pct = totalProtocolFlows > 0 ? ((count / totalProtocolFlows) * 100).toFixed(1) : 0;
                return (
                  <div key={proto} className="space-y-1.5 bg-[#080D1C] p-3 rounded-lg border border-[#1C2A45]">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#22D3EE]">{proto}</span>
                      <span className="text-[#CBD5E1] font-mono">{count.toLocaleString()} pkts ({pct}%)</span>
                    </div>
                    <div className="w-full bg-[#050816] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#6366F1] h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[#94A3B8] font-mono text-xs py-8 text-center bg-[#080D1C] rounded-lg border border-dashed border-[#1C2A45]">
              Loading protocol distribution telemetry...
            </div>
          )}
        </div>

        {/* Live Historical Timeline Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 border-b border-[#1C2A45] pb-3 uppercase font-mono">
            <Server className="h-4 w-4 text-[#22C55E]" />
            HISTORICAL TRAFFIC RATE TIMELINE
          </h3>

          <div className="h-64 w-full pt-2">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <XAxis dataKey="timestamp" stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0D1426', borderColor: '#1C2A45', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)' }} />
                  <Area type="monotone" dataKey="tcp_packets" stroke="#22D3EE" strokeWidth={2} fill="#22D3EE" fillOpacity={0.15} name="TCP Packets" />
                  <Area type="monotone" dataKey="udp_packets" stroke="#A855F7" strokeWidth={2} fill="#A855F7" fillOpacity={0.15} name="UDP Packets" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-mono border border-dashed border-[#1C2A45] bg-[#080D1C] rounded-lg">
                Awaiting historical traffic timeline telemetry...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
