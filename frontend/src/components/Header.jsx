import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Activity, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { fetchHealth, resetDemoState, formatIndianDateTime } from '../services/api';

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
    <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-30">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A] tracking-tight flex items-center gap-2 font-sans">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Center/Right: Live Status Badges & UTC Clock */}
      <div className="flex items-center space-x-3">
        {/* UTC Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#64748B]">
          <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-[#EFF6FF] px-3 py-1 rounded border border-[#BFDBFE] text-xs font-mono text-[#2563EB] font-medium">
          <Eye className="h-3.5 w-3.5 text-[#2563EB]" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {/* WebSocket Stream Badge */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded border text-xs font-mono font-semibold ${
          wsStatus === 'connected'
            ? 'bg-[#ECFDF5] border-[#BBF7D0] text-[#15803D]'
            : wsStatus === 'reconnecting'
            ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]'
            : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
        }`}>
          <span className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-[#16A34A] animate-pulse' : 'bg-[#D97706]'
          }`}></span>
          <span>
            {wsStatus === 'connected' ? 'LIVE TELEMETRY' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-[#ECFDF5] px-3 py-1 rounded border border-[#BBF7D0] text-xs font-mono text-[#15803D]">
            <Activity className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>SYSTEM HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-1.5 bg-[#FEF3C7] px-3 py-1 rounded border border-[#FDE68A] text-xs font-mono text-[#D97706]">
            <AlertCircle className="h-3.5 w-3.5 text-[#D97706]" />
            <span>DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-1.5 bg-[#FEF2F2] px-3 py-1 rounded border border-[#FECACA] text-xs font-mono text-[#DC2626]">
            <AlertCircle className="h-3.5 w-3.5 text-[#DC2626]" />
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
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-[#2563EB]' : 'text-[#64748B]'}`} />
          <span>{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
