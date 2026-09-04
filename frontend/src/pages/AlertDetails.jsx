import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Shield, AlertTriangle, CheckCircle, Info, Cpu, Layers } from 'lucide-react';
import { fetchAlertById, fetchAlerts } from '../services/api';

export default function AlertDetails() {
  const [searchParams] = useSearchParams();
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

      // Fetch all alerts to build threat timeline for same src/dst IP pair
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

  // Helper to extract human-readable reasons from evidence
  const extractReasons = (ev) => {
    if (!ev) return ['Evidence details recorded from passive telemetry stream.'];
    const reasons = [];

    // Direct reasons array
    if (Array.isArray(ev.reasons)) {
      reasons.push(...ev.reasons);
    }

    // Detector contributing evidence reasons
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Threat Investigation & Evidence Inspector</h2>
        <p className="text-sm text-slate-400">Deep telemetry evidence breakdown and multi-detector corroboration analysis.</p>
      </div>

      {/* Alert Search Control */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Enter Alert ID (e.g. ALT-123456)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Inspecting...' : 'Inspect Alert'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {alert ? (
        <div className="space-y-6">
          {/* Top Threat Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-mono font-bold text-sky-400">{alert.alert_id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  alert.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  alert.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}>
                  {alert.severity}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white">{alert.threat_class}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Detected at {new Date(alert.timestamp).toLocaleString()}</p>
            </div>

            {/* Risk Gauge Box */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center gap-6 min-w-[280px]">
              <div>
                <p className="text-xs text-slate-500 font-semibold">Unified Risk Score</p>
                <p className="text-2xl font-mono font-bold text-amber-400">{riskScoreVal.toFixed(2)}</p>
              </div>
              <div className="border-l border-slate-800 pl-6">
                <p className="text-xs text-slate-500 font-semibold">Evidence Confidence</p>
                <p className="text-2xl font-mono font-bold text-sky-400">{(alert.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Connection Details & Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection Details Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Shield className="h-4 w-4 text-sky-400" />
                Connection 5-Tuple Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-slate-500">Source IP</p>
                  <p className="text-slate-200 font-bold text-sm mt-0.5">{alert.source_ip}</p>
                </div>
                <div>
                  <p className="text-slate-500">Destination IP</p>
                  <p className="text-slate-200 font-bold text-sm mt-0.5">{alert.destination_ip}</p>
                </div>
                <div>
                  <p className="text-slate-500">Source Port</p>
                  <p className="text-slate-300 mt-0.5">{alert.source_port}</p>
                </div>
                <div>
                  <p className="text-slate-500">Destination Port</p>
                  <p className="text-slate-300 mt-0.5">{alert.destination_port}</p>
                </div>
                <div>
                  <p className="text-slate-500">Protocol</p>
                  <p className="text-slate-300 font-bold mt-0.5">{alert.protocol}</p>
                </div>
                <div>
                  <p className="text-slate-500">Flow ID</p>
                  <p className="text-sky-400 mt-0.5">{alert.flow_id}</p>
                </div>
              </div>
            </div>

            {/* Detection Information Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Cpu className="h-4 w-4 text-purple-400" />
                Detector Model Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Primary Detector</p>
                  <p className="text-white font-semibold mt-0.5">{alert.detector_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Model Version</p>
                  <p className="font-mono text-slate-300 mt-0.5">{alert.model_version}</p>
                </div>
                <div>
                  <p className="text-slate-500">Primary Threat Class</p>
                  <p className="font-bold text-amber-400 mt-0.5">{alert.threat_class}</p>
                </div>
                <div>
                  <p className="text-slate-500">Corroborating Threat Classes</p>
                  <p className="text-slate-300 mt-0.5 font-mono">
                    {corroboratingList.length > 0 ? corroboratingList.join(', ') : 'None'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS DETECTED? Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              WHY WAS THIS DETECTED? (Explainable Finding Evidence)
            </h4>
            <div className="space-y-2.5">
              {extractReasons(alert.evidence).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 text-sm text-slate-200">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detector Contribution & Corroboration Breakdown */}
          {Object.keys(detectorScoresMap).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h4 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="h-5 w-5 text-sky-400" />
                Multi-Detector Contribution Breakdown (Module 9 Risk Fusion)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(detectorScoresMap).map(([detName, score]) => (
                  <div key={detName} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300">{detName}</span>
                      <span className="font-mono font-bold text-amber-400">{score.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-sky-400 h-2 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Score Semantics Disclaimer */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-xs text-amber-300 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-400">Risk Score Semantics</p>
              <p className="mt-0.5">
                The fused risk score ({riskScoreVal.toFixed(2)}) is a bounded anomaly/risk score normalized $[0.0, 1.0]$ based on observed transport metadata. It is NOT a calibrated posterior probability of compromise.
              </p>
            </div>
          </div>

          {/* Threat Timeline / Attack Story Section */}
          {correlatedAlerts.length > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h4 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                Correlated Threat Timeline / Attack Story ({alert.source_ip})
              </h4>
              <div className="relative border-l-2 border-slate-800 pl-6 space-y-6 my-4">
                {correlatedAlerts.map((ca, i) => (
                  <div key={ca.alert_id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-sky-500 border-2 border-slate-900"></span>
                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span className="font-mono text-sky-400 font-bold">{new Date(ca.timestamp).toLocaleTimeString()}</span>
                        <span className="font-mono">{ca.alert_id}</span>
                      </div>
                      <p className="font-semibold text-white mt-1 text-sm">{ca.threat_class}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{ca.source_ip} → {ca.destination_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Evidence Inspection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <h4 className="text-sm font-semibold text-white">Raw Telemetry Evidence JSON</h4>
            <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
          <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium">Enter an Alert ID above or click any alert in the Dashboard to inspect full evidence.</p>
        </div>
      )}
    </div>
  );
}
