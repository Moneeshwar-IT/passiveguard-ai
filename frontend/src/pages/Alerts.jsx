import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, formatIndianDateTime } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { AlertTriangle, Filter, Search, Clock, Shield, Radio, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Alerts() {
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const [alerts, setAlerts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [threatFilter, setThreatFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchAlerts(null, 200)
      .then((data) => {
        if (isMounted) setAlerts(data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const unsubscribe = subscribe((msg) => {
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
        setCurrentPage(1);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subscribe]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
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
  }, [alerts, severityFilter, threatFilter, timeFilter, searchQuery]);

  // Reset pagination to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, threatFilter, timeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredAlerts.length / pageSize) || 1;
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-soc-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-soc-textPrimary tracking-tight uppercase">LIVE DETECTION & THREAT ALERTS</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-50 border border-brand-200 text-brand flex items-center gap-1">
              <Radio className="h-3 w-3 text-brand animate-pulse" />
              LIVE FEED
            </span>
          </div>
          <p className="text-xs text-soc-textMuted mt-0.5 font-medium">
            Real-time security incident table recorded by passive AI detection engines.
          </p>
        </div>

        <div className="text-xs font-mono text-soc-textMuted bg-soc-surface border border-soc-border px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-subtle">
          <span>Showing</span>
          <span className="text-brand font-bold">{filteredAlerts.length}</span>
          <span>of {alerts.length} total findings</span>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-soc-surface border border-soc-border p-4 rounded-xl shadow-card">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-soc-textMuted" />
          <input
            type="text"
            placeholder="Search IP, Flow ID, Threat..."
            className="w-full bg-soc-surfaceSubtle border border-soc-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-soc-textPrimary placeholder-soc-textMuted focus:outline-none focus:border-brand transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-soc-surfaceSubtle border border-soc-border rounded-lg px-3 py-2">
          <Shield className="h-4 w-4 text-soc-textMuted shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-soc-textTechnical focus:outline-none w-full cursor-pointer"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL" className="bg-soc-surface text-soc-textPrimary">All Severities</option>
            <option value="CRITICAL" className="bg-soc-surface text-soc-textPrimary">CRITICAL</option>
            <option value="HIGH" className="bg-soc-surface text-soc-textPrimary">HIGH</option>
            <option value="MEDIUM" className="bg-soc-surface text-soc-textPrimary">MEDIUM</option>
            <option value="LOW" className="bg-soc-surface text-soc-textPrimary">LOW</option>
            <option value="INFO" className="bg-soc-surface text-soc-textPrimary">INFO</option>
          </select>
        </div>

        {/* Threat Class Filter */}
        <div className="flex items-center gap-2 bg-soc-surfaceSubtle border border-soc-border rounded-lg px-3 py-2">
          <Filter className="h-4 w-4 text-soc-textMuted shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-soc-textTechnical focus:outline-none w-full cursor-pointer"
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
          >
            <option value="ALL" className="bg-soc-surface text-soc-textPrimary">All Threat Vectors</option>
            <option value="DDOS" className="bg-soc-surface text-soc-textPrimary">DDoS Floods</option>
            <option value="C2" className="bg-soc-surface text-soc-textPrimary">C2 Beaconing</option>
            <option value="DGA" className="bg-soc-surface text-soc-textPrimary">DGA Domains</option>
            <option value="DNS_TUNNEL" className="bg-soc-surface text-soc-textPrimary">DNS Tunneling</option>
            <option value="TLS" className="bg-soc-surface text-soc-textPrimary">Encrypted Malware</option>
            <option value="RECON" className="bg-soc-surface text-soc-textPrimary">Recon Scanning</option>
            <option value="EXFIL" className="bg-soc-surface text-soc-textPrimary">Data Exfiltration</option>
          </select>
        </div>

        {/* Time Window Filter */}
        <div className="flex items-center gap-2 bg-soc-surfaceSubtle border border-soc-border rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-soc-textMuted shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-soc-textTechnical focus:outline-none w-full cursor-pointer"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL" className="bg-soc-surface text-soc-textPrimary">All Historical Time</option>
            <option value="5MIN" className="bg-soc-surface text-soc-textPrimary">Last 5 Minutes</option>
            <option value="1HOUR" className="bg-soc-surface text-soc-textPrimary">Last 1 Hour</option>
            <option value="24HOUR" className="bg-soc-surface text-soc-textPrimary">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Incident Table with Pagination */}
      <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden shadow-card hover:shadow-cardHover transition-all">
        {loading ? (
          <div className="p-12 text-center text-soc-textMuted font-mono text-xs space-y-2 bg-soc-surfaceSubtle">
            <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full mx-auto"></div>
            <p>Loading threat incidents database...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-soc-textMuted font-mono text-xs border border-dashed border-soc-border bg-soc-surfaceSubtle rounded-lg m-4">
            <AlertTriangle className="h-8 w-8 text-soc-borderHover mx-auto mb-2" />
            <p className="font-bold text-soc-textPrimary">NO THREAT ALERTS MATCH CURRENT FILTERS</p>
            <p className="text-soc-textMuted mt-1">Adjust search query or select 'All Severities' to view findings.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-soc-textTechnical">
                <thead className="bg-soc-surfaceSubtle text-soc-textMuted uppercase text-[10px] tracking-wider border-b border-soc-border">
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
                <tbody className="divide-y divide-soc-border">
                  {paginatedAlerts.map((a) => (
                    <tr
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className="hover:bg-soc-surfaceSubtle cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.severity === 'CRITICAL' ? 'bg-danger-50 text-danger border border-danger-100' :
                          a.severity === 'HIGH' ? 'bg-danger-50 text-danger border border-danger-100' :
                          a.severity === 'MEDIUM' ? 'bg-warning-50 text-warning border border-warning-100' :
                          'bg-brand-50 text-brand border border-brand-200'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-brand">{a.alert_id}</td>
                      <td className="py-3.5 px-4 font-bold text-soc-textPrimary">{a.threat_class}</td>
                      <td className="py-3.5 px-4 text-soc-textMuted">
                        {formatIndianDateTime(a.timestamp)}
                      </td>
                      <td className="py-3.5 px-4 text-soc-textTechnical">
                        {a.source_ip}:{a.source_port} → {a.destination_ip}:{a.destination_port}
                      </td>
                      <td className="py-3.5 px-4 text-soc-textMuted uppercase">{a.protocol || 'TCP'}</td>
                      <td className="py-3.5 px-4 text-brand font-bold">{(a.confidence * 100).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-soc-textMuted text-[11px]">{a.detector_name}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-[11px] font-semibold text-brand hover:underline flex items-center justify-end gap-1">
                          Inspect <ArrowRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-soc-border bg-soc-surfaceSubtle flex items-center justify-between font-mono text-xs">
              <span className="text-soc-textMuted">
                Page <strong className="text-soc-textPrimary">{currentPage}</strong> of <strong className="text-soc-textPrimary">{totalPages}</strong> ({filteredAlerts.length} total findings)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border border-soc-border bg-soc-surface text-soc-textPrimary hover:bg-soc-surfaceSubtle disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border border-soc-border bg-soc-surface text-soc-textPrimary hover:bg-soc-surfaceSubtle disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
