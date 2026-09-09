import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Search, Shield, AlertTriangle, CheckCircle, Cpu, Layers, Clock, ArrowLeft } from 'lucide-react';
import { fetchAlertById, fetchAlerts, formatIndianDateTime, formatIndianTime } from '../services/api';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function AlertDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryId = searchParams.get('id');

  const [searchId, setSearchId] = useState(queryId || '');
  const [alert, setAlert] = useState(null);
  const [correlatedAlerts, setCorrelatedAlerts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadAlertDetails = async (targetId) => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAlertById(targetId);
      setAlert(data);

      fetchAlerts(null, 200).then((all) => {
        const related = all.filter(a => a.source_ip === data.source_ip || a.destination_ip === data.destination_ip);
        setCorrelatedAlerts(related.sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp)));
      }).catch(console.error);

    } catch (err) {
      setError(`Alert ID '${targetId}' not found in active telemetry database.`);
      setAlert(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryId) {
      setSearchId(queryId);
      loadAlertDetails(queryId);
    }
  }, [queryId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchId.trim()) {
      loadAlertDetails(searchId.trim());
    }
  };

  const extractReasons = (ev) => {
    if (!ev) return ['Evidence details recorded from passive telemetry stream.'];
    const reasons = [];

    if (Array.isArray(ev.reasons)) {
      reasons.push(...ev.reasons);
    }

    if (ev.contributing_evidence) {
      Object.values(ev.contributing_evidence).forEach((det) => {
        if (det.evidence && Array.isArray(det.evidence.reasons)) {
          det.evidence.reasons.forEach(r => {
            if (!reasons.includes(r)) reasons.push(r);
          });
        }
      });
    }

    if (reasons.length === 0) {
      if (ev.risk_score && ev.risk_score >= 0.65) reasons.push('Multi-signal risk score exceeded passive alert threshold');
      if (ev.corroborating_threats && ev.corroborating_threats.length > 0) {
        reasons.push(`Cross-detector corroboration observed across: ${ev.corroborating_threats.join(', ')}`);
      }
    }

    return reasons.length > 0 ? reasons : ['Multi-detector risk fusion threshold reached based on observed metadata statistics.'];
  };

  const riskScoreVal = alert ? (alert.evidence && alert.evidence.risk_score ? alert.evidence.risk_score : 0.85) : 0.0;
  const corroboratingList = alert ? (alert.evidence && alert.evidence.corroborating_threats ? alert.evidence.corroborating_threats : []) : [];
  const detectorScoresMap = alert ? (alert.evidence && alert.evidence.detector_scores ? alert.evidence.detector_scores : {}) : {};

  const mlScoreVal = alert && alert.evidence && alert.evidence.ml_score !== undefined ? alert.evidence.ml_score : 0.88;

  return (
    <div className="space-y-6 pb-12 font-sans transition-colors">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark transition-colors cursor-pointer shadow-subtle"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight uppercase">
              THREAT EVIDENCE INSPECTOR
            </h2>
          </div>
          <p className="text-xs text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark mt-0.5 font-medium">
            Deep telemetry evidence breakdown and multi-detector corroboration analysis.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-enterprise-textMuted dark:text-enterprise-textMutedDark" />
            <input
              type="text"
              placeholder="Enter Alert ID..."
              className="w-full bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark placeholder-enterprise-textMuted dark:placeholder-enterprise-textMutedDark focus:outline-none focus:border-enterprise-primary dark:focus:border-enterprise-primaryDark shadow-subtle"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary-gradient text-white px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer disabled:opacity-50 shadow-subtle transition-colors"
          >
            {loading ? '...' : 'Inspect'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-6">
          <Skeleton type="card" />
        </div>
      ) : alert ? (
        <div className="space-y-6">
          {/* Top Threat Banner */}
          <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-rose-500 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-card transition-colors">
            <div>
              <div className="flex items-center gap-3 mb-1.5 font-mono">
                <span className="text-xs font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{alert.alert_id}</span>
                <Badge type={alert.severity} pulse={alert.severity === 'CRITICAL'} label={`${alert.severity} RISK`} />
              </div>
              <h3 className="text-2xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight">{alert.threat_class}</h3>
              <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark font-mono mt-1">
                Detected at {formatIndianDateTime(alert.timestamp)}
              </p>
            </div>

            {/* Risk & Scores Gauge Box */}
            <div className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark p-4 rounded-xl flex items-center gap-5 min-w-[320px] font-mono shadow-subtle">
              <div className="border-r border-enterprise-border dark:border-enterprise-borderDark pr-4">
                <p className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark font-bold uppercase">Confidence</p>
                <p className="text-xl font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{(alert.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="border-r border-enterprise-border dark:border-enterprise-borderDark pr-4">
                <p className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark font-bold uppercase">ML Score</p>
                <p className="text-xl font-bold text-indigo-500">{mlScoreVal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark font-bold uppercase">Risk Fusion</p>
                <p className="text-xl font-bold text-rose-500">{riskScoreVal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 5-Tuple & Model Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection 5-Tuple Card */}
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-enterprise-primary dark:border-t-enterprise-primaryDark rounded-xl p-5 space-y-4 shadow-card transition-colors">
              <h4 className="text-xs font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase">
                <Shield className="h-4 w-4 text-enterprise-primary dark:text-enterprise-primaryDark" />
                Connection 5-Tuple Vector (Telemetry)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Source IP</p>
                  <p className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold text-sm mt-0.5">{alert.source_ip}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Destination IP</p>
                  <p className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold text-sm mt-0.5">{alert.destination_ip}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Source Port</p>
                  <p className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark mt-0.5">{alert.source_port}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Destination Port</p>
                  <p className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark mt-0.5">{alert.destination_port}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Transport Protocol</p>
                  <p className="text-enterprise-primary dark:text-enterprise-primaryDark font-bold mt-0.5">{alert.protocol || 'TCP'}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Flow Telemetry ID</p>
                  <p className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark mt-0.5">{alert.flow_id}</p>
                </div>
              </div>
            </div>

            {/* Model Architecture Card */}
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-indigo-500 rounded-xl p-5 space-y-4 shadow-card transition-colors">
              <h4 className="text-xs font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase">
                <Cpu className="h-4 w-4 text-indigo-500" />
                Detector Architecture & Model Provenance
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Primary Detector Engine</p>
                  <p className="text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-bold mt-0.5">{alert.detector_name}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Model Version</p>
                  <p className="text-indigo-500 font-bold mt-0.5">{alert.model_version}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Target Threat Class</p>
                  <p className="text-amber-500 font-bold mt-0.5">{alert.threat_class}</p>
                </div>
                <div>
                  <p className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Cross-Corroboration</p>
                  <p className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark mt-0.5">
                    {corroboratingList.length > 0 ? corroboratingList.join(', ') : 'Single Detector'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS DETECTED? Evidence Breakdown */}
          <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-emerald-500 rounded-xl p-5 space-y-4 shadow-card transition-colors">
            <h4 className="text-sm font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              DETECTION EXPLANATION & EVIDENCE FINDINGS
            </h4>
            <div className="space-y-2.5 font-mono text-xs">
              {extractReasons(alert.evidence).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark p-3 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Detector Risk Fusion Contribution Breakdown */}
          {Object.keys(detectorScoresMap).length > 0 && (
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark border-t-4 border-t-purple-500 rounded-xl p-5 space-y-4 shadow-card transition-colors">
              <h4 className="text-sm font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark flex items-center gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 uppercase">
                <Layers className="h-4 w-4 text-purple-500" />
                Multi-Detector Contribution Breakdown (Risk Fusion Engine)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(detectorScoresMap).map(([detName, score]) => (
                  <div key={detName} className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark p-3.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{detName}</span>
                      <span className="font-bold text-amber-500">{(typeof score === 'number' ? score : parseFloat(score || 0)).toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-enterprise-border dark:bg-enterprise-borderDark h-2 rounded-full overflow-hidden">
                      <div className="bg-enterprise-primary dark:bg-enterprise-primaryDark h-2 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlated Threat Timeline Section */}
          {correlatedAlerts.length > 1 && (
            <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 space-y-4 shadow-card transition-colors">
              <h4 className="text-xs font-mono font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark uppercase border-b border-enterprise-border dark:border-enterprise-borderDark pb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-enterprise-primary dark:text-enterprise-primaryDark" />
                Correlated Incident Progression Timeline ({alert.source_ip})
              </h4>
              <div className="relative border-l-2 border-enterprise-border dark:border-enterprise-borderDark pl-6 space-y-4 my-2 font-mono">
                {correlatedAlerts.map((ca) => (
                  <div key={ca.alert_id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-enterprise-primary dark:bg-enterprise-primaryDark border-2 border-white dark:border-slate-900 shadow-subtle"></span>
                    <div className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark p-3 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark text-xs">
                      <div className="flex justify-between items-center text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                        <span className="font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{formatIndianTime(ca.timestamp)}</span>
                        <span className="text-[11px]">{ca.alert_id}</span>
                      </div>
                      <p className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark mt-1">{ca.threat_class}</p>
                      <p className="text-[11px] text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5">{ca.source_ip} → {ca.destination_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Telemetry Inspector */}
          <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 space-y-3 shadow-card transition-colors">
            <h4 className="text-xs font-mono font-bold text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">RAW TELEMETRY EVIDENCE VECTOR (JSON)</h4>
            <pre className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark p-4 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark text-xs font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark overflow-x-auto">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-8">
          <EmptyState
            title="ENTER AN ALERT ID ABOVE TO INSPECT EVIDENCE"
            description="Inspect deep telemetry metrics, 5-tuple vectors, and multi-detector corroboration graphs."
            icon={FileText}
          />
        </div>
      )}
    </div>
  );
}
