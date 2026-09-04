import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RotateCcw, ShieldAlert, Radio, Search, FileCode, Terminal,
  Lock, UploadCloud, Layers, PlayCircle, CheckCircle2, AlertTriangle,
  Info, Cpu, Server, Activity, ArrowRight, ShieldCheck, Database, RefreshCw
} from 'lucide-react';
import { runDemoScenario, resetDemoState, fetchDemoStatus, fetchDemoScenarios, createWebSocketConnection, API_BASE_URL } from '../services/api';

const formatApiError = (err, fallbackText) => {
  if (err.response) {
    const status = err.response.status;
    const detail = err.response.data?.detail || err.response.data?.message;
    return detail ? `[HTTP ${status}] ${detail}` : `[HTTP ${status}] ${fallbackText}`;
  }
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Request timed out waiting for backend response. If backend was sleeping (Render cold-start), please wait a few seconds and retry.';
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
  const [activeTab, setActiveTab] = useState('scenarios'); // scenarios | results | live_stream
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
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

  const [resetSuccessMsg, setResetSuccessMsg] = useState(null);

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

  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'Search': return <Search className="w-5 h-5 text-amber-400" />;
      case 'Radio': return <Radio className="w-5 h-5 text-purple-400" />;
      case 'FileCode': return <FileCode className="w-5 h-5 text-emerald-400" />;
      case 'Terminal': return <Terminal className="w-5 h-5 text-cyan-400" />;
      case 'Lock': return <Lock className="w-5 h-5 text-blue-400" />;
      case 'UploadCloud': return <UploadCloud className="w-5 h-5 text-indigo-400" />;
      case 'Layers': return <Layers className="w-5 h-5 text-orange-400" />;
      case 'PlayCircle': return <PlayCircle className="w-5 h-5 text-teal-400" />;
      default: return <Cpu className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">INFO / BENIGN</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-xl border border-slate-800 shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Controlled Threat Demonstration</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              PASSIVE ENCLAVE ACTIVE
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Execute offline threat scenarios through the full detection pipeline directly from the SOC Dashboard.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunDemo('all')}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 transition-all shadow-lg shadow-teal-950/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle className="w-4 h-4" />
            RUN FULL DEMO
          </button>
          <button
            onClick={() => handleRunDemo()}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-950/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >

          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              EXECUTING PIPELINE...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              RUN SELECTED ({selectedScenario.toUpperCase()})
            </>
          )}
          </button>
          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Passive Security Constraints Notice Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mode</div>
            <div className="text-xs font-bold text-slate-200">OFFLINE CONTROLLED DEMO</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 flex items-center gap-3">
          <Server className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Network Transmission</div>
            <div className="text-xs font-bold text-emerald-400">DISABLED (0 PACKETS EMITTED)</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 flex items-center gap-3">
          <Terminal className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">External DNS & Active Probe</div>
            <div className="text-xs font-bold text-emerald-400">DISABLED (STRICT PASSIVE)</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 flex items-center gap-3">
          <Lock className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">TLS Decryption</div>
            <div className="text-xs font-bold text-emerald-400">DISABLED (METADATA ONLY)</div>
          </div>
        </div>
      </div>

      {/* Error & Success Alert Displays */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-sm font-medium">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'scenarios'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Threat Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'results'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="px-2 py-0.2 rounded-full text-xs bg-blue-500/20 text-blue-300">Active</span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'live_stream'
              ? 'border-blue-500 text-blue-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4 text-purple-400" />
          Live WebSocket Alert Feed ({liveWsAlerts.length})
        </button>
      </div>

      {/* TAB 1: SCENARIO CATALOG & SELECTION */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenariosList.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-blue-500/80 shadow-lg shadow-blue-950/30 ring-1 ring-blue-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          {getIconComponent(sc.icon)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 text-base leading-tight">{sc.title}</h3>
                          <span className="text-xs text-slate-400">{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-2">
                    <span className="text-xs font-mono text-slate-500">ID: {sc.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScenario(sc.id);
                        handleRunDemo(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600/80 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      RUN
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoReset" className="text-xs text-slate-300 cursor-pointer">
                Automatically reset SQLite store and detector state before executing scenario
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunDemo('all')}
                disabled={isRunning}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" />
                EXECUTE ALL SCENARIOS SEQUENTIALLY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!runResult ? (
            <div className="p-12 text-center bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <Activity className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-slate-300 font-bold">No Simulation Results Available</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Select a threat scenario from the catalog and click 'RUN' to execute the telemetry pipeline.
              </p>
              <button
                onClick={() => setActiveTab('scenarios')}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Go to Scenario Catalog
              </button>
            </div>
          ) : runResult.scenario === 'all' ? (
            /* Full Demo Sequential Table View */
            <div className="space-y-6">
              <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{runResult.title}</h2>
                    <p className="text-xs text-slate-400">{runResult.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    STATUS: {runResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Total Events</div>
                    <div className="text-xl font-bold text-slate-100">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Total Detections</div>
                    <div className="text-xl font-bold text-blue-400">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-400">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Duration / Rate</div>
                    <div className="text-xl font-bold text-emerald-400">{runResult.duration_sec}s <span className="text-xs text-slate-400">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-300 pt-4">Sequential Threat Scenario Execution Summary</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase border-b border-slate-800">
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
                    <tbody className="divide-y divide-slate-800">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-100">{sc.title}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sc.status === 'DETECTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {sc.status}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-200">{sc.detections_count}</td>
                          <td className="p-3 font-semibold text-amber-400">{sc.alerts_generated_count}</td>
                          <td className="p-3">{getSeverityBadge(sc.highest_severity)}</td>
                          <td className="p-3 font-mono font-bold text-cyan-400">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1"
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
            <div className="space-y-6">
              <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono text-blue-400 font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-slate-100">{runResult.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(runResult.highest_severity)}
                    <span className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {runResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Events Processed</div>
                    <div className="text-xl font-bold text-slate-100">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Detections Generated</div>
                    <div className="text-xl font-bold text-blue-400">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-400">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-purple-400">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                    <div className="text-xs text-slate-400">Max Risk Score</div>
                    <div className="text-xl font-bold text-cyan-400">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-sm font-bold text-slate-300 pt-4">Generated Pipeline Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-slate-950/40 text-xs text-slate-400 border border-slate-800">
                    No new alerts persisted (detections were suppressed by 60s cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-blue-400">{alt.alert_id}</span>
                            <h4 className="font-bold text-slate-100 text-sm">{alt.threat_class}</h4>
                            {getSeverityBadge(alt.severity)}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            Risk Score: <span className="font-bold text-cyan-400">{alt.confidence}</span> | Model: <span className="text-slate-300">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                          <div>Source: <span className="text-slate-200">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-slate-200">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector: <span className="text-slate-200">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-slate-900/90 border border-slate-800/90 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800 pb-1">
                              <span>Evidence & Model Inference Analysis</span>
                              <span className="text-slate-500 font-mono">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
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

      {/* TAB 3: LIVE WEBSOCKET ALERT FEED */}
      {activeTab === 'live_stream' && (
        <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
                Live WebSocket Security Alert Stream
              </h2>
              <p className="text-xs text-slate-400">
                Real-time alert events broadcast by the SQLite alert poller asynchronously during demo runs.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              WebSocket: {wsStatus.toUpperCase()}
            </span>
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Waiting for live WebSocket alerts. Run a demo scenario to see streaming events.
            </div>
          ) : (
            <div className="space-y-3">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{new Date(alt.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold text-blue-400">{alt.alert_id}</span>
                    <span className="font-bold text-slate-200">{alt.threat_class}</span>
                    {getSeverityBadge(alt.severity)}
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>{alt.source_ip} -&gt; {alt.destination_ip}:{alt.destination_port}</span>
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
