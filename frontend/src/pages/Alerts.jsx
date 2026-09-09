import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, formatIndianDateTime } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import { Filter, Search, Clock, Shield, Radio, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

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
    <div className="space-y-6 pb-8 font-sans transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight uppercase">LIVE DETECTION & THREAT ALERTS</h2>
            <Badge type="ACTIVE" label="LIVE FEED" pulse />
          </div>
          <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5 font-medium">
            Real-time security incident table recorded by passive AI detection engines.
          </p>
        </div>

        <div className="text-xs font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-subtle">
          <span>Showing</span>
          <span className="text-enterprise-primary dark:text-enterprise-primaryDark font-bold">{filteredAlerts.length}</span>
          <span>of {alerts.length} total findings</span>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark p-4 rounded-xl shadow-card transition-colors">
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark" />
          <input
            type="text"
            placeholder="Search IP, Flow ID, Threat..."
            className="w-full bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark placeholder-enterprise-textMuted dark:placeholder-enterprise-textMutedDark focus:outline-none focus:border-enterprise-primary dark:focus:border-enterprise-primaryDark transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg px-3 py-2">
          <Shield className="h-4 w-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark focus:outline-none w-full cursor-pointer"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">All Severities</option>
            <option value="CRITICAL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">CRITICAL</option>
            <option value="HIGH" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">HIGH</option>
            <option value="MEDIUM" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">MEDIUM</option>
            <option value="LOW" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">LOW</option>
            <option value="INFO" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">INFO</option>
          </select>
        </div>

        {/* Threat Class Filter */}
        <div className="flex items-center gap-2 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg px-3 py-2">
          <Filter className="h-4 w-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark focus:outline-none w-full cursor-pointer"
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
          >
            <option value="ALL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">All Threat Vectors</option>
            <option value="DDOS" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">DDoS Floods</option>
            <option value="C2" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">C2 Beaconing</option>
            <option value="DGA" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">DGA Domains</option>
            <option value="DNS_TUNNEL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">DNS Tunneling</option>
            <option value="TLS" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Encrypted Malware</option>
            <option value="RECON" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Recon Scanning</option>
            <option value="EXFIL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Data Exfiltration</option>
          </select>
        </div>

        {/* Time Window Filter */}
        <div className="flex items-center gap-2 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark shrink-0" />
          <select
            className="bg-transparent text-xs font-mono text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark focus:outline-none w-full cursor-pointer"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="ALL" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">All Historical Time</option>
            <option value="5MIN" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Last 5 Minutes</option>
            <option value="1HOUR" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Last 1 Hour</option>
            <option value="24HOUR" className="bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Incident Table with Pagination */}
      <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl overflow-hidden shadow-card transition-colors">
        {loading ? (
          <div className="p-6">
            <Skeleton type="table" count={8} />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="NO THREAT ALERTS MATCH CURRENT FILTERS"
              description="Adjust search query or select 'All Severities' to view findings."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                <thead className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase text-[10px] tracking-wider border-b border-enterprise-border dark:border-enterprise-borderDark">
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
                <tbody className="divide-y divide-enterprise-border dark:divide-enterprise-borderDark">
                  {paginatedAlerts.map((a) => (
                    <tr
                      key={a.alert_id}
                      onClick={() => navigate(`/alert-details?id=${a.alert_id}`)}
                      className="hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <Badge type={a.severity} pulse={a.severity === 'CRITICAL'} />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{a.alert_id}</td>
                      <td className="py-3.5 px-4 font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{a.threat_class}</td>
                      <td className="py-3.5 px-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                        {formatIndianDateTime(a.timestamp)}
                      </td>
                      <td className="py-3.5 px-4 text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                        {a.source_ip}:{a.source_port} → {a.destination_ip}:{a.destination_port}
                      </td>
                      <td className="py-3.5 px-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">{a.protocol || 'TCP'}</td>
                      <td className="py-3.5 px-4 text-enterprise-primary dark:text-enterprise-primaryDark font-bold">{(a.confidence * 100).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark text-[11px]">{a.detector_name}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-[11px] font-semibold text-enterprise-primary dark:text-enterprise-primaryDark hover:underline flex items-center justify-end gap-1">
                          Inspect <ArrowRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark flex items-center justify-between font-mono text-xs">
              <span className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                Page <strong className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{currentPage}</strong> of <strong className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{totalPages}</strong> ({filteredAlerts.length} total findings)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark disabled:opacity-50 flex items-center gap-1 cursor-pointer"
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
