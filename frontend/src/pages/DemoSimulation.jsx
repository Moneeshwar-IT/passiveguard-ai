import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RotateCcw, ShieldAlert, Radio, Search, FileCode, Terminal,
  Lock, PlayCircle, CheckCircle2, AlertTriangle, Cpu, Server, Activity,
  ArrowRight, ShieldCheck, RefreshCw, Layers
} from 'lucide-react';
import {
  runDemoScenario, resetDemoState, fetchDemoStatus, fetchDemoScenarios,
  createWebSocketConnection, API_BASE_URL, formatIndianTime
} from '../services/api';

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
  const [wsStatus, setWsStatus] = useState('connecting');

  useEffect(() => {
    fetchDemoScenarios().then((res) => {
      if (res && res.scenarios) {
        setScenariosList(res.scenarios);
      }
    }).catch(console.error);

    fetchDemoStatus().then((res) => {
      if (res && res.is_running) setIsRunning(true);
      if (res && res.last_run) setRunResult(res.last_run);
    }).catch(console.error);

    const ws = createWebSocketConnection(
      (msg) => {
        if (msg.type === 'alert_created' || msg.event === 'alert_created') {
          if (msg.data) {
            setLiveWsAlerts((prev) => [msg.data, ...prev.slice(0, 49)]);
          }
        }
        if (msg.type === 'state_reset' || msg.event === 'state_reset') {
          setLiveWsAlerts([]);
          setRunResult(null);
        }
      },
      (status) => setWsStatus(status)
    );

    return () => ws.close();
  }, []);

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
      case 'ddos': return { border: 'hover:border-rose-500', icon: <ShieldAlert className="w-5 h-5 text-rose-400" />, tag: 'text-rose-400' };
      case 'c2': return { border: 'hover:border-purple-500', icon: <Radio className="w-5 h-5 text-purple-400" />, tag: 'text-purple-400' };
      case 'dga': return { border: 'hover:border-indigo-500', icon: <Terminal className="w-5 h-5 text-indigo-400" />, tag: 'text-indigo-400' };
      case 'dns_tunnel': return { border: 'hover:border-cyan-500', icon: <FileCode className="w-5 h-5 text-cyan-400" />, tag: 'text-cyan-400' };
      case 'tls_malware': return { border: 'hover:border-amber-500', icon: <Lock className="w-5 h-5 text-amber-400" />, tag: 'text-amber-400' };
      case 'recon': return { border: 'hover:border-cyan-400', icon: <Search className="w-5 h-5 text-cyan-400" />, tag: 'text-cyan-400' };
      case 'exfiltration': return { border: 'hover:border-rose-400', icon: <Activity className="w-5 h-5 text-rose-400" />, tag: 'text-rose-400' };
      default: return { border: 'hover:border-cyan-400', icon: <Cpu className="w-5 h-5 text-cyan-400" />, tag: 'text-cyan-400' };
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">INFO / BENIGN</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md p-6 rounded-xl border border-slate-800/80 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-slate-100 tracking-tight uppercase flex items-center gap-2">
              <span className="text-purple-400">DEMO</span> <span className="text-cyan-400">LAB & SIMULATION</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              SIMULATION SUITE
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Controlled passive threat simulation suite for Smart India Hackathon live judging demonstration.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunDemo('all')}
            disabled={isRunning}
            className="btn-cyan px-4 py-2.5 rounded-lg text-xs font-mono font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            RUN FULL DEMO
          </button>

          <button
            onClick={() => handleRunDemo()}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold bg-slate-800/80 hover:bg-slate-800 text-cyan-400 border border-slate-700/80 hover:border-cyan-400 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                EXECUTING PIPELINE...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-cyan-400" />
                RUN SELECTED ({selectedScenario.toUpperCase()})
              </>
            )}
          </button>

          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700/80 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-cyan-400' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Prominent Safety Banner & Simulation Indicators */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/30 pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            OFFLINE CONTROLLED ENVIRONMENT — PASSIVE SECURITY GUARANTEES
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/30 text-emerald-400 font-bold">● LIVE SIMULATION</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/30 text-cyan-400 font-bold">PCAP REPLAY</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-indigo-500/30 text-indigo-400 font-bold">REAL DATA-DIODE FEED</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-slate-200">
          <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 shadow-md font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>NO PACKETS TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 shadow-md font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>NO ACTIVE PROBING</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 shadow-md font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>NO PAYLOAD DECRYPTION</span>
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800/80 text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'scenarios'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="px-2 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Active</span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_stream'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4 text-purple-400" />
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
                      ? 'bg-cyan-500/10 border-cyan-400 shadow-xl ring-1 ring-cyan-400/40'
                      : `bg-slate-900/80 border-slate-800/80 ${accent.border} hover:bg-slate-800/50`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          {accent.icon}
                        </div>
                        <div>
                          <h3 className="font-bold font-mono text-slate-100 text-sm">{sc.title}</h3>
                          <span className={`text-[10px] font-mono uppercase font-bold ${accent.tag}`}>{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-2 font-mono">
                    <span className="text-[10px] text-slate-400">ID: {sc.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScenario(sc.id);
                        handleRunDemo(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded text-xs font-bold btn-cyan shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-slate-950" />
                      RUN SCENARIO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-xl">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
              />
              <label htmlFor="autoReset" className="text-xs text-slate-300 cursor-pointer font-medium">
                Automatically reset alert store & temporal state before running scenario
              </label>
            </div>
            <button
              onClick={() => handleRunDemo('all')}
              disabled={isRunning}
              className="btn-cyan px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              EXECUTE ALL 7 SCENARIOS SEQUENTIALLY
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!runResult ? (
            <div className="p-12 text-center bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-3 font-mono shadow-xl">
              <Activity className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-slate-100 font-bold text-sm">NO SIMULATION RESULTS YET</h3>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                Select a threat scenario from the catalog tab and click 'RUN' to execute telemetry through the detection pipeline.
              </p>
              <button
                onClick={() => setActiveTab('scenarios')}
                className="btn-cyan px-4 py-2 rounded text-xs font-bold cursor-pointer shadow-md transition-colors"
              >
                Go to Scenario Catalog
              </button>
            </div>
          ) : runResult.scenario === 'all' ? (
            <div className="space-y-6">
              <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800/80 shadow-xl space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{runResult.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{runResult.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    STATUS: {runResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Total Events</div>
                    <div className="text-xl font-bold text-slate-100">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Detections Generated</div>
                    <div className="text-xl font-bold text-cyan-400">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-400">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Duration / Rate</div>
                    <div className="text-xl font-bold text-emerald-400">{runResult.duration_sec}s <span className="text-xs text-slate-400">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-slate-300 pt-4 uppercase">Sequential Threat Execution Matrix</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase border-b border-slate-800/80 text-[10px]">
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
                    <tbody className="divide-y divide-slate-800/80">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/50">
                          <td className="p-3 font-bold text-slate-100">{sc.title}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'DETECTED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {sc.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300">{sc.detections_count}</td>
                          <td className="p-3 font-bold text-amber-400">{sc.alerts_generated_count}</td>
                          <td className="p-3">{getSeverityBadge(sc.highest_severity)}</td>
                          <td className="p-3 font-bold text-cyan-400">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-cyan-400 hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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
              <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800/80 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div>
                    <span className="text-xs text-cyan-400 font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-slate-100">{runResult.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(runResult.highest_severity)}
                    <span className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      {runResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Events Processed</div>
                    <div className="text-xl font-bold text-slate-100">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Detections Generated</div>
                    <div className="text-xl font-bold text-cyan-400">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-400">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-purple-400">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Max Risk Score</div>
                    <div className="text-xl font-bold text-cyan-400">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-xs font-bold text-slate-300 pt-4 uppercase">Persisted Telemetry Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-slate-950/60 text-xs text-slate-400 border border-slate-800/80">
                    No new alerts persisted (detections were suppressed by cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-cyan-400">{alt.alert_id}</span>
                            <h4 className="font-bold text-slate-100 text-sm">{alt.threat_class}</h4>
                            {getSeverityBadge(alt.severity)}
                          </div>
                          <div className="text-xs text-slate-400">
                            Risk Score: <span className="font-bold text-cyan-400">{alt.confidence}</span> | Model: <span className="text-slate-300">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-400">
                          <div>Source: <span className="text-slate-300">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-slate-300">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector Engine: <span className="text-slate-300">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-slate-900 border border-slate-800/80 space-y-2 text-xs shadow-inner">
                            <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800/80 pb-1">
                              <span>Evidence & Model Inference Findings</span>
                              <span className="text-slate-400">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-slate-400">
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
        <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800/80 shadow-xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase">
                <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                LIVE WEBSOCKET SECURITY STREAM
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time alert events broadcast asynchronously during demo runs.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40">
              WebSocket: {wsStatus.toUpperCase()}
            </span>
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/60 rounded-lg border border-dashed border-slate-800">
              Awaiting live WebSocket alert broadcasts. Run a scenario in the catalog tab to see streaming events.
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{formatIndianTime(alt.timestamp)}</span>
                    <span className="font-bold text-cyan-400">{alt.alert_id}</span>
                    <span className="font-bold text-slate-100">{alt.threat_class}</span>
                    {getSeverityBadge(alt.severity)}
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>{alt.source_ip} → {alt.destination_ip}:{alt.destination_port}</span>
                    <span className="text-cyan-400 font-bold">Score: {alt.confidence}</span>
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
