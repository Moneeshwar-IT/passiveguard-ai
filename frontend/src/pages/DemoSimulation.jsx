import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RotateCcw, ShieldAlert, Radio, Search, FileCode, Terminal,
  Lock, PlayCircle, CheckCircle2, AlertTriangle, Cpu, Activity,
  ArrowRight, ShieldCheck, RefreshCw, Layers
} from 'lucide-react';
import {
  runDemoScenario, resetDemoState, fetchDemoStatus, fetchDemoScenarios,
  API_BASE_URL, formatIndianTime
} from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

const formatApiError = (err, fallbackText) => {
  if (err.response) {
    const status = err.response.status;
    const detail = err.response.data?.detail || err.response.data?.message;
    return detail ? `[HTTP ${status}] ${detail}` : `[HTTP ${status}] ${fallbackText}`;
  }
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Request timed out waiting for backend response. Please retry.';
  }
  if (err.message) {
    return `Network Error: ${err.message}. Target API: ${API_BASE_URL}`;
  }
  return fallbackText;
};

export default function DemoSimulation() {
  const navigate = useNavigate();
  const { wsStatus, subscribe } = useWebSocket();
  const [selectedScenario, setSelectedScenario] = useState('ddos');
  const [isRunning, setIsRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [autoReset, setAutoReset] = useState(false);
  const [activeTab, setActiveTab] = useState('scenarios');
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState(null);
  const [scenariosList, setScenariosList] = useState([]);
  const [liveWsAlerts, setLiveWsAlerts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetchDemoScenarios().then((res) => {
      if (isMounted && res && res.scenarios) {
        setScenariosList(res.scenarios);
      }
    }).catch(console.error);

    fetchDemoStatus().then((res) => {
      if (!isMounted) return;
      if (res && res.is_running) setIsRunning(true);
      if (res && res.last_run) setRunResult(res.last_run);
    }).catch(console.error);

    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'alert_created' || msg.event === 'alert_created') {
        if (msg.data) {
          setLiveWsAlerts((prev) => [msg.data, ...prev.slice(0, 49)]);
        }
      }
      if (msg.type === 'state_reset' || msg.event === 'state_reset') {
        setLiveWsAlerts([]);
        setRunResult(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [subscribe]);

  const handleRunDemo = async (scenarioToRun = null) => {
    const sc = scenarioToRun || selectedScenario;
    setIsRunning(true);
    setErrorMsg(null);

    try {
      const res = await runDemoScenario(sc, autoReset);
      setRunResult(res);
      setActiveTab('results');
    } catch (err) {
      console.error('Error running demo scenario:', err);
      setErrorMsg(formatApiError(err, 'Failed to execute demo simulation.'));
    } finally {
      setIsRunning(false);
    }
  };

  const handleResetState = async () => {
    setResetting(true);
    setErrorMsg(null);
    setResetSuccessMsg(null);
    try {
      await resetDemoState();
      setRunResult(null);
      setLiveWsAlerts([]);
      setSelectedScenario('ddos');
      setActiveTab('scenarios');
      setResetSuccessMsg('Demonstration state, SQLite alert store, deduplication cache, and temporal state trackers cleared successfully.');
      setTimeout(() => setResetSuccessMsg(null), 4000);
      await fetchDemoStatus();
    } catch (err) {
      console.error('Error resetting demo state:', err);
      setErrorMsg(formatApiError(err, 'Failed to reset demonstration state.'));
    } finally {
      setResetting(false);
    }
  };

  const getScenarioAccent = (scenarioId) => {
    switch (scenarioId) {
      case 'ddos': return { border: 'hover:border-danger', icon: <ShieldAlert className="w-5 h-5 text-danger" />, tag: 'text-danger' };
      case 'c2': return { border: 'hover:border-ai', icon: <Radio className="w-5 h-5 text-ai" />, tag: 'text-ai' };
      case 'dga': return { border: 'hover:border-indigoAcc', icon: <Terminal className="w-5 h-5 text-indigoAcc" />, tag: 'text-indigoAcc' };
      case 'dns_tunnel': return { border: 'hover:border-brand', icon: <FileCode className="w-5 h-5 text-brand" />, tag: 'text-brand' };
      case 'tls_malware': return { border: 'hover:border-warning', icon: <Lock className="w-5 h-5 text-warning" />, tag: 'text-warning' };
      case 'recon': return { border: 'hover:border-brand', icon: <Search className="w-5 h-5 text-brand" />, tag: 'text-brand' };
      case 'exfiltration': return { border: 'hover:border-ai', icon: <Activity className="w-5 h-5 text-ai" />, tag: 'text-ai' };
      default: return { border: 'hover:border-brand', icon: <Cpu className="w-5 h-5 text-brand" />, tag: 'text-brand' };
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-danger-50 text-danger border border-danger-100">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-danger-50 text-danger border border-danger-100">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-warning-50 text-warning border border-warning-100">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-50 text-brand border border-brand-200">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-soc-surfaceSubtle text-soc-textMuted border border-soc-border">INFO / BENIGN</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-soc-surface p-6 rounded-xl border border-soc-border shadow-card hover:shadow-cardHover transition-all">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-soc-textPrimary tracking-tight uppercase flex items-center gap-2">
              <span className="text-ai">DEMO</span> <span className="text-brand">LAB & SIMULATION</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-50 text-brand border border-brand-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
              CONTROLLED SIMULATION ENVIRONMENT
            </span>
          </div>
          <p className="text-soc-textSecondary text-xs mt-1 font-medium">
            Controlled passive threat simulation suite for Smart India Hackathon live judging demonstration.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunDemo('all')}
            disabled={isRunning}
            className="btn-primary-gradient text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold shadow-subtle flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            RUN FULL DEMO
          </button>

          <button
            onClick={() => handleRunDemo()}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold bg-soc-surface hover:bg-soc-surfaceSubtle text-brand border border-soc-borderHover hover:border-brand transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-subtle"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-brand" />
                EXECUTING PIPELINE...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-brand" />
                RUN SELECTED ({selectedScenario.toUpperCase()})
              </>
            )}
          </button>

          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold bg-soc-surface hover:bg-soc-surfaceSubtle text-soc-textSecondary hover:text-soc-textPrimary border border-soc-borderHover transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-subtle"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-brand' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Prominent Safety Banner & Simulation Indicators */}
      <div className="bg-success-50 border border-success-200 p-4 rounded-xl shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-success-200 pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-success-700 uppercase">
            <ShieldCheck className="w-4 h-4 text-success" />
            OFFLINE CONTROLLED ENVIRONMENT — PASSIVE SECURITY GUARANTEES
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-soc-surface border border-success-200 text-success-700 font-bold">● LIVE SIMULATION</span>
            <span className="px-2 py-0.5 rounded bg-soc-surface border border-brand-200 text-brand font-bold">PCAP REPLAY</span>
            <span className="px-2 py-0.5 rounded bg-soc-surface border border-indigoAcc-200 text-indigoAcc font-bold">REAL DATA-DIODE FEED</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-soc-textPrimary">
          <div className="flex items-center gap-2 bg-soc-surface p-2.5 rounded-lg border border-soc-border shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>NO PACKETS TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 bg-soc-surface p-2.5 rounded-lg border border-soc-border shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>NO ACTIVE PROBING</span>
          </div>
          <div className="flex items-center gap-2 bg-soc-surface p-2.5 rounded-lg border border-soc-border shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>NO PAYLOAD DECRYPTION</span>
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-danger-50 border border-danger-100 text-danger text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-success-50 border border-success-200 text-success-700 text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-soc-border text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'scenarios'
              ? 'border-brand text-brand'
              : 'border-transparent text-soc-textMuted hover:text-soc-textPrimary'
          }`}
        >
          <Layers className="w-4 h-4" />
          Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-brand text-brand'
              : 'border-transparent text-soc-textMuted hover:text-soc-textPrimary'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="px-2 py-0.2 rounded text-[10px] bg-brand-50 text-brand border border-brand-200">Active</span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_stream'
              ? 'border-brand text-brand'
              : 'border-transparent text-soc-textMuted hover:text-soc-textPrimary'
          }`}
        >
          <Radio className="w-4 h-4 text-ai" />
          Live WebSocket Feed ({liveWsAlerts.length})
        </button>
      </div>

      {/* TAB 1: SCENARIO CATALOG & SELECTION */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenariosList.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              const accent = getScenarioAccent(sc.id);
              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-brand-50 border-brand shadow-cardHover ring-1 ring-brand/40'
                      : `bg-soc-surface border-soc-border ${accent.border} hover:bg-soc-surfaceSubtle`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-soc-surfaceSubtle border border-soc-border">
                          {accent.icon}
                        </div>
                        <div>
                          <h3 className="font-bold font-mono text-soc-textPrimary text-sm">{sc.title}</h3>
                          <span className={`text-[10px] font-mono uppercase font-bold ${accent.tag}`}>{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-soc-textSecondary leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-soc-border mt-2 font-mono">
                    <span className="text-[10px] text-soc-textMuted">ID: {sc.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScenario(sc.id);
                        handleRunDemo(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded text-xs font-bold btn-primary-gradient text-white shadow-subtle transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-white" />
                      RUN SCENARIO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-soc-surface border border-soc-border flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-card">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded border-soc-borderHover bg-soc-surface text-brand focus:ring-brand"
              />
              <label htmlFor="autoReset" className="text-xs text-soc-textTechnical cursor-pointer font-medium">
                Automatically reset alert store & temporal state before running scenario
              </label>
            </div>
            <button
              onClick={() => handleRunDemo('all')}
              disabled={isRunning}
              className="btn-primary-gradient text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-subtle transition-colors"
            >
              <PlayCircle className="w-4 h-4 text-white" />
              EXECUTE ALL 7 SCENARIOS SEQUENTIALLY
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!runResult ? (
            <div className="p-12 text-center bg-soc-surface rounded-xl border border-soc-border space-y-3 font-mono shadow-card">
              <Activity className="w-10 h-10 text-soc-textMuted mx-auto" />
              <h3 className="text-soc-textPrimary font-bold text-sm">NO SIMULATION RESULTS YET</h3>
              <p className="text-soc-textMuted text-xs max-w-md mx-auto">
                Select a threat scenario from the catalog tab and click 'RUN' to execute telemetry through the detection pipeline.
              </p>
              <button
                onClick={() => setActiveTab('scenarios')}
                className="btn-primary-gradient text-white px-4 py-2 rounded text-xs font-bold cursor-pointer shadow-subtle transition-colors"
              >
                Go to Scenario Catalog
              </button>
            </div>
          ) : runResult.scenario === 'all' ? (
            <div className="space-y-6">
              <div className="bg-soc-surface p-6 rounded-xl border border-soc-border shadow-card space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-soc-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-soc-textPrimary">{runResult.title}</h2>
                    <p className="text-xs text-soc-textMuted mt-0.5">{runResult.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-bold bg-success-50 text-success-700 border border-success-200">
                    STATUS: {runResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase font-bold">Total Events</div>
                    <div className="text-xl font-bold text-soc-textPrimary">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3.5 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase font-bold">Detections Generated</div>
                    <div className="text-xl font-bold text-brand">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase font-bold">Alerts Created</div>
                    <div className="text-xl font-bold text-warning">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase font-bold">Duration / Rate</div>
                    <div className="text-xl font-bold text-success">{runResult.duration_sec}s <span className="text-xs text-soc-textMuted">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-soc-textTechnical pt-4 uppercase">Sequential Threat Execution Matrix</h3>
                <div className="overflow-x-auto rounded-lg border border-soc-border">
                  <table className="w-full text-left text-xs text-soc-textTechnical">
                    <thead className="bg-soc-surfaceSubtle text-soc-textMuted font-bold uppercase border-b border-soc-border text-[10px]">
                      <tr>
                        <th className="p-3">Scenario</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Detections</th>
                        <th className="p-3">Alerts Created</th>
                        <th className="p-3">Max Severity</th>
                        <th className="p-3">Max Risk Score</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-soc-border">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-soc-surfaceSubtle">
                          <td className="p-3 font-bold text-soc-textPrimary">{sc.title}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'DETECTED' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-soc-surfaceSubtle text-soc-textMuted'
                            }`}>
                              {sc.status}
                            </span>
                          </td>
                          <td className="p-3 text-soc-textTechnical">{sc.detections_count}</td>
                          <td className="p-3 font-bold text-warning">{sc.alerts_generated_count}</td>
                          <td className="p-3">{getSeverityBadge(sc.highest_severity)}</td>
                          <td className="p-3 font-bold text-brand">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-brand hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              View Alerts <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Single Scenario Detailed View */
            <div className="space-y-6 font-mono">
              <div className="bg-soc-surface p-6 rounded-xl border border-soc-border shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-soc-border pb-4">
                  <div>
                    <span className="text-xs text-brand font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-soc-textPrimary">{runResult.title}</h2>
                    <p className="text-xs text-soc-textMuted mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(runResult.highest_severity)}
                    <span className="px-3 py-1 rounded text-xs font-bold bg-success-50 text-success-700 border border-success-200">
                      {runResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase">Events Processed</div>
                    <div className="text-xl font-bold text-soc-textPrimary">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase">Detections Generated</div>
                    <div className="text-xl font-bold text-brand">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase">Alerts Created</div>
                    <div className="text-xl font-bold text-warning">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-ai">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-soc-surfaceSubtle border border-soc-border">
                    <div className="text-[10px] text-soc-textMuted uppercase">Max Risk Score</div>
                    <div className="text-xl font-bold text-brand">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-xs font-bold text-soc-textTechnical pt-4 uppercase">Persisted Telemetry Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-soc-surfaceSubtle text-xs text-soc-textMuted border border-soc-border">
                    No new alerts persisted (detections were suppressed by cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-soc-surfaceSubtle border border-soc-border space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soc-border pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-brand">{alt.alert_id}</span>
                            <h4 className="font-bold text-soc-textPrimary text-sm">{alt.threat_class}</h4>
                            {getSeverityBadge(alt.severity)}
                          </div>
                          <div className="text-xs text-soc-textMuted">
                            Risk Score: <span className="font-bold text-brand">{alt.confidence}</span> | Model: <span className="text-soc-textTechnical">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-soc-textMuted">
                          <div>Source: <span className="text-soc-textTechnical">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-soc-textTechnical">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector Engine: <span className="text-soc-textTechnical">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-soc-surface border border-soc-border space-y-2 text-xs shadow-subtle">
                            <div className="flex items-center justify-between text-soc-textTechnical font-bold border-b border-soc-border pb-1">
                              <span>Evidence & Model Inference Findings</span>
                              <span className="text-soc-textMuted">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-soc-textMuted">
                              {alt.evidence.reasons?.map((reason, rIdx) => (
                                <li key={rIdx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE WEBSOCKET FEED */}
      {activeTab === 'live_stream' && (
        <div className="bg-soc-surface p-6 rounded-xl border border-soc-border shadow-card space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-soc-border pb-4">
            <div>
              <h2 className="text-sm font-bold text-soc-textPrimary flex items-center gap-2 uppercase">
                <Radio className="w-4 h-4 text-ai animate-pulse" />
                LIVE WEBSOCKET SECURITY STREAM
              </h2>
              <p className="text-xs text-soc-textMuted mt-0.5">
                Real-time alert events broadcast asynchronously during demo runs.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-bold bg-ai-50 text-ai border border-ai-200">
              WebSocket: {wsStatus.toUpperCase()}
            </span>
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8 text-center text-soc-textMuted text-xs bg-soc-surfaceSubtle rounded-lg border border-dashed border-soc-border">
              Awaiting live WebSocket alert broadcasts. Run a scenario in the catalog tab to see streaming events.
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-soc-surfaceSubtle border border-soc-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-soc-textMuted">{formatIndianTime(alt.timestamp)}</span>
                    <span className="font-bold text-brand">{alt.alert_id}</span>
                    <span className="font-bold text-soc-textPrimary">{alt.threat_class}</span>
                    {getSeverityBadge(alt.severity)}
                  </div>
                  <div className="flex items-center gap-4 text-soc-textMuted">
                    <span>{alt.source_ip} → {alt.destination_ip}:{alt.destination_port}</span>
                    <span className="text-brand font-bold">Score: {alt.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
