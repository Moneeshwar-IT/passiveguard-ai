import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Radio, AlertTriangle, FileText,
  BarChart3, Cpu, PlayCircle, Lock, Server, CheckCircle2
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
    { name: 'Command Center', symbol: '▣', path: '/', icon: LayoutDashboard },
    { name: 'Live Detection', symbol: '◉', path: '/alerts', icon: Radio },
    { name: 'Threat Details', symbol: '◈', path: '/alert-details', icon: FileText },
    { name: 'Traffic Intelligence', symbol: '◎', path: '/traffic', icon: BarChart3 },
    { name: 'AI Models', symbol: '◈', path: '/models', icon: Cpu },
    { name: 'Demo Lab', symbol: '⌁', path: '/demo', icon: PlayCircle },
  ];

  return (
    <aside className="w-64 bg-[#0B1120] border-r border-[#1E293B] flex flex-col justify-between min-h-[calc(100vh-57px)] shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-bold text-white tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-cyan-400 font-extrabold">AI</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
              PASSIVE THREAT INTELLIGENCE
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
          SOC NAVIGATION
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400 font-semibold shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
                }`
              }
            >
              <span className="font-mono text-cyan-500 text-xs w-4">{item.symbol}</span>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-[#1E293B] bg-[#070B14]/80 space-y-3">
        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>SYSTEM STATUS</span>
          <Lock className="h-3 w-3 text-cyan-400" />
        </div>

        {/* Status Indicator Rows */}
        <div className="space-y-2 text-xs font-mono">
          {/* Passive Enclave Status */}
          <div className="p-2 rounded bg-[#0B1120] border border-[#1E293B] flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">PASSIVE ENCLAVE</span>
            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              READ-ONLY
            </span>
          </div>

          {/* API Status */}
          <div className="p-2 rounded bg-[#0B1120] border border-[#1E293B] flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">API ENDPOINT</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              apiStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              {apiStatus.toUpperCase()}
            </span>
          </div>

          {/* WebSocket Status */}
          <div className="p-2 rounded bg-[#0B1120] border border-[#1E293B] flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">WEBSOCKET STREAM</span>
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

        {/* Security Motto Disclaimer */}
        <div className="text-[10px] font-mono text-slate-400 text-center pt-1 border-t border-[#1E293B]/60">
          Detect. Explain. Never Talk Back.
        </div>
      </div>
    </aside>
  );
}
