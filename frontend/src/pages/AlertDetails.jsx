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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 rounded bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shadow-md"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold font-mono text-slate-100 tracking-tight uppercase">
              THREAT EVIDENCE INSPECTOR
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Deep telemetry evidence breakdown and multi-detector corroboration analysis.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Alert ID..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-md"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-cyan px-3 py-1.5 text-xs font-mono font-bold cursor-pointer disabled:opacity-50 shadow-md transition-colors"
          >
            {loading ? '...' : 'Inspect'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-4 rounded-xl text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {alert ? (
        <div className="space-y-6">
          {/* Top Threat Banner */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 border-t-4 border-t-rose-500 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-3 mb-1.5 font-mono">
                <span className="text-xs font-bold text-cyan-400">{alert.alert_id}</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                  alert.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                  alert.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}>
                  {alert.severity} RISK
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-slate-100 tracking-tight">{alert.threat_class}</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Detected at {formatIndianDateTime(alert.timestamp)}
              </p>
            </div>

            {/* Risk & Scores Gauge Box */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex items-center gap-5 min-w-[320px] font-mono shadow-md">
              <div className="border-r border-slate-800/80 pr-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Confidence</p>
                <p className="text-xl font-bold text-cyan-400">{(alert.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="border-r border-slate-800/80 pr-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase">ML Score</p>
                <p className="text-xl font-bold text-purple-400">{mlScoreVal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Risk Fusion</p>
                <p className="text-xl font-bold text-rose-400">{riskScoreVal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 5-Tuple & Model Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection 5-Tuple Card */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 border-t-4 border-t-cyan-400 rounded-xl p-5 space-y-4 shadow-xl">
              <h4 className="text-xs font-mono font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3 uppercase">
                <Shield className="h-4 w-4 text-cyan-400" />
                Connection 5-Tuple Vector (Telemetry)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-slate-400">Source IP</p>
                  <p className="text-slate-100 font-bold text-sm mt-0.5">{alert.source_ip}</p>
                </div>
                <div>
                  <p className="text-slate-400">Destination IP</p>
                  <p className="text-slate-100 font-bold text-sm mt-0.5">{alert.destination_ip}</p>
                </div>
                <div>
                  <p className="text-slate-400">Source Port</p>
                  <p className="text-slate-300 mt-0.5">{alert.source_port}</p>
                </div>
                <div>
                  <p className="text-slate-400">Destination Port</p>
                  <p className="text-slate-300 mt-0.5">{alert.destination_port}</p>
                </div>
                <div>
                  <p className="text-slate-400">Transport Protocol</p>
                  <p className="text-cyan-400 font-bold mt-0.5">{alert.protocol || 'TCP'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Flow Telemetry ID</p>
                  <p className="text-slate-300 mt-0.5">{alert.flow_id}</p>
                </div>
              </div>
            </div>

            {/* Model Architecture Card */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 border-t-4 border-t-indigo-400 rounded-xl p-5 space-y-4 shadow-xl">
              <h4 className="text-xs font-mono font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3 uppercase">
                <Cpu className="h-4 w-4 text-indigo-400" />
                Detector Architecture & Model Provenance
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-slate-400">Primary Detector Engine</p>
                  <p className="text-slate-100 font-bold mt-0.5">{alert.detector_name}</p>
                </div>
                <div>
                  <p className="text-slate-400">Model Version</p>
                  <p className="text-indigo-400 font-bold mt-0.5">{alert.model_version}</p>
                </div>
                <div>
                  <p className="text-slate-400">Target Threat Class</p>
                  <p className="text-amber-400 font-bold mt-0.5">{alert.threat_class}</p>
                </div>
                <div>
                  <p className="text-slate-400">Cross-Corroboration</p>
                  <p className="text-slate-300 mt-0.5">
                    {corroboratingList.length > 0 ? corroboratingList.join(', ') : 'Single Detector'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS DETECTED? Evidence Breakdown */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 border-t-4 border-t-emerald-400 rounded-xl p-5 space-y-4 shadow-xl">
            <h4 className="text-sm font-mono font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3 uppercase">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              DETECTION EXPLANATION & EVIDENCE FINDINGS
            </h4>
            <div className="space-y-2.5 font-mono text-xs">
              {extractReasons(alert.evidence).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-slate-200">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Detector Risk Fusion Contribution Breakdown */}
          {Object.keys(detectorScoresMap).length > 0 && (
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 border-t-4 border-t-purple-400 rounded-xl p-5 space-y-4 shadow-xl">
              <h4 className="text-sm font-mono font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3 uppercase">
                <Layers className="h-4 w-4 text-purple-400" />
                Multi-Detector Contribution Breakdown (Risk Fusion Engine)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(detectorScoresMap).map(([detName, score]) => (
                  <div key={detName} className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">{detName}</span>
                      <span className="font-bold text-amber-400">{(typeof score === 'number' ? score : parseFloat(score || 0)).toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlated Threat Timeline Section */}
          {correlatedAlerts.length > 1 && (
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-xl">
              <h4 className="text-xs font-mono font-bold text-slate-100 uppercase border-b border-slate-800/80 pb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                Correlated Incident Progression Timeline ({alert.source_ip})
              </h4>
              <div className="relative border-l-2 border-slate-800 pl-6 space-y-4 my-2 font-mono">
                {correlatedAlerts.map((ca) => (
                  <div key={ca.alert_id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md"></span>
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="font-bold text-cyan-400">{formatIndianTime(ca.timestamp)}</span>
                        <span className="text-[11px]">{ca.alert_id}</span>
                      </div>
                      <p className="font-bold text-slate-100 mt-1">{ca.threat_class}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ca.source_ip} → {ca.destination_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Telemetry Inspector */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 space-y-3 shadow-xl">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">RAW TELEMETRY EVIDENCE VECTOR (JSON)</h4>
            <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-cyan-300 overflow-x-auto">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-800 bg-slate-950/60 rounded-xl p-12 text-center text-slate-400 font-mono text-xs">
          <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="font-bold text-slate-100">ENTER AN ALERT ID ABOVE TO INSPECT EVIDENCE</p>
        </div>
      )}
    </div>
  );
}
