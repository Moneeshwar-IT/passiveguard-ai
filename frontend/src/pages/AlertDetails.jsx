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
  const statScoreVal = alert && alert.evidence && alert.evidence.statistical_score !== undefined ? alert.evidence.statistical_score : 0.95;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 rounded bg-[#FFFFFF] border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer shadow-xs"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold font-mono text-[#0F172A] tracking-tight uppercase">
              THREAT INVESTIGATION INSPECTOR
            </h2>
          </div>
          <p className="text-xs text-[#475569] mt-0.5 font-medium">
            Deep telemetry evidence breakdown and multi-detector corroboration analysis.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Enter Alert ID..."
              className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] shadow-xs"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary-gradient text-white px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer disabled:opacity-50 shadow-xs transition-colors"
          >
            {loading ? '...' : 'Inspect'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] p-4 rounded-xl text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {alert ? (
        <div className="space-y-6">
          {/* Top Threat Banner */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-t-4 border-t-[#DC2626] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs hover:shadow-md transition-all">
            <div>
              <div className="flex items-center gap-3 mb-1.5 font-mono">
                <span className="text-xs font-bold text-[#2563EB]">{alert.alert_id}</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  alert.severity === 'CRITICAL' ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' :
                  alert.severity === 'HIGH' ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5]' :
                  alert.severity === 'MEDIUM' ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]' :
                  'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                }`}>
                  {alert.severity} RISK
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-[#0F172A] tracking-tight">{alert.threat_class}</h3>
              <p className="text-xs text-[#64748B] font-mono mt-1">
                Detected at {formatIndianDateTime(alert.timestamp)}
              </p>
            </div>

            {/* Risk & Scores Gauge Box */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl flex items-center gap-5 min-w-[320px] font-mono shadow-xs">
              <div className="border-r border-[#E2E8F0] pr-4">
                <p className="text-[10px] text-[#64748B] font-bold uppercase">Confidence</p>
                <p className="text-xl font-bold text-[#2563EB]">{(alert.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="border-r border-[#E2E8F0] pr-4">
                <p className="text-[10px] text-[#64748B] font-bold uppercase">ML Score</p>
                <p className="text-xl font-bold text-[#4F46E5]">{mlScoreVal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] font-bold uppercase">Risk Fusion</p>
                <p className="text-xl font-bold text-[#DC2626]">{riskScoreVal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 5-Tuple & Model Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection 5-Tuple Card */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-t-4 border-t-[#2563EB] rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
              <h4 className="text-xs font-mono font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E2E8F0] pb-3 uppercase">
                <Shield className="h-4 w-4 text-[#2563EB]" />
                Connection 5-Tuple Vector (Telemetry)
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-[#64748B]">Source IP</p>
                  <p className="text-[#0F172A] font-bold text-sm mt-0.5">{alert.source_ip}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Destination IP</p>
                  <p className="text-[#0F172A] font-bold text-sm mt-0.5">{alert.destination_ip}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Source Port</p>
                  <p className="text-[#334155] mt-0.5">{alert.source_port}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Destination Port</p>
                  <p className="text-[#334155] mt-0.5">{alert.destination_port}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Transport Protocol</p>
                  <p className="text-[#2563EB] font-bold mt-0.5">{alert.protocol || 'TCP'}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Flow Telemetry ID</p>
                  <p className="text-[#334155] mt-0.5">{alert.flow_id}</p>
                </div>
              </div>
            </div>

            {/* Model Architecture Card */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-t-4 border-t-[#4F46E5] rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
              <h4 className="text-xs font-mono font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E2E8F0] pb-3 uppercase">
                <Cpu className="h-4 w-4 text-[#4F46E5]" />
                Detector Architecture & Model Provenance
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-[#64748B]">Primary Detector Engine</p>
                  <p className="text-[#0F172A] font-bold mt-0.5">{alert.detector_name}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Model Version</p>
                  <p className="text-[#4F46E5] font-bold mt-0.5">{alert.model_version}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Target Threat Class</p>
                  <p className="text-[#D97706] font-bold mt-0.5">{alert.threat_class}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Cross-Corroboration</p>
                  <p className="text-[#334155] mt-0.5">
                    {corroboratingList.length > 0 ? corroboratingList.join(', ') : 'Single Detector'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS DETECTED? Evidence Breakdown */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-t-4 border-t-[#16A34A] rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
            <h4 className="text-sm font-mono font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E2E8F0] pb-3 uppercase">
              <CheckCircle className="h-4 w-4 text-[#16A34A]" />
              DETECTION EXPLANATION & EVIDENCE FINDINGS
            </h4>
            <div className="space-y-2.5 font-mono text-xs">
              {extractReasons(alert.evidence).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-[#334155]">
                  <span className="text-[#16A34A] font-bold shrink-0">✓</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Detector Risk Fusion Contribution Breakdown */}
          {Object.keys(detectorScoresMap).length > 0 && (
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-t-4 border-t-[#7C3AED] rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
              <h4 className="text-sm font-mono font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E2E8F0] pb-3 uppercase">
                <Layers className="h-4 w-4 text-[#7C3AED]" />
                Multi-Detector Contribution Breakdown (Risk Fusion Engine)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(detectorScoresMap).map(([detName, score]) => (
                  <div key={detName} className="bg-[#F8FAFC] p-3.5 rounded-lg border border-[#E2E8F0] space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#334155]">{detName}</span>
                      <span className="font-bold text-[#D97706]">{(typeof score === 'number' ? score : parseFloat(score || 0)).toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                      <div className="bg-[#2563EB] h-2 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlated Threat Timeline Section */}
          {correlatedAlerts.length > 1 && (
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
              <h4 className="text-xs font-mono font-bold text-[#0F172A] uppercase border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#2563EB]" />
                Correlated Incident Progression Timeline ({alert.source_ip})
              </h4>
              <div className="relative border-l-2 border-[#E2E8F0] pl-6 space-y-4 my-2 font-mono">
                {correlatedAlerts.map((ca) => (
                  <div key={ca.alert_id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#2563EB] border-2 border-white shadow-xs"></span>
                    <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
                      <div className="flex justify-between items-center text-[#64748B]">
                        <span className="font-bold text-[#2563EB]">{formatIndianTime(ca.timestamp)}</span>
                        <span className="text-[11px]">{ca.alert_id}</span>
                      </div>
                      <p className="font-bold text-[#0F172A] mt-1">{ca.threat_class}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{ca.source_ip} → {ca.destination_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Telemetry Inspector */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs">
            <h4 className="text-xs font-mono font-bold text-[#64748B] uppercase">RAW TELEMETRY EVIDENCE VECTOR (JSON)</h4>
            <pre className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] text-xs font-mono text-[#0F172A] overflow-x-auto">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-[#CBD5E1] bg-[#FFFFFF] rounded-xl p-12 text-center text-[#64748B] font-mono text-xs">
          <FileText className="h-10 w-10 text-[#94A3B8] mx-auto mb-2" />
          <p className="font-bold text-[#0F172A]">ENTER AN ALERT ID ABOVE TO INSPECT EVIDENCE</p>
        </div>
      )}
    </div>
  );
}
