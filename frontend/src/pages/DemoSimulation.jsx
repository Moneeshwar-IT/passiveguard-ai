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
      case 'ddos': return { border: 'hover:border-[#DC2626]', icon: <ShieldAlert className="w-5 h-5 text-[#DC2626]" />, tag: 'text-[#DC2626]' };
      case 'c2': return { border: 'hover:border-[#7C3AED]', icon: <Radio className="w-5 h-5 text-[#7C3AED]" />, tag: 'text-[#7C3AED]' };
      case 'dga': return { border: 'hover:border-[#4F46E5]', icon: <Terminal className="w-5 h-5 text-[#4F46E5]" />, tag: 'text-[#4F46E5]' };
      case 'dns_tunnel': return { border: 'hover:border-[#0284C7]', icon: <FileCode className="w-5 h-5 text-[#0284C7]" />, tag: 'text-[#0284C7]' };
      case 'tls_malware': return { border: 'hover:border-[#D97706]', icon: <Lock className="w-5 h-5 text-[#D97706]" />, tag: 'text-[#D97706]' };
      case 'recon': return { border: 'hover:border-[#2563EB]', icon: <Search className="w-5 h-5 text-[#2563EB]" />, tag: 'text-[#2563EB]' };
      case 'exfiltration': return { border: 'hover:border-[#DB2777]', icon: <Activity className="w-5 h-5 text-[#DB2777]" />, tag: 'text-[#DB2777]' };
      default: return { border: 'hover:border-[#2563EB]', icon: <Cpu className="w-5 h-5 text-[#2563EB]" />, tag: 'text-[#2563EB]' };
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FEF2F2] text-[#EF4444] border border-[#FCA5A5]">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-[#64748B] border border-slate-200">INFO / BENIGN</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-[#0F172A] tracking-tight uppercase flex items-center gap-2">
              <span className="text-[#7C3AED]">DEMO</span> <span className="text-[#2563EB]">LAB & SIMULATION</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse"></span>
              CONTROLLED SIMULATION ENVIRONMENT
            </span>
          </div>
          <p className="text-[#475569] text-xs mt-1 font-medium">
            Controlled passive threat simulation suite for Smart India Hackathon live judging demonstration.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunDemo('all')}
            disabled={isRunning}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            RUN FULL DEMO
          </button>

          <button
            onClick={() => handleRunDemo()}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold bg-white hover:bg-[#F8FAFC] text-[#2563EB] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                EXECUTING PIPELINE...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#2563EB]" />
                RUN SELECTED ({selectedScenario.toUpperCase()})
              </>
            )}
          </button>

          <button
            onClick={handleResetState}
            disabled={resetting || isRunning}
            className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Clear alert store and detector state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-[#2563EB]' : ''}`} />
            RESET STATE
          </button>
        </div>
      </div>

      {/* Prominent Safety Banner & Simulation Indicators */}
      <div className="bg-[#ECFDF5] border border-[#BBF7D0] p-4 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#BBF7D0] pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#15803D] uppercase">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            OFFLINE CONTROLLED ENVIRONMENT — PASSIVE SECURITY GUARANTEES
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#BBF7D0] text-[#15803D] font-bold">● LIVE SIMULATION</span>
            <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#BFDBFE] text-[#2563EB] font-bold">PCAP REPLAY</span>
            <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#C7D2FE] text-[#4F46E5] font-bold">REAL DATA-DIODE FEED</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-[#0F172A]">
          <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#BBF7D0] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>NO PACKETS TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#BBF7D0] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>NO ACTIVE PROBING</span>
          </div>
          <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-[#BBF7D0] shadow-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>NO PAYLOAD DECRYPTION</span>
          </div>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#DC2626]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resetSuccessMsg && (
        <div className="p-4 rounded-lg bg-[#ECFDF5] border border-[#BBF7D0] text-[#15803D] text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16A34A]" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E2E8F0] text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'scenarios'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Scenario Catalog
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Activity className="w-4 h-4" />
          Execution Results {runResult && <span className="px-2 py-0.2 rounded text-[10px] bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">Active</span>}
        </button>
        <button
          onClick={() => setActiveTab('live_stream')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_stream'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Radio className="w-4 h-4 text-[#7C3AED]" />
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
                      ? 'bg-[#EFF6FF] border-[#2563EB] shadow-md ring-1 ring-[#2563EB]'
                      : `bg-white border-[#E2E8F0] ${accent.border} hover:bg-[#F8FAFC]`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                          {accent.icon}
                        </div>
                        <div>
                          <h3 className="font-bold font-mono text-[#0F172A] text-sm">{sc.title}</h3>
                          <span className={`text-[10px] font-mono uppercase font-bold ${accent.tag}`}>{sc.category}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed mb-4">{sc.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] mt-2 font-mono">
                    <span className="text-[10px] text-[#64748B]">ID: {sc.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedScenario(sc.id);
                        handleRunDemo(sc.id);
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      RUN SCENARIO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-sm">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReset"
                checked={autoReset}
                onChange={(e) => setAutoReset(e.target.checked)}
                className="w-4 h-4 rounded border-[#E2E8F0] text-[#2563EB] focus:ring-[#2563EB]"
              />
              <label htmlFor="autoReset" className="text-xs text-[#334155] cursor-pointer font-medium">
                Automatically reset alert store & temporal state before running scenario
              </label>
            </div>
            <button
              onClick={() => handleRunDemo('all')}
              disabled={isRunning}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
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
            <div className="p-12 text-center bg-white rounded-xl border border-[#E2E8F0] space-y-3 font-mono shadow-sm">
              <Activity className="w-10 h-10 text-[#94A3B8] mx-auto" />
              <h3 className="text-[#334155] font-bold text-sm">NO SIMULATION RESULTS YET</h3>
              <p className="text-[#64748B] text-xs max-w-md mx-auto">
                Select a threat scenario from the catalog tab and click 'RUN' to execute telemetry through the detection pipeline.
              </p>
              <button
                onClick={() => setActiveTab('scenarios')}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded text-xs font-bold cursor-pointer shadow-sm transition-colors"
              >
                Go to Scenario Catalog
              </button>
            </div>
          ) : runResult.scenario === 'all' ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">{runResult.title}</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">{runResult.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                    STATUS: {runResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Total Events</div>
                    <div className="text-xl font-bold text-[#0F172A]">{runResult.total_events_processed}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Detections Generated</div>
                    <div className="text-xl font-bold text-[#2563EB]">{runResult.total_detections_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Alerts Created</div>
                    <div className="text-xl font-bold text-[#D97706]">{runResult.total_alerts_generated}</div>
                  </div>
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Duration / Rate</div>
                    <div className="text-xl font-bold text-[#16A34A]">{runResult.duration_sec}s <span className="text-xs text-[#64748B]">({runResult.rate_events_per_sec} evt/s)</span></div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-[#334155] pt-4 uppercase">Sequential Threat Execution Matrix</h3>
                <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                  <table className="w-full text-left text-xs text-[#334155]">
                    <thead className="bg-[#F8FAFC] text-[#475569] font-bold uppercase border-b border-[#E2E8F0] text-[10px]">
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
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {runResult.scenarios_summary?.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="p-3 font-bold text-[#0F172A]">{sc.title}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'DETECTED' ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#F8FAFC] text-[#64748B]'
                            }`}>
                              {sc.status}
                            </span>
                          </td>
                          <td className="p-3 text-[#334155]">{sc.detections_count}</td>
                          <td className="p-3 font-bold text-[#D97706]">{sc.alerts_generated_count}</td>
                          <td className="p-3">{getSeverityBadge(sc.highest_severity)}</td>
                          <td className="p-3 font-bold text-[#2563EB]">{sc.max_risk_score}</td>
                          <td className="p-3">
                            <button
                              onClick={() => navigate('/alerts')}
                              className="text-[#2563EB] hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                  <div>
                    <span className="text-xs text-[#2563EB] font-bold uppercase">{runResult.scenario} SCENARIO</span>
                    <h2 className="text-xl font-bold text-[#0F172A]">{runResult.title}</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">{runResult.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(runResult.highest_severity)}
                    <span className="px-3 py-1 rounded text-xs font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                      {runResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase">Events Processed</div>
                    <div className="text-xl font-bold text-[#0F172A]">{runResult.events_processed}</div>
                  </div>
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase">Detections Generated</div>
                    <div className="text-xl font-bold text-[#2563EB]">{runResult.detections_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase">Alerts Created</div>
                    <div className="text-xl font-bold text-[#D97706]">{runResult.alerts_generated_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase">Alerts Suppressed</div>
                    <div className="text-xl font-bold text-[#7C3AED]">{runResult.alerts_suppressed_count}</div>
                  </div>
                  <div className="p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] uppercase">Max Risk Score</div>
                    <div className="text-xl font-bold text-[#2563EB]">{runResult.max_risk_score}</div>
                  </div>
                </div>

                {/* Generated Alerts Cards */}
                <h3 className="text-xs font-bold text-[#334155] pt-4 uppercase">Persisted Telemetry Alerts</h3>
                {runResult.alerts?.length === 0 ? (
                  <div className="p-4 rounded bg-[#F8FAFC] text-xs text-[#64748B] border border-[#E2E8F0]">
                    No new alerts persisted (detections were suppressed by cooldown deduplication or score threshold).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runResult.alerts?.map((alt, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#2563EB]">{alt.alert_id}</span>
                            <h4 className="font-bold text-[#0F172A] text-sm">{alt.threat_class}</h4>
                            {getSeverityBadge(alt.severity)}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            Risk Score: <span className="font-bold text-[#2563EB]">{alt.confidence}</span> | Model: <span className="text-[#334155]">{alt.model_version}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[#64748B]">
                          <div>Source: <span className="text-[#334155]">{alt.source_ip}:{alt.source_port}</span></div>
                          <div>Destination: <span className="text-[#334155]">{alt.destination_ip}:{alt.destination_port}</span></div>
                          <div>Detector Engine: <span className="text-[#334155]">{alt.detector_name}</span></div>
                        </div>

                        {alt.evidence && (
                          <div className="p-3 rounded bg-white border border-[#E2E8F0] space-y-2 text-xs shadow-sm">
                            <div className="flex items-center justify-between text-[#334155] font-bold border-b border-[#E2E8F0] pb-1">
                              <span>Evidence & Model Inference Findings</span>
                              <span className="text-[#64748B]">Statistical: {alt.evidence.statistical_score} | ML: {alt.evidence.ml_score}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[#64748B]">
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
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 uppercase">
                <Radio className="w-4 h-4 text-[#7C3AED] animate-pulse" />
                LIVE WEBSOCKET SECURITY STREAM
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Real-time alert events broadcast asynchronously during demo runs.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-bold bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
              WebSocket: {wsStatus.toUpperCase()}
            </span>
          </div>

          {liveWsAlerts.length === 0 ? (
            <div className="p-8 text-center text-[#64748B] text-xs bg-[#F8FAFC] rounded-lg border border-dashed border-[#E2E8F0]">
              Awaiting live WebSocket alert broadcasts. Run a scenario in the catalog tab to see streaming events.
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveWsAlerts.map((alt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#64748B]">{new Date(alt.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold text-[#2563EB]">{alt.alert_id}</span>
                    <span className="font-bold text-[#0F172A]">{alt.threat_class}</span>
                    {getSeverityBadge(alt.severity)}
                  </div>
                  <div className="flex items-center gap-4 text-[#64748B]">
                    <span>{alt.source_ip} → {alt.destination_ip}:{alt.destination_port}</span>
                    <span className="text-[#2563EB] font-bold">Score: {alt.confidence}</span>
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
