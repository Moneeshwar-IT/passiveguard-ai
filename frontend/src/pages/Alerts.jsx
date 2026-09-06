import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, createWebSocketConnection, formatIndianDateTime } from '../services/api';
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
    <div className="space-y-6 pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-slate-100 tracking-tight uppercase">LIVE SAST & THREAT DETECTION</h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center gap-1">
              <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
              LIVE STREAM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Real-time security incident database recorded by passive AI detection engines.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-900/80 border border-slate-800/80 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-md">
          <span>Showing</span>
          <span className="text-cyan-400 font-bold">{filteredAlerts.length}</span>
          <span>of {alerts.length} total findings</span>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl shadow-xl">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search IP, Flow ID, Threat..."
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2">
          <Shield className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full cursor-pointer"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL" className="bg-slate-900 text-slate-100">All Severities</option>
            <option value="CRITICAL" className="bg-slate-900 text-slate-100">CRITICAL</option>
            <option value="HIGH" className="bg-slate-900 text-slate-100">HIGH</option>
            <option value="MEDIUM" className="bg-slate-900 text-slate-100">MEDIUM</option>
            <option value="LOW" className="bg-slate-900 text-slate-100">LOW</option>
            <option value="INFO" className="bg-slate-900 text-slate-100">INFO</option>
          </select>
        </div>

        {/* Threat Class Filter */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full cursor-pointer"
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
          >
            <option value="ALL" className="bg-slate-900 text-slate-100">All Threat Vectors</option>
            <option value="DDOS" className="bg-slate-900 text-slate-100">DDoS Floods</option>
            <option value="C2" className="bg-slate-900 text-slate-100">C2 Beaconing</option>
            <option value="DGA" className="bg-slate-900 text-slate-100">DGA Domains</option>
            <option value="DNS_TUNNEL" className="bg-slate-900 text-slate-100">DNS Tunneling</option>
            <option value="TLS" className="bg-slate-900 text-slate-100">Encrypted Malware</option>
            <option value="RECON" className="bg-slate-900 text-slate-100">Recon Scanning</option>
            <option value="EXFIL" className="bg-slate-900 text-slate-100">Data Exfiltration</option>
          </select>
        </div>

        {/* Time Window Filter */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full cursor-pointer"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL" className="bg-slate-900 text-slate-100">All Historical Time</option>
            <option value="5MIN" className="bg-slate-900 text-slate-100">Last 5 Minutes</option>
            <option value="1HOUR" className="bg-slate-900 text-slate-100">Last 1 Hour</option>
            <option value="24HOUR" className="bg-slate-900 text-slate-100">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Incident Table */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs space-y-2 bg-slate-950/60">
            <div className="animate-spin h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto"></div>
            <p>Loading threat incidents database...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 bg-slate-950/60 rounded-lg m-4">
            <AlertTriangle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="font-bold text-slate-100">NO THREAT ALERTS MATCH CURRENT FILTERS</p>
            <p className="text-slate-400 mt-1">Adjust search query or select 'All Severities' to view findings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
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
              <tbody className="divide-y divide-slate-800/80">
                {filteredAlerts.map((a) => (
                  <tr
                    key={a.alert_id}
                    onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                        a.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                        a.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      }`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-cyan-400">{a.alert_id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-100">{a.threat_class}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {formatIndianDateTime(a.timestamp)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {a.source_ip}:{a.source_port} → {a.destination_ip}:{a.destination_port}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 uppercase">{a.protocol || 'TCP'}</td>
                    <td className="py-3.5 px-4 text-cyan-400 font-bold">{(a.confidence * 100).toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">{a.detector_name}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center justify-end gap-1">
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
