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
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';

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
      case 'ddos': return { border: 'hover:border-rose-500', icon: <ShieldAlert className="w-5 h-5 text-rose-500" />, tag: 'text-rose-500' };
      case 'c2': return { border: 'hover:border-purple-500', icon: <Radio className="w-5 h-5 text-purple-500" />, tag: 'text-purple-500' };
      case 'dga': return { border: 'hover:border-indigo-500', icon: <Terminal className="w-5 h-5 text-indigo-500" />, tag: 'text-indigo-500' };
      case 'dns_tunnel': return { border: 'hover:border-blue-500', icon: <FileCode className="w-5 h-5 text-blue-500" />, tag: 'text-blue-500' };
      case 'tls_malware': return { border: 'hover:border-amber-500', icon: <Lock className="w-5 h-5 text-amber-500" />, tag: 'text-amber-500' };
      case 'recon': return { border: 'hover:border-blue-500', icon: <Search className="w-5 h-5 text-blue-500" />, tag: 'text-blue-500' };
      case 'exfiltration': return { border: 'hover:border-purple-500', icon: <Activity className="w-5 h-5 text-purple-500" />, tag: 'text-purple-500' };
      default: return { border: 'hover:border-blue-500', icon: <Cpu className="w-5 h-5 text-blue-500" />, tag: 'text-blue-500' };
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans transition-colors">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-enterprise-surface dark:bg-enterprise-surfaceDark p-6 rounded-xl border border-enterprise-border dark:border-enterprise-borderDark shadow-card transition-colors">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight uppercase flex items-center gap-2">
              <span className="text-purple-500">DEMO</span> <span className="text-enterprise-primary dark:text-enterprise-primaryDark">LAB & SIMULATION</span>
            </h1>
            <Badge type="ACTIVE" label="CONTROLLED SIMULATION ENVIRONMENT" pulse />
          </div>
          <p className="text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark text-xs mt-1 font-medium">
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
            className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold bg-enterprise-surface dark:bg-enterprise-surfaceDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark text-enterprise-primary dark:text-enterprise-primaryDark border border-enterprise-border dark:border-enterprise-borderDark hover:border-enterprise-primary transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-subtle"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-enterprise-primary dark:text-enterprise-primaryDark" />
                EXECUTING PIPELINE...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-enterprise-primary dark:text-enterprise-primaryDark" />
                RUN SELECTED ({selectedScenario.toUpperCase()})
              </>
            )}
          </button>

          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold bg-enterprise-surface dark:bg-enterprise-surfaceDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark border border-enterprise-border dark:border-enterprise-borderDark transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-subtle"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-enterprise-primary dark:text-enterprise-primaryDark' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Prominent Safety Banner & Simulation Indicators */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            OFFLINE CONTROLLED ENVIRONMENT — PASSIVE SECURITY GUARANTEES
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <Badge type="HEALTHY" label="● LIVE SIMULATION" />
            <Badge type="LOW" label="PCAP REPLAY" />
            <Badge type="INDIGO" label="REAL DATA-DIODE FEED" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">
          <div className="flex items-center gap-2 bg-enterprise-surface dark:bg-enterprise-surfaceDark p-2.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>NO PACKETS TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 bg-enterprise-surface dark:bg-enterprise-surfaceDark p-2.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>NO ACTIVE PROBING</span>
          </div>
          <div className="flex items-center gap-2 bg-enterprise-surface dark:bg-enterprise-surfaceDark p-2.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark shadow-subtle font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>NO PAYLOAD DECRYPTION</span>
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-enterprise-border dark:border-enterprise-borderDark text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'scenarios'
              ? 'border-enterprise-primary dark:border-enterprise-primaryDark text-enterprise-primary dark:text-enterprise-primaryDark'
              : 'border-transparent text-enterprise-textMuted dark:text-enterprise-textMutedDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark'
          }`}
        >
          <Layers className="w-4 h-4" />
          Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-enterprise-primary dark:border-enterprise-primaryDark text-enterprise-primary dark:text-enterprise-primaryDark'
              : 'border-transparent text-enterprise-textMuted dark:text-enterprise-textMutedDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="ml-1.5"><Badge type="LOW" label="Active" /></span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_stream'
              ? 'border-enterprise-primary dark:border-enterprise-primaryDark text-enterprise-primary dark:text-enterprise-primaryDark'
              : 'border-transparent text-enterprise-textMuted dark:text-enterprise-textMutedDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark'
          }`}
        >
          <Radio className="w-4 h-4 text-purple-500" />
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
                      ? 'bg-enterprise-primary/10 dark:bg-enterprise-primaryDark/15 border-enterprise-primary dark:border-enterprise-primaryDark shadow-cardHover ring-1 ring-enterprise-primary/40'
                      : `bg-enterprise-surface dark:bg-enterprise-surfaceDark border-enterprise-border dark:border-enterprise-borderDark ${accent.border} hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                          {accent.icon}
                        </div>
                        <div>
                          <h3 className="font-bold font-mono text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark text-sm">{sc.title}</h3>
                          <span className={`text-[10px] font-mono uppercase font-bold ${accent.tag}`}>{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-enterprise-primary dark:text-enterprise-primaryDark shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-enterprise-border dark:border-enterprise-borderDark mt-2 font-mono">
                    <span className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark">ID: {sc.id}</span>
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

          <div className="p-4 rounded-xl bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-card">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surface dark:bg-enterprise-surfaceDark text-enterprise-primary focus:ring-enterprise-primary"
              />
              <label htmlFor="autoReset" className="text-xs text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark cursor-pointer font-medium">
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
            <div className="p-8">
              <EmptyState
                title="NO SIMULATION RESULTS YET"
                description="Select a threat scenario from the catalog tab and click 'RUN' to execute telemetry through the detection pipeline."
                actionLabel="Go to Scenario Catalog"
                onAction={() => setActiveTab('scenarios')}
              />
            </div>
          ) : runResult.scenario === 'all' ? (
            <div className="space-y-6">
              <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark p-6 rounded-xl border border-enterprise-border dark:border-enterprise-borderDark shadow-card space-y-4 font-mono transition-colors">
                <div className="flex items-center justify-between border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{runResult.title}</h2>
                    <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5">{runResult.description}</p>
                  </div>
                  <Badge type="HEALTHY" label={`STATUS: ${runResult.status}`} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase font-bold">Total Events</div>
                    <div className="text-xl font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3.5 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase font-bold">Detections Generated</div>
                    <div className="text-xl font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase font-bold">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-500">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase font-bold">Duration / Rate</div>
                    <div className="text-xl font-bold text-emerald-500">{runResult.duration_sec}s <span className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark pt-4 uppercase">Sequential Threat Execution Matrix</h3>
                <div className="overflow-x-auto rounded-lg border border-enterprise-border dark:border-enterprise-borderDark">
                  <table className="w-full text-left text-xs text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">
                    <thead className="bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark text-enterprise-textMuted dark:text-enterprise-textMutedDark font-bold uppercase border-b border-enterprise-border dark:border-enterprise-borderDark text-[10px]">
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
                    <tbody className="divide-y divide-enterprise-border dark:divide-enterprise-borderDark">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark">
                          <td className="p-3 font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{sc.title}</td>
                          <td className="p-3">
                            {sc.status === 'DETECTED' ? (
                              <Badge type="HEALTHY" label={sc.status} />
                            ) : (
                              <Badge type="OFFLINE" label={sc.status} />
                            )}
                          </td>
                          <td className="p-3 text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{sc.detections_count}</td>
                          <td className="p-3 font-bold text-amber-500">{sc.alerts_generated_count}</td>
                          <td className="p-3"><Badge type={sc.highest_severity} /></td>
                          <td className="p-3 font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-enterprise-primary dark:text-enterprise-primaryDark hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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
              <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark p-6 rounded-xl border border-enterprise-border dark:border-enterprise-borderDark shadow-card space-y-4 transition-colors">
                <div className="flex items-center justify-between border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
                  <div>
                    <span className="text-xs text-enterprise-primary dark:text-enterprise-primaryDark font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{runResult.title}</h2>
                    <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge type={runResult.highest_severity} />
                    <Badge type="HEALTHY" label={runResult.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">Events Processed</div>
                    <div className="text-xl font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">Detections Generated</div>
                    <div className="text-xl font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">Alerts Created</div>
                    <div className="text-xl font-bold text-amber-500">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-purple-500">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark">
                    <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase">Max Risk Score</div>
                    <div className="text-xl font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-xs font-bold text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark pt-4 uppercase">Persisted Telemetry Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark border border-enterprise-border dark:border-enterprise-borderDark">
                    No new alerts persisted (detections were suppressed by cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-enterprise-border dark:border-enterprise-borderDark pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{alt.alert_id}</span>
                            <h4 className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark text-sm">{alt.threat_class}</h4>
                            <Badge type={alt.severity} />
                          </div>
                          <div className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                            Risk Score: <span className="font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{alt.confidence}</span> | Model: <span className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                          <div>Source: <span className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector Engine: <span className="text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark space-y-2 text-xs shadow-subtle">
                            <div className="flex items-center justify-between text-enterprise-textTechnical dark:text-enterprise-textTechnicalDark font-bold border-b border-enterprise-border dark:border-enterprise-borderDark pb-1">
                              <span>Evidence & Model Inference Findings</span>
                              <span className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-enterprise-textMuted dark:text-enterprise-textMutedDark">
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
        <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark p-6 rounded-xl border border-enterprise-border dark:border-enterprise-borderDark shadow-card space-y-4 font-mono transition-colors">
          <div className="flex items-center justify-between border-b border-enterprise-border dark:border-enterprise-borderDark pb-4">
            <div>
              <h2 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark flex items-center gap-2 uppercase">
                <Radio className="w-4 h-4 text-purple-500 animate-pulse" />
                LIVE WEBSOCKET SECURITY STREAM
              </h2>
              <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5">
                Real-time alert events broadcast asynchronously during demo runs.
              </p>
            </div>
            <Badge type="AI" label={`WebSocket: ${wsStatus.toUpperCase()}`} />
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="AWAITING WEBSOCKET ALERTS"
                description="Run a scenario in the catalog tab to see live streaming alert broadcasts."
                icon={Radio}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-enterprise-textMuted dark:text-enterprise-textMutedDark">{formatIndianTime(alt.timestamp)}</span>
                    <span className="font-bold text-enterprise-primary dark:text-enterprise-primaryDark">{alt.alert_id}</span>
                    <span className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark">{alt.threat_class}</span>
                    <Badge type={alt.severity} />
                  </div>
                  <div className="flex items-center gap-4 text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                    <span>{alt.source_ip} → {alt.destination_ip}:{alt.destination_port}</span>
                    <span className="text-enterprise-primary dark:text-enterprise-primaryDark font-bold">Score: {alt.confidence}</span>
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
