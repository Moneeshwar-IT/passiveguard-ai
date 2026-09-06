import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Activity, AlertCircle, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchHealth, resetDemoState, formatIndianDateTime } from '../services/api';

export default function Header({ wsStatus = 'connected', onResetSuccess }) {
  const location = useLocation();
  const [healthStatus, setHealthStatus] = useState('healthy');
  const [timeString, setTimeString] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  const pageMap = {
    '/': { title: 'Security Operations Center', breadcrumb: 'PassiveGuard / Command Center' },
    '/demo': { title: 'Demo Lab & Simulation', breadcrumb: 'PassiveGuard / Demo Lab' },
    '/alerts': { title: 'Live Threat Detection', breadcrumb: 'PassiveGuard / SAST & Threat Alerts' },
    '/alert-details': { title: 'Threat Evidence Inspector', breadcrumb: 'PassiveGuard / Alert Evidence' },
    '/traffic': { title: 'Network Traffic Intelligence', breadcrumb: 'PassiveGuard / Network Telemetry' },
    '/models': { title: 'AI Model & Hub Registry', breadcrumb: 'PassiveGuard / AI Model Registry' },
  };

  const currentPage = pageMap[location.pathname] || {
    title: 'Security Operations Center',
    breadcrumb: 'PassiveGuard / Security Console',
  };

  useEffect(() => {
    const updateTime = () => {
      setTimeString(formatIndianDateTime(new Date()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    const checkHealth = () => {
      fetchHealth()
        .then((data) => {
          if (data && data.status === 'healthy') {
            setHealthStatus('healthy');
          } else {
            setHealthStatus('degraded');
          }
        })
        .catch(() => {
          setHealthStatus('offline');
        });
    };

    checkHealth();
    const healthInterval = setInterval(checkHealth, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(healthInterval);
    };
  }, []);

  const handleGlobalReset = async () => {
    if (resetting) return;
    setResetting(true);
    setResetMsg(null);
    try {
      await resetDemoState();
      setResetMsg('Reset Complete');
      if (onResetSuccess) onResetSuccess();
      setTimeout(() => setResetMsg(null), 3000);
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2 font-sans">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Center/Right: Live Status Badges & Clock */}
      <div className="flex items-center space-x-3">
        {/* IST Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono text-cyan-300">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-xs font-mono text-cyan-400 font-semibold">
          <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {/* WebSocket Stream Badge */}
        <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
          wsStatus === 'connected'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : wsStatus === 'reconnecting'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}></span>
          <span>
            {wsStatus === 'connected' ? 'LIVE TELEMETRY' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>SYSTEM HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 text-xs font-mono text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-1.5 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs font-mono text-rose-400">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            <span>OFFLINE</span>
          </div>
        )}

        {/* Global Quick Reset Button */}
        <button
          onClick={handleGlobalReset}
          disabled={resetting}
          className="btn-secondary-dark px-3 py-1.5 text-xs font-mono font-medium flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          title="Reset backend alert store and telemetry state"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
          <span>{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
