import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Search, Shield, AlertTriangle, CheckCircle, Cpu, Layers, Clock, ArrowLeft } from 'lucide-react';
import { fetchAlertById, fetchAlerts, formatIndianDateTime, formatIndianTime } from '../services/api';

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
    <div className="space-y-6 pb-12 font-sans">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-soc-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 rounded bg-soc-surface border border-soc-borderHover text-soc-textSecondary hover:text-soc-textPrimary hover:bg-soc-surfaceSubtle transition-colors cursor-pointer shadow-subtle"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold font-mono text-soc-textPrimary tracking-tight uppercase">
              THREAT EVIDENCE INSPECTOR
            </h2>
          </div>
          <p className="text-xs text-soc-textSecondary mt-0.5 font-medium">
            Deep telemetry evidence breakdown and multi-detector corroboration analysis.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-soc-textMuted" />
            <input
              type="text"
              placeholder="Enter Alert ID..."
              className="w-full bg-soc-surface border border-soc-borderHover rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-soc-textPrimary placeholder-soc-textMuted focus:outline-none focus:border-brand shadow-subtle"
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
        <div className="bg-danger-50 border border-danger-100 text-danger p-4 rounded-xl text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-12 text-center text-soc-textMuted font-mono text-xs space-y-2 bg-soc-surfaceSubtle">
          <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full mx-auto"></div>
          <p>Loading alert evidence vectors...</p>
        </div>
      ) : alert ? (
        <div className="space-y-6">
          {/* Top Threat Banner */}
          <div className="bg-soc-surface border border-soc-border border-t-4 border-t-danger rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-card hover:shadow-cardHover transition-all">
            <div>
              <div className="flex items-center gap-3 mb-1.5 font-mono">
                <span className="text-xs font-bold text-brand">{alert.alert_id}</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  alert.severity === 'CRITICAL' ? 'bg-danger-50 text-danger border border-danger-100' :
                  alert.severity === 'HIGH' ? 'bg-danger-50 text-danger border border-danger-200' :
                  alert.severity === 'MEDIUM' ? 'bg-warning-50 text-warning border border-warning-100' :
                  'bg-brand-50 text-brand border border-brand-200'
                }`}>
                  {alert.severity} RISK
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-soc-textPrimary tracking-tight">{alert.threat_class}</h3>
              <p className="text-xs text-soc-textMuted font-mono mt-1">
                Detected at {formatIndianDateTime(alert.timestamp)}
              </p>
            </div>

            {/* Risk & Scores Gauge Box */}
            <div className="bg-soc-surfaceSubtle border border-soc-border p-4 rounded-xl flex items-center gap-5 min-w-[320px] font-mono shadow-subtle">
              <div className="border-r border-soc-border pr-4">
                <p className="text-[10px] text-soc-textMuted font-bold uppercase">Confidence</p>
                <p className="text-xl font-bold text-brand">{(alert.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="border-r border-soc-border pr-4">
                <p className="text-[10px] text-soc-textMuted font-bold uppercase">ML Score</p>
                <p className="text-xl font-bold text-indigoAcc">{mlScoreVal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-soc-textMuted font-bold uppercase">Risk Fusion</p>
                <p className="text-xl font-bold text-danger">{riskScoreVal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 5-Tuple & Model Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection 5-Tuple Card */}
            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-brand rounded-xl p-5 space-y-4 shadow-card hover:shadow-cardHover transition-all">
              <h4 className="text-xs font-mono font-bold text-soc-textPrimary flex items-center gap-2 border-b border-soc-border pb-3 uppercase">
                <Shield className="h-4 w-4 text-brand" />
                Connection 5-Tuple Vector (Telemetry)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-soc-textMuted">Source IP</p>
                  <p className="text-soc-textPrimary font-bold text-sm mt-0.5">{alert.source_ip}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Destination IP</p>
                  <p className="text-soc-textPrimary font-bold text-sm mt-0.5">{alert.destination_ip}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Source Port</p>
                  <p className="text-soc-textTechnical mt-0.5">{alert.source_port}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Destination Port</p>
                  <p className="text-soc-textTechnical mt-0.5">{alert.destination_port}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Transport Protocol</p>
                  <p className="text-brand font-bold mt-0.5">{alert.protocol || 'TCP'}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Flow Telemetry ID</p>
                  <p className="text-soc-textTechnical mt-0.5">{alert.flow_id}</p>
                </div>
              </div>
            </div>

            {/* Model Architecture Card */}
            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-indigoAcc rounded-xl p-5 space-y-4 shadow-card hover:shadow-cardHover transition-all">
              <h4 className="text-xs font-mono font-bold text-soc-textPrimary flex items-center gap-2 border-b border-soc-border pb-3 uppercase">
                <Cpu className="h-4 w-4 text-indigoAcc" />
                Detector Architecture & Model Provenance
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-soc-textMuted">Primary Detector Engine</p>
                  <p className="text-soc-textPrimary font-bold mt-0.5">{alert.detector_name}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Model Version</p>
                  <p className="text-indigoAcc font-bold mt-0.5">{alert.model_version}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Target Threat Class</p>
                  <p className="text-warning font-bold mt-0.5">{alert.threat_class}</p>
                </div>
                <div>
                  <p className="text-soc-textMuted">Cross-Corroboration</p>
                  <p className="text-soc-textTechnical mt-0.5">
                    {corroboratingList.length > 0 ? corroboratingList.join(', ') : 'Single Detector'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS DETECTED? Evidence Breakdown */}
          <div className="bg-soc-surface border border-soc-border border-t-4 border-t-success rounded-xl p-5 space-y-4 shadow-card hover:shadow-cardHover transition-all">
            <h4 className="text-sm font-mono font-bold text-soc-textPrimary flex items-center gap-2 border-b border-soc-border pb-3 uppercase">
              <CheckCircle className="h-4 w-4 text-success" />
              DETECTION EXPLANATION & EVIDENCE FINDINGS
            </h4>
            <div className="space-y-2.5 font-mono text-xs">
              {extractReasons(alert.evidence).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-soc-surfaceSubtle p-3 rounded-lg border border-soc-border text-soc-textTechnical">
                  <span className="text-success font-bold shrink-0">✓</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Detector Risk Fusion Contribution Breakdown */}
          {Object.keys(detectorScoresMap).length > 0 && (
            <div className="bg-soc-surface border border-soc-border border-t-4 border-t-ai rounded-xl p-5 space-y-4 shadow-card hover:shadow-cardHover transition-all">
              <h4 className="text-sm font-mono font-bold text-soc-textPrimary flex items-center gap-2 border-b border-soc-border pb-3 uppercase">
                <Layers className="h-4 w-4 text-ai" />
                Multi-Detector Contribution Breakdown (Risk Fusion Engine)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(detectorScoresMap).map(([detName, score]) => (
                  <div key={detName} className="bg-soc-surfaceSubtle p-3.5 rounded-lg border border-soc-border space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-soc-textTechnical">{detName}</span>
                      <span className="font-bold text-warning">{(typeof score === 'number' ? score : parseFloat(score || 0)).toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-soc-border h-2 rounded-full overflow-hidden">
                      <div className="bg-brand h-2 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlated Threat Timeline Section */}
          {correlatedAlerts.length > 1 && (
            <div className="bg-soc-surface border border-soc-border rounded-xl p-5 space-y-4 shadow-card hover:shadow-cardHover transition-all">
              <h4 className="text-xs font-mono font-bold text-soc-textPrimary uppercase border-b border-soc-border pb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand" />
                Correlated Incident Progression Timeline ({alert.source_ip})
              </h4>
              <div className="relative border-l-2 border-soc-border pl-6 space-y-4 my-2 font-mono">
                {correlatedAlerts.map((ca) => (
                  <div key={ca.alert_id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-brand border-2 border-white shadow-subtle"></span>
                    <div className="bg-soc-surfaceSubtle p-3 rounded-lg border border-soc-border text-xs">
                      <div className="flex justify-between items-center text-soc-textMuted">
                        <span className="font-bold text-brand">{formatIndianTime(ca.timestamp)}</span>
                        <span className="text-[11px]">{ca.alert_id}</span>
                      </div>
                      <p className="font-bold text-soc-textPrimary mt-1">{ca.threat_class}</p>
                      <p className="text-[11px] text-soc-textMuted mt-0.5">{ca.source_ip} → {ca.destination_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Telemetry Inspector */}
          <div className="bg-soc-surface border border-soc-border rounded-xl p-5 space-y-3 shadow-card">
            <h4 className="text-xs font-mono font-bold text-soc-textMuted uppercase">RAW TELEMETRY EVIDENCE VECTOR (JSON)</h4>
            <pre className="bg-soc-surfaceSubtle p-4 rounded-lg border border-soc-border text-xs font-mono text-soc-textPrimary overflow-x-auto">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-soc-borderHover bg-soc-surface rounded-xl p-12 text-center text-soc-textMuted font-mono text-xs">
          <FileText className="h-10 w-10 text-soc-borderHover mx-auto mb-2" />
          <p className="font-bold text-soc-textPrimary">ENTER AN ALERT ID ABOVE TO INSPECT EVIDENCE</p>
        </div>
      )}
    </div>
  );
}
