import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Activity, AlertCircle, Clock, RefreshCw, Sun, Moon, Menu, X } from 'lucide-react';
import { resetDemoState, formatIndianDateTime } from '../services/api';
import { useBackendStatus } from '../context/BackendStatusContext';
import { useTheme } from '../context/ThemeContext';
import Badge from './common/Badge';

export default function Header({ onResetSuccess, mobileMenuOpen, setMobileMenuOpen }) {
  const location = useLocation();
  const { healthStatus, wsStatus } = useBackendStatus();
  const { theme, toggleTheme } = useTheme();
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
    <header className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border-b border-enterprise-border dark:border-enterprise-borderDark px-4 sm:px-6 py-3 flex items-center justify-between shadow-card sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setMobileMenuOpen && setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-1.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase tracking-wider">
            <span>{currentPage.breadcrumb}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 font-sans">
            {currentPage.title}
          </h1>
        </div>
      </div>

      {/* Right: Status Badges, IST Clock, Theme Toggle & Reset */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* IST Clock */}
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark border border-enterprise-border dark:border-enterprise-borderDark text-xs font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark">
          <Clock className="h-3.5 w-3.5 text-enterprise-primary dark:text-enterprise-primaryDark" />
          <span>{timeString}</span>
        </div>

        {/* Read Only Enclave Badge */}
        <div className="hidden md:block">
          <Badge type="READ_ONLY" />
        </div>

        {/* WebSocket Stream Badge */}
        {wsStatus === 'connected' ? (
          <Badge type="STREAMING" label="LIVE TELEMETRY: CONNECTED" pulse />
        ) : wsStatus === 'reconnecting' ? (
          <Badge type="WARNING" label="RECONNECTING" />
        ) : (
          <Badge type="OFFLINE" label="OFFLINE" />
        )}

        {/* Backend Health Badge */}
        {healthStatus === 'healthy' && (
          <div className="hidden sm:block">
            <Badge type="HEALTHY" />
          </div>
        )}
        {healthStatus === 'degraded' && (
          <Badge type="MEDIUM" label="SYSTEM: DEGRADED" />
        )}
        {healthStatus === 'offline' && (
          <Badge type="CRITICAL" label="SYSTEM: OFFLINE" />
        )}

        {/* Dark/Light Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark hover:border-enterprise-primary/50 transition-colors flex items-center gap-1.5 text-xs font-mono cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {/* Global Quick Reset Button */}
        <button
          onClick={handleGlobalReset}
          disabled={resetting}
          className="btn-secondary-dark px-2.5 py-1 text-xs font-mono font-medium flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          title="Reset backend alert store and telemetry state"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-enterprise-primary' : 'text-enterprise-textMuted dark:text-enterprise-textMutedDark'}`} />
          <span className="hidden sm:inline">{resetting ? 'RESETTING...' : resetMsg ? resetMsg : 'RESET STATE'}</span>
        </button>
      </div>
    </header>
  );
}
