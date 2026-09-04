import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield, Eye, Activity, AlertCircle, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { fetchHealth, resetDemoState } from '../services/api';

export default function Header({ wsStatus = 'connected', onResetSuccess }) {
  const location = useLocation();
  const [healthStatus, setHealthStatus] = useState('healthy');
  const [timeString, setTimeString] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  // Map path to title and breadcrumb
  const pageMap = {
    '/': { title: 'Command Center', breadcrumb: 'PassiveGuard / Command Center' },
    '/demo': { title: 'Demo Lab & Simulation', breadcrumb: 'PassiveGuard / Demo Lab' },
    '/alerts': { title: 'Live Threat Detection', breadcrumb: 'PassiveGuard / Threat Alerts' },
    '/alert-details': { title: 'Threat Evidence Inspector', breadcrumb: 'PassiveGuard / Alert Details' },
    '/traffic': { title: 'Traffic Intelligence', breadcrumb: 'PassiveGuard / Traffic Analytics' },
    '/models': { title: 'AI Model Registry', breadcrumb: 'PassiveGuard / Model Performance' },
  };

  const currentPage = pageMap[location.pathname] || {
    title: 'Command Center',
    breadcrumb: 'PassiveGuard / Security Enclave',
  };

  useEffect(() => {
    // Clock
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Health check
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
      setResetMsg('State Reset Complete');
      if (onResetSuccess) onResetSuccess();
      setTimeout(() => setResetMsg(null), 3000);
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="bg-[#0B1120] border-b border-[#1E293B] px-6 py-3.5 flex items-center justify-between shadow-lg sticky top-0 z-30">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Center/Right: Live Status Badges & UTC Clock */}
      <div className="flex items-center space-x-3">
        {/* UTC Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded bg-[#070B14] border border-[#1E293B] text-xs font-mono text-slate-400">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-[#070B14] px-3 py-1 rounded border border-cyan-500/30 text-xs font-mono text-cyan-400">
          <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {/* WebSocket Stream Badge */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded border text-xs font-mono font-semibold ${
          wsStatus === 'connected'
            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
            : wsStatus === 'reconnecting'
            ? 'bg-amber-950/50 border-amber-500/30 text-amber-400'
            : 'bg-red-950/50 border-red-500/30 text-red-400'
        }`}>
          <span className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
          }`}></span>
          <span>
            {wsStatus === 'connected' ? 'LIVE TELEMETRY' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>SYSTEM HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-1.5 bg-amber-950/40 px-3 py-1 rounded border border-amber-500/30 text-xs font-mono text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-1.5 bg-red-950/40 px-3 py-1 rounded border border-red-500/30 text-xs font-mono text-red-400">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span>OFFLINE</span>
          </div>
        )}

        {/* Global Quick Reset Button */}
        <button
          onClick={handleGlobalReset}
          disabled={resetting}
          className="flex items-center space-x-1.5 bg-[#172033] hover:bg-[#1E293B] text-slate-300 border border-[#334155] px-3 py-1 rounded text-xs font-mono font-medium transition-colors disabled:opacity-50"
          title="Reset backend alert store and telemetry state"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
          <span>{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
