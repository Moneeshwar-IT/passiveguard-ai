import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RotateCcw, ShieldAlert, Radio, Search, FileCode, Terminal,
  Lock, PlayCircle, CheckCircle2, AlertTriangle, Cpu, Server, Activity,
  ArrowRight, ShieldCheck, RefreshCw, Layers
} from 'lucide-react';
import {
  runDemoScenario, resetDemoState, fetchDemoStatus, fetchDemoScenarios,
  createWebSocketConnection, API_BASE_URL
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
      case 'ddos': return { border: 'hover:border-[#EF4444]', icon: <ShieldAlert className="w-5 h-5 text-[#EF4444]" />, tag: 'text-[#EF4444]' };
      case 'c2': return { border: 'hover:border-[#A855F7]', icon: <Radio className="w-5 h-5 text-[#A855F7]" />, tag: 'text-[#A855F7]' };
      case 'dga': return { border: 'hover:border-[#6366F1]', icon: <Terminal className="w-5 h-5 text-[#6366F1]" />, tag: 'text-[#6366F1]' };
      case 'dns_tunnel': return { border: 'hover:border-[#38BDF8]', icon: <FileCode className="w-5 h-5 text-[#38BDF8]" />, tag: 'text-[#38BDF8]' };
      case 'tls_malware': return { border: 'hover:border-[#F59E0B]', icon: <Lock className="w-5 h-5 text-[#F59E0B]" />, tag: 'text-[#F59E0B]' };
      case 'recon': return { border: 'hover:border-[#22D3EE]', icon: <Search className="w-5 h-5 text-[#22D3EE]" />, tag: 'text-[#22D3EE]' };
      case 'exfiltration': return { border: 'hover:border-[#EC4899]', icon: <Activity className="w-5 h-5 text-[#EC4899]" />, tag: 'text-[#EC4899]' };
      default: return { border: 'hover:border-[#22D3EE]', icon: <Cpu className="w-5 h-5 text-[#22D3EE]" />, tag: 'text-[#22D3EE]' };
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[#EF4444]/40">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(239,68,68,0.10)] text-[#F87171] border border-[#F87171]/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border border-[#F59E0B]/40">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,211,238,0.10)] text-[#22D3EE] border border-[#22D3EE]/30">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#050816] text-[#94A3B8] border border-[#1C2A45]">INFO / BENIGN</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D1426] p-6 rounded-xl border border-[#1C2A45] shadow-xs hover:shadow-sm transition-all">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-[#F8FAFC] tracking-tight uppercase flex items-center gap-2">
              <span className="text-[#A855F7]">DEMO</span> <span className="text-[#22D3EE]">LAB & SIMULATION</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,211,238,0.10)] text-[#22D3EE] border border-[#22D3EE]/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse"></span>
              CONTROLLED SIMULATION ENVIRONMENT
            </span>
          </div>
          <p className="text-[#94A3B8] text-xs mt-1 font-medium">
            Controlled passive threat simulation suite for Smart India Hackathon live judging demonstration.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunDemo('all')}
            disabled={isRunning}
            className="btn-primary-gradient text-[#050816] px-4 py-2.5 rounded-lg text-xs font-mono font-bold shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            RUN FULL DEMO
          </button>

          <button
            onClick={() => handleRunDemo()}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold bg-[#0D1426] hover:bg-[#111B32] text-[#22D3EE] border border-[#1C2A45] hover:border-[#22D3EE]/40 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#22D3EE]" />
                EXECUTING PIPELINE...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#22D3EE]" />
                RUN SELECTED ({selectedScenario.toUpperCase()})
              </>
            )}
          </button>

          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold bg-[#0D1426] hover:bg-[#111B32] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1C2A45] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-[#22D3EE]' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Prominent Safety Banner & Simulation Indicators */}
      <div className="bg-[rgba(34,211,238,0.06)] border border-[#22D3EE]/30 p-4 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#22D3EE]/20 pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#22D3EE] uppercase">
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
            OFFLINE CONTROLLED ENVIRONMENT — PASSIVE SECURITY GUARANTEES
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-[#0D1426] border border-[#22C55E]/30 text-[#22C55E] font-bold">● LIVE SIMULATION</span>
            <span className="px-2 py-0.5 rounded bg-[#0D1426] border border-[#22D3EE]/30 text-[#22D3EE] font-bold">PCAP REPLAY</span>
            <span className="px-2 py-0.5 rounded bg-[#0D1426] border border-[#6366F1]/30 text-[#6366F1] font-bold">REAL DATA-DIODE FEED</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-[#F8FAFC]">
          <div className="flex items-center gap-2 bg-[#080D1C] p-2.5 rounded-lg border border-[#1C2A45] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>NO PACKETS TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 bg-[#080D1C] p-2.5 rounded-lg border border-[#1C2A45] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>NO ACTIVE PROBING</span>
          </div>
          <div className="flex items-center gap-2 bg-[#080D1C] p-2.5 rounded-lg border border-[#1C2A45] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>NO PAYLOAD DECRYPTION</span>
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[#EF4444]/40 text-[#EF4444] text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#EF4444]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-[rgba(34,197,94,0.12)] border border-[#22C55E]/30 text-[#22C55E] text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#22C55E]" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#1C2A45] text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'scenarios'
              ? 'border-[#22D3EE] text-[#22D3EE]'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-[#22D3EE] text-[#22D3EE]'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="px-2 py-0.2 rounded text-[10px] bg-[rgba(34,211,238,0.10)] text-[#22D3EE] border border-[#22D3EE]/30">Active</span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_stream'
              ? 'border-[#22D3EE] text-[#22D3EE]'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Radio className="w-4 h-4 text-[#A855F7]" />
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
                      ? 'bg-[rgba(34,211,238,0.08)] border-[#22D3EE] shadow-md ring-1 ring-[#22D3EE]/50'
                      : `bg-[#0D1426] border-[#1C2A45] ${accent.border} hover:bg-[#111B32]`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#050816] border border-[#1C2A45]">
                          {accent.icon}
                        </div>
                        <div>
                          <h3 className="font-bold font-mono text-[#F8FAFC] text-sm">{sc.title}</h3>
                          <span className={`text-[10px] font-mono uppercase font-bold ${accent.tag}`}>{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-[#22D3EE] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#1C2A45] mt-2 font-mono">
                    <span className="text-[10px] text-[#94A3B8]">ID: {sc.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScenario(sc.id);
                        handleRunDemo(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded text-xs font-bold btn-primary-gradient text-[#050816] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-[#050816]" />
                      RUN SCENARIO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-[#0D1426] border border-[#1C2A45] flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-sm">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded border-[#1C2A45] bg-[#050816] text-[#22D3EE] focus:ring-[#22D3EE]"
              />
              <label htmlFor="autoReset" className="text-xs text-[#CBD5E1] cursor-pointer font-medium">
                Automatically reset alert store & temporal state before running scenario
              </label>
            </div>
            <button
              onClick={() => handleRunDemo('all')}
              disabled={isRunning}
              className="btn-primary-gradient text-[#050816] px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
            >
              <PlayCircle className="w-4 h-4 text-[#050816]" />
              EXECUTE ALL 7 SCENARIOS SEQUENTIALLY
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!runResult ? (
            <div className="p-12 text-center bg-[#0D1426] rounded-xl border border-[#1C2A45] space-y-3 font-mono shadow-sm">
              <Activity className="w-10 h-10 text-[#64748B] mx-auto" />
              <h3 className="text-[#F8FAFC] font-bold text-sm">NO SIMULATION RESULTS YET</h3>
              <p className="text-[#94A3B8] text-xs max-w-md mx-auto">
                Select a threat scenario from the catalog tab and click 'RUN' to execute telemetry through the detection pipeline.
              </p>
              <button
                onClick={() => setActiveTab('scenarios')}
                className="btn-primary-gradient text-[#050816] px-4 py-2 rounded text-xs font-bold cursor-pointer shadow-sm transition-colors"
              >
                Go to Scenario Catalog
              </button>
            </div>
          ) : runResult.scenario === 'all' ? (
            <div className="space-y-6">
              <div className="bg-[#0D1426] p-6 rounded-xl border border-[#1C2A45] shadow-sm space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-[#1C2A45] pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#F8FAFC]">{runResult.title}</h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{runResult.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-bold bg-[rgba(34,197,94,0.12)] text-[#22C55E] border border-[#22C55E]/30">
                    STATUS: {runResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase font-bold">Total Events</div>
                    <div className="text-xl font-bold text-[#F8FAFC]">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase font-bold">Detections Generated</div>
                    <div className="text-xl font-bold text-[#22D3EE]">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase font-bold">Alerts Created</div>
                    <div className="text-xl font-bold text-[#F59E0B]">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase font-bold">Duration / Rate</div>
                    <div className="text-xl font-bold text-[#22C55E]">{runResult.duration_sec}s <span className="text-xs text-[#94A3B8]">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-[#CBD5E1] pt-4 uppercase">Sequential Threat Execution Matrix</h3>
                <div className="overflow-x-auto rounded-lg border border-[#1C2A45]">
                  <table className="w-full text-left text-xs text-[#CBD5E1]">
                    <thead className="bg-[#050816] text-[#94A3B8] font-bold uppercase border-b border-[#1C2A45] text-[10px]">
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
                    <tbody className="divide-y divide-[#1C2A45]">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-[#111B32]">
                          <td className="p-3 font-bold text-[#F8FAFC]">{sc.title}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'DETECTED' ? 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]' : 'bg-[#080D1C] text-[#94A3B8]'
                            }`}>
                              {sc.status}
                            </span>
                          </td>
                          <td className="p-3 text-[#CBD5E1]">{sc.detections_count}</td>
                          <td className="p-3 font-bold text-[#F59E0B]">{sc.alerts_generated_count}</td>
                          <td className="p-3">{getSeverityBadge(sc.highest_severity)}</td>
                          <td className="p-3 font-bold text-[#22D3EE]">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-[#22D3EE] hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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
              <div className="bg-[#0D1426] p-6 rounded-xl border border-[#1C2A45] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#1C2A45] pb-4">
                  <div>
                    <span className="text-xs text-[#22D3EE] font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-[#F8FAFC]">{runResult.title}</h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(runResult.highest_severity)}
                    <span className="px-3 py-1 rounded text-xs font-bold bg-[rgba(34,197,94,0.12)] text-[#22C55E] border border-[#22C55E]/30">
                      {runResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase">Events Processed</div>
                    <div className="text-xl font-bold text-[#F8FAFC]">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase">Detections Generated</div>
                    <div className="text-xl font-bold text-[#22D3EE]">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase">Alerts Created</div>
                    <div className="text-xl font-bold text-[#F59E0B]">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-[#A855F7]">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#080D1C] border border-[#1C2A45]">
                    <div className="text-[10px] text-[#94A3B8] uppercase">Max Risk Score</div>
                    <div className="text-xl font-bold text-[#22D3EE]">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-xs font-bold text-[#CBD5E1] pt-4 uppercase">Persisted Telemetry Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-[#080D1C] text-xs text-[#94A3B8] border border-[#1C2A45]">
                    No new alerts persisted (detections were suppressed by cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-[#080D1C] border border-[#1C2A45] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C2A45] pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#22D3EE]">{alt.alert_id}</span>
                            <h4 className="font-bold text-[#F8FAFC] text-sm">{alt.threat_class}</h4>
                            {getSeverityBadge(alt.severity)}
                          </div>
                          <div className="text-xs text-[#94A3B8]">
                            Risk Score: <span className="font-bold text-[#22D3EE]">{alt.confidence}</span> | Model: <span className="text-[#CBD5E1]">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[#94A3B8]">
                          <div>Source: <span className="text-[#CBD5E1]">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-[#CBD5E1]">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector Engine: <span className="text-[#CBD5E1]">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-[#050816] border border-[#1C2A45] space-y-2 text-xs shadow-sm">
                            <div className="flex items-center justify-between text-[#CBD5E1] font-bold border-b border-[#1C2A45] pb-1">
                              <span>Evidence & Model Inference Findings</span>
                              <span className="text-[#94A3B8]">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[#94A3B8]">
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
        <div className="bg-[#0D1426] p-6 rounded-xl border border-[#1C2A45] shadow-sm space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#1C2A45] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2 uppercase">
                <Radio className="w-4 h-4 text-[#A855F7] animate-pulse" />
                LIVE WEBSOCKET SECURITY STREAM
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Real-time alert events broadcast asynchronously during demo runs.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-bold bg-[rgba(168,85,247,0.12)] text-[#A855F7] border border-[#A855F7]/30">
              WebSocket: {wsStatus.toUpperCase()}
            </span>
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8 text-center text-[#94A3B8] text-xs bg-[#080D1C] rounded-lg border border-dashed border-[#1C2A45]">
              Awaiting live WebSocket alert broadcasts. Run a scenario in the catalog tab to see streaming events.
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#080D1C] border border-[#1C2A45] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#94A3B8]">{new Date(alt.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold text-[#22D3EE]">{alt.alert_id}</span>
                    <span className="font-bold text-[#F8FAFC]">{alt.threat_class}</span>
                    {getSeverityBadge(alt.severity)}
                  </div>
                  <div className="flex items-center gap-4 text-[#94A3B8]">
                    <span>{alt.source_ip} → {alt.destination_ip}:{alt.destination_port}</span>
                    <span className="text-[#22D3EE] font-bold">Score: {alt.confidence}</span>
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
