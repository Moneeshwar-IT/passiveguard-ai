import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Radio, FileText,
  BarChart3, Cpu, PlayCircle, Lock, Server, GitBranch, ShieldAlert
} from 'lucide-react';
import { fetchHealth } from '../services/api';

export default function Sidebar({ wsStatus = 'connected' }) {
  const [apiStatus, setApiStatus] = useState('connected');

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        if (data && data.status === 'healthy') setApiStatus('connected');
        else setApiStatus('degraded');
      })
      .catch(() => setApiStatus('offline'));
  }, []);

  const navItems = [
    { name: 'Dashboard', symbol: '▣', path: '/', icon: LayoutDashboard },
    { name: 'Edge Agents', symbol: '⚡', path: '/alerts?filter=agents', icon: Server },
    { name: 'Hub Repositories', symbol: '⬢', path: '/models', icon: GitBranch },
    { name: 'SAST Scans & Alerts', symbol: '◉', path: '/alerts', icon: ShieldAlert },
    { name: 'Network Traffic', symbol: '◎', path: '/traffic', icon: BarChart3 },
    { name: 'AI Models', symbol: '◈', path: '/models', icon: Cpu },
    { name: 'Demo Lab', symbol: '⌁', path: '/demo', icon: PlayCircle },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 backdrop-blur-md border-r border-slate-800/80 flex flex-col justify-between min-h-[calc(100vh-57px)] shrink-0 select-none shadow-xl">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-bold text-slate-100 tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-cyan-400 font-extrabold">SOC</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase font-medium">
              CYBERSECURITY AUDITING
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          SOC AUDITING NAVIGATION
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
                    ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-xs w-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>{item.symbol}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/60 space-y-2.5">
        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>ENCLAVE STATUS</span>
          <Lock className="h-3 w-3 text-cyan-400" />
        </div>

        {/* Status Rows */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="p-2 rounded-md bg-slate-800/40 border border-slate-700/60 flex items-center justify-between shadow-xs">
            <span className="text-slate-300 text-[11px] font-medium">PASSIVE ENCLAVE</span>
            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              READ-ONLY
            </span>
          </div>

          <div className="p-2 rounded-md bg-slate-800/40 border border-slate-700/60 flex items-center justify-between shadow-xs">
            <span className="text-slate-300 text-[11px] font-medium">API ENDPOINT</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              apiStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              {apiStatus.toUpperCase()}
            </span>
          </div>

          <div className="p-2 rounded-md bg-slate-800/40 border border-slate-700/60 flex items-center justify-between shadow-xs">
            <span className="text-slate-300 text-[11px] font-medium">WEBSOCKET STREAM</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              wsStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              {wsStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-500 text-center pt-2 border-t border-slate-800/80">
          Detect. Audit. Never Talk Back.
        </div>
      </div>
    </aside>
  );
}
