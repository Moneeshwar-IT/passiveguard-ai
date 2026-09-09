import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Activity, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { resetDemoState, formatIndianDateTime } from '../services/api';
import { useBackendStatus } from '../context/BackendStatusContext';

export default function Header({ onResetSuccess }) {
  const location = useLocation();
  const { healthStatus, wsStatus } = useBackendStatus();
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
    return () => clearInterval(timer);
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
    <header className="bg-soc-surface border-b border-soc-border px-6 py-3.5 flex items-center justify-between shadow-card sticky top-0 z-30">
      {/* Left: Page Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-soc-textMuted uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-lg font-bold text-soc-textPrimary tracking-tight flex items-center gap-2 font-sans">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Center/Right: Live Status Badges & Clock */}
      <div className="flex items-center space-x-3">
        {/* IST Clock */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded bg-soc-surfaceSubtle border border-soc-border text-xs font-mono text-soc-textMuted">
          <Clock className="h-3.5 w-3.5 text-brand" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-brand-50 px-3 py-1 rounded border border-brand-200 text-xs font-mono text-brand font-medium">
          <Eye className="h-3.5 w-3.5 text-brand" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {/* WebSocket Stream Badge with Accessible Label */}
        <div
          className={`flex items-center space-x-1.5 px-3 py-1 rounded border text-xs font-mono font-semibold ${
            wsStatus === 'connected'
              ? 'bg-success-50 border-success-200 text-success-700'
              : wsStatus === 'reconnecting'
              ? 'bg-warning-50 border-warning-100 text-warning'
              : 'bg-danger-50 border-danger-100 text-danger'
          }`}
          title={`WebSocket Status: ${wsStatus}`}
        >
          <span className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-success animate-pulse' : 'bg-warning'
          }`} aria-hidden="true"></span>
          <span>
            {wsStatus === 'connected' ? 'LIVE TELEMETRY: CONNECTED' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-success-50 px-3 py-1 rounded border border-success-200 text-xs font-mono text-success-700">
            <Activity className="h-3.5 w-3.5 text-success" />
            <span>SYSTEM: HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-1.5 bg-warning-50 px-3 py-1 rounded border border-warning-100 text-xs font-mono text-warning">
            <AlertCircle className="h-3.5 w-3.5 text-warning" />
            <span>SYSTEM: DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-1.5 bg-danger-50 px-3 py-1 rounded border border-danger-100 text-xs font-mono text-danger">
            <AlertCircle className="h-3.5 w-3.5 text-danger" />
            <span>SYSTEM: OFFLINE</span>
          </div>
        )}

        {/* Global Quick Reset Button */}
        <button
          onClick={handleGlobalReset}
          disabled={resetting}
          className="btn-secondary-dark px-3 py-1 text-xs font-mono font-medium flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          title="Reset backend alert store and telemetry state"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-brand' : 'text-soc-textMuted'}`} />
          <span>{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
