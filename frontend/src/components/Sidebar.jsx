import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Radio, FileText,
  BarChart3, Cpu, PlayCircle, Lock
} from 'lucide-react';
import { useBackendStatus } from '../context/BackendStatusContext';

export default function Sidebar() {
  const { healthStatus, wsStatus } = useBackendStatus();

  const navItems = [
    { name: 'Command Center', symbol: '▣', path: '/', icon: LayoutDashboard },
    { name: 'Live Detection', symbol: '◉', path: '/alerts', icon: Radio },
    { name: 'Threat Details', symbol: '◈', path: '/alert-details', icon: FileText },
    { name: 'Traffic Intelligence', symbol: '◎', path: '/traffic', icon: BarChart3 },
    { name: 'AI Models', symbol: '◈', path: '/models', icon: Cpu },
    { name: 'Demo Lab', symbol: '⌁', path: '/demo', icon: PlayCircle },
  ];

  return (
    <aside className="w-64 bg-soc-surface border-r border-soc-border flex flex-col justify-between min-h-[calc(100vh-57px)] shrink-0 select-none shadow-card">
      {/* Brand Header */}
      <div className="p-4 border-b border-soc-border">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-200 text-brand">
            <Shield className="h-5 w-5 text-brand" />
          </div>
          <div>
            <div className="font-bold text-soc-textPrimary tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-brand font-extrabold">AI</span>
            </div>
            <div className="text-[10px] font-mono text-soc-textMuted tracking-wider uppercase font-medium">
              PASSIVE THREAT INTELLIGENCE
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-soc-textMuted uppercase tracking-wider">
          SOC NAVIGATION
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand border-l-2 border-brand font-semibold'
                    : 'text-soc-textSecondary hover:bg-soc-surfaceSubtle hover:text-soc-textPrimary font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-xs w-4 ${isActive ? 'text-brand' : 'text-soc-textMuted'}`}>{item.symbol}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand' : 'text-soc-textMuted'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-soc-border bg-soc-surfaceSubtle space-y-2.5">
        <div className="text-[10px] font-mono font-bold text-soc-textMuted uppercase tracking-wider flex items-center justify-between">
          <span>SYSTEM STATUS</span>
          <Lock className="h-3 w-3 text-brand" />
        </div>

        {/* Status Rows */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="p-2 rounded-md bg-soc-surface border border-soc-border flex items-center justify-between shadow-subtle">
            <span className="text-soc-textSecondary text-[11px] font-medium">PASSIVE ENCLAVE</span>
            <span className="text-[10px] font-bold text-brand flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
              READ-ONLY
            </span>
          </div>

          <div className="p-2 rounded-md bg-soc-surface border border-soc-border flex items-center justify-between shadow-subtle">
            <span className="text-soc-textSecondary text-[11px] font-medium">API HEALTH</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              healthStatus === 'healthy' ? 'text-success-700' : 'text-warning'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                healthStatus === 'healthy' ? 'bg-success' : 'bg-warning'
              }`}></span>
              {healthStatus.toUpperCase()}
            </span>
          </div>

          <div className="p-2 rounded-md bg-soc-surface border border-soc-border flex items-center justify-between shadow-subtle">
            <span className="text-soc-textSecondary text-[11px] font-medium">WEBSOCKET STREAM</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              wsStatus === 'connected' ? 'text-success-700' : 'text-warning'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-success' : 'bg-warning'
              }`}></span>
              {wsStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-soc-textMuted text-center pt-2 border-t border-soc-border">
          Detect. Explain. Never Talk Back.
        </div>
      </div>
    </aside>
  );
}
