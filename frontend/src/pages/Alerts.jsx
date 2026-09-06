import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, createWebSocketConnection } from '../services/api';
import { AlertTriangle, Filter, Search, Clock, Shield, Radio, ArrowRight } from 'lucide-react';

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [threatFilter, setThreatFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts(null, 200)
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));

    const ws = createWebSocketConnection((msg) => {
      if (msg.type === 'alert_created' || msg.event === 'alert_created') {
        if (msg.data) {
          setAlerts((prev) => {
            const exists = prev.some(a => a.alert_id === msg.data.alert_id);
            if (exists) return prev;
            return [msg.data, ...prev];
          });
        }
      }
      if (msg.type === 'state_reset' || msg.event === 'state_reset') {
        setAlerts([]);
      }
    });

    return () => ws.close();
  }, []);

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) {
      return false;
    }

    if (threatFilter !== 'ALL') {
      const tc = (a.threat_class || '').toUpperCase();
      if (threatFilter === 'DDOS' && !tc.includes('DDOS')) return false;
      if (threatFilter === 'C2' && !tc.includes('C2')) return false;
      if (threatFilter === 'DGA' && !tc.includes('DGA')) return false;
      if (threatFilter === 'DNS_TUNNEL' && !tc.includes('TUNNEL')) return false;
      if (threatFilter === 'TLS' && (!tc.includes('MALWARE') && !tc.includes('TLS'))) return false;
      if (threatFilter === 'RECON' && (!tc.includes('RECON') && !tc.includes('SCAN'))) return false;
      if (threatFilter === 'EXFIL' && !tc.includes('EXFIL')) return false;
    }

    if (timeFilter !== 'ALL' && a.timestamp) {
      const now = Date.now();
      const alertTime = new Date(a.timestamp).getTime();
      const diffMinutes = (now - alertTime) / (1000 * 60);

      if (timeFilter === '5MIN' && diffMinutes > 5) return false;
      if (timeFilter === '1HOUR' && diffMinutes > 60) return false;
      if (timeFilter === '24HOUR' && diffMinutes > 1440) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSrc = a.source_ip ? a.source_ip.toLowerCase().includes(q) : false;
      const matchDst = a.destination_ip ? a.destination_ip.toLowerCase().includes(q) : false;
      const matchId = a.alert_id ? a.alert_id.toLowerCase().includes(q) : false;
      const matchFlow = a.flow_id ? a.flow_id.toLowerCase().includes(q) : false;
      const matchThreat = a.threat_class ? a.threat_class.toLowerCase().includes(q) : false;
      const matchDetector = a.detector_name ? a.detector_name.toLowerCase().includes(q) : false;

      if (!matchSrc && !matchDst && !matchId && !matchFlow && !matchThreat && !matchDetector) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C2A45] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-[#F8FAFC] tracking-tight uppercase">LIVE DETECTION & THREAT ALERTS</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,211,238,0.10)] border border-[#22D3EE]/30 text-[#22D3EE] flex items-center gap-1">
              <Radio className="h-3 w-3 text-[#22D3EE] animate-pulse" />
              LIVE FEED
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5 font-medium">
            Real-time security incident table recorded by passive AI detection engines.
          </p>
        </div>

        <div className="text-xs font-mono text-[#94A3B8] bg-[#0D1426] border border-[#1C2A45] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
          <span>Showing</span>
          <span className="text-[#22D3EE] font-bold">{filteredAlerts.length}</span>
          <span>of {alerts.length} total findings</span>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0D1426] border border-[#1C2A45] p-4 rounded-xl shadow-xs">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search IP, Flow ID, Threat..."
            className="w-full bg-[#050816] border border-[#1C2A45] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#22D3EE] transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-[#050816] border border-[#1C2A45] rounded-lg px-3 py-2">
          <Shield className="h-4 w-4 text-[#94A3B8] shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-[#CBD5E1] focus:outline-none w-full cursor-pointer"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL" className="bg-[#0D1426] text-[#F8FAFC]">All Severities</option>
            <option value="CRITICAL" className="bg-[#0D1426] text-[#F8FAFC]">CRITICAL</option>
            <option value="HIGH" className="bg-[#0D1426] text-[#F8FAFC]">HIGH</option>
            <option value="MEDIUM" className="bg-[#0D1426] text-[#F8FAFC]">MEDIUM</option>
            <option value="LOW" className="bg-[#0D1426] text-[#F8FAFC]">LOW</option>
            <option value="INFO" className="bg-[#0D1426] text-[#F8FAFC]">INFO</option>
          </select>
        </div>

        {/* Threat Class Filter */}
        <div className="flex items-center gap-2 bg-[#050816] border border-[#1C2A45] rounded-lg px-3 py-2">
          <Filter className="h-4 w-4 text-[#94A3B8] shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-[#CBD5E1] focus:outline-none w-full cursor-pointer"
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
          >
            <option value="ALL" className="bg-[#0D1426] text-[#F8FAFC]">All Threat Vectors</option>
            <option value="DDOS" className="bg-[#0D1426] text-[#F8FAFC]">DDoS Floods</option>
            <option value="C2" className="bg-[#0D1426] text-[#F8FAFC]">C2 Beaconing</option>
            <option value="DGA" className="bg-[#0D1426] text-[#F8FAFC]">DGA Domains</option>
            <option value="DNS_TUNNEL" className="bg-[#0D1426] text-[#F8FAFC]">DNS Tunneling</option>
            <option value="TLS" className="bg-[#0D1426] text-[#F8FAFC]">Encrypted Malware</option>
            <option value="RECON" className="bg-[#0D1426] text-[#F8FAFC]">Recon Scanning</option>
            <option value="EXFIL" className="bg-[#0D1426] text-[#F8FAFC]">Data Exfiltration</option>
          </select>
        </div>

        {/* Time Window Filter */}
        <div className="flex items-center gap-2 bg-[#050816] border border-[#1C2A45] rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-[#94A3B8] shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-[#CBD5E1] focus:outline-none w-full cursor-pointer"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL" className="bg-[#0D1426] text-[#F8FAFC]">All Historical Time</option>
            <option value="5MIN" className="bg-[#0D1426] text-[#F8FAFC]">Last 5 Minutes</option>
            <option value="1HOUR" className="bg-[#0D1426] text-[#F8FAFC]">Last 1 Hour</option>
            <option value="24HOUR" className="bg-[#0D1426] text-[#F8FAFC]">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Incident Table */}
      <div className="bg-[#0D1426] border border-[#1C2A45] rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all">
        {loading ? (
          <div className="p-12 text-center text-[#94A3B8] font-mono text-xs space-y-2 bg-[#080D1C]">
            <div className="animate-spin h-6 w-6 border-2 border-[#22D3EE] border-t-transparent rounded-full mx-auto"></div>
            <p>Loading threat incidents database...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-[#94A3B8] font-mono text-xs border border-dashed border-[#1C2A45] bg-[#080D1C] rounded-lg m-4">
            <AlertTriangle className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
            <p className="font-bold text-[#F8FAFC]">NO THREAT ALERTS MATCH CURRENT FILTERS</p>
            <p className="text-[#94A3B8] mt-1">Adjust search query or select 'All Severities' to view findings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-[#CBD5E1]">
              <thead className="bg-[#050816] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#1C2A45]">
                <tr>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Alert ID</th>
                  <th className="py-3.5 px-4">Threat Vector</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Source IP → Destination IP</th>
                  <th className="py-3.5 px-4">Protocol</th>
                  <th className="py-3.5 px-4">Confidence</th>
                  <th className="py-3.5 px-4">Detector Engine</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2A45]">
                {filteredAlerts.map((a) => (
                  <tr
                    key={a.alert_id}
                    onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                    className="hover:bg-[#111B32] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.severity === 'CRITICAL' ? 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[#EF4444]/40' :
                        a.severity === 'HIGH' ? 'bg-[rgba(239,68,68,0.10)] text-[#F87171] border border-[#F87171]/30' :
                        a.severity === 'MEDIUM' ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[#F59E0B]/40' :
                        'bg-[rgba(34,211,238,0.10)] text-[#22D3EE] border border-[#22D3EE]/30'
                      }`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#22D3EE]">{a.alert_id}</td>
                    <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">{a.threat_class}</td>
                    <td className="py-3.5 px-4 text-[#94A3B8]">
                      {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-[#CBD5E1]">
                      {a.source_ip}:{a.source_port} → {a.destination_ip}:{a.destination_port}
                    </td>
                    <td className="py-3.5 px-4 text-[#94A3B8] uppercase">{a.protocol || 'TCP'}</td>
                    <td className="py-3.5 px-4 text-[#22D3EE] font-bold">{(a.confidence * 100).toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-[#94A3B8] text-[11px]">{a.detector_name}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[11px] font-semibold text-[#22D3EE] hover:underline flex items-center justify-end gap-1">
                        Inspect <ArrowRight className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
