import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, createWebSocketConnection } from '../services/api';
import { AlertTriangle, Filter, Search, Clock, Shield } from 'lucide-react';

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [threatFilter, setThreatFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAlerts(null, 200).then(setAlerts).catch(console.error);

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
    // Severity Filter
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) {
      return false;
    }

    // Threat Class Filter
    if (threatFilter !== 'ALL') {
      const tc = a.threat_class.toUpperCase();
      if (threatFilter === 'DDOS' && !tc.includes('DDOS')) return false;
      if (threatFilter === 'C2' && !tc.includes('C2')) return false;
      if (threatFilter === 'DGA' && !tc.includes('DGA')) return false;
      if (threatFilter === 'DNS_TUNNEL' && !tc.includes('TUNNEL')) return false;
      if (threatFilter === 'TLS' && (!tc.includes('MALWARE') && !tc.includes('TLS'))) return false;
      if (threatFilter === 'RECON' && (!tc.includes('RECON') && !tc.includes('SCAN'))) return false;
      if (threatFilter === 'EXFIL' && !tc.includes('EXFIL')) return false;
    }

    // Time Window Filter
    if (timeFilter !== 'ALL' && a.timestamp) {
      const now = Date.now();
      const alertTime = new Date(a.timestamp).getTime();
      const diffMinutes = (now - alertTime) / (1000 * 60);

      if (timeFilter === '5MIN' && diffMinutes > 5) return false;
      if (timeFilter === '1HOUR' && diffMinutes > 60) return false;
      if (timeFilter === '24HOUR' && diffMinutes > 1440) return false;
    }

    // Search Query Filter
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Threat Alerts Center</h2>
          <p className="text-sm text-slate-400">All security detection findings recorded by passive monitoring engines.</p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          Showing <span className="text-sky-400 font-bold">{filteredAlerts.length}</span> of {alerts.length} alerts
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search IP, Flow ID, Threat..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
          <Shield className="h-4 w-4 text-slate-400" />
          <select
            className="bg-transparent text-sm text-slate-200 focus:outline-none w-full"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="INFO">INFO</option>
          </select>
        </div>

        {/* Threat Class Filter */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            className="bg-transparent text-sm text-slate-200 focus:outline-none w-full"
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
          >
            <option value="ALL">All Threat Classes</option>
            <option value="DDOS">DDoS Floods</option>
            <option value="C2">C2 Beaconing</option>
            <option value="DGA">DGA Domains</option>
            <option value="DNS_TUNNEL">DNS Tunnelling</option>
            <option value="TLS">Encrypted Malware</option>
            <option value="RECON">Recon Scanning</option>
            <option value="EXFIL">Data Exfiltration</option>
          </select>
        </div>

        {/* Time Window Filter */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <select
            className="bg-transparent text-sm text-slate-200 focus:outline-none w-full"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL">All Time</option>
            <option value="5MIN">Last 5 minutes</option>
            <option value="1HOUR">Last 1 hour</option>
            <option value="24HOUR">Last 24 hours</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-400">No alerts match current filter criteria.</p>
            <p className="text-xs text-slate-600 mt-1">Try resetting search query or selecting 'All Severities'.</p>
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
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Detector Engine</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAlerts.map((a) => (
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
                      {a.source_ip}:{a.source_port} → {a.destination_ip}:{a.destination_port}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{(a.confidence * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-xs text-slate-400">{a.detector_name}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs font-semibold text-sky-400 hover:underline">Inspect Details →</span>
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
