import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Activity, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { fetchHealth, resetDemoState } from '../services/api';

export default function Header({ wsStatus = 'connected', onResetSuccess }) {
  const location = useLocation();
  const [healthStatus, setHealthStatus] = useState('healthy');
  const [timeString, setTimeString] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

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
    breadcrumb: 'PassiveGuard / Security Console',
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
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
    <header className="bg-[#050816] border-b border-[#1C2A45] px-6 py-3.5 flex items-center justify-between shadow-md sticky top-0 z-30">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 font-sans">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Center/Right: Live Status Badges & UTC Clock */}
      <div className="flex items-center space-x-3">
        {/* UTC Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded bg-[#0D1426] border border-[#1C2A45] text-xs font-mono text-[#94A3B8]">
          <Clock className="h-3.5 w-3.5 text-[#22D3EE]" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-[rgba(34,211,238,0.10)] px-3 py-1 rounded border border-[#22D3EE]/30 text-xs font-mono text-[#22D3EE] font-medium">
          <Eye className="h-3.5 w-3.5 text-[#22D3EE]" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {/* WebSocket Stream Badge */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded border text-xs font-mono font-semibold ${
          wsStatus === 'connected'
            ? 'bg-[rgba(34,197,94,0.12)] border-[#22C55E]/30 text-[#22C55E]'
            : wsStatus === 'reconnecting'
            ? 'bg-[rgba(245,158,11,0.15)] border-[#F59E0B]/30 text-[#F59E0B]'
            : 'bg-[rgba(239,68,68,0.15)] border-[#EF4444]/30 text-[#EF4444]'
        }`}>
          <span className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-[#22C55E] animate-pulse' : 'bg-[#F59E0B]'
          }`}></span>
          <span>
            {wsStatus === 'connected' ? 'LIVE TELEMETRY' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-[rgba(34,197,94,0.12)] px-3 py-1 rounded border border-[#22C55E]/30 text-xs font-mono text-[#22C55E]">
            <Activity className="h-3.5 w-3.5 text-[#22C55E]" />
            <span>SYSTEM HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-1.5 bg-[rgba(245,158,11,0.15)] px-3 py-1 rounded border border-[#F59E0B]/30 text-xs font-mono text-[#F59E0B]">
            <AlertCircle className="h-3.5 w-3.5 text-[#F59E0B]" />
            <span>DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-1.5 bg-[rgba(239,68,68,0.15)] px-3 py-1 rounded border border-[#EF4444]/30 text-xs font-mono text-[#EF4444]">
            <AlertCircle className="h-3.5 w-3.5 text-[#EF4444]" />
            <span>OFFLINE</span>
          </div>
        )}

        {/* Global Quick Reset Button */}
        <button
          onClick={handleGlobalReset}
          disabled={resetting}
          className="btn-secondary-dark px-3 py-1 text-xs font-mono font-medium flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          title="Reset backend alert store and telemetry state"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-[#22D3EE]' : 'text-[#64748B]'}`} />
          <span>{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
