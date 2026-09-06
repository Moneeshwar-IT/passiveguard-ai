import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Radio, FileText,
  BarChart3, Cpu, PlayCircle, Lock
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
    <aside className="w-64 bg-[#070B18] border-r border-[#1C2A45] flex flex-col justify-between min-h-[calc(100vh-57px)] shrink-0 select-none shadow-lg">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#1C2A45]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#0D1426] border border-[#1C2A45] text-[#22D3EE]">
            <Shield className="h-5 w-5 text-[#22D3EE]" />
          </div>
          <div>
            <div className="font-bold text-[#F8FAFC] tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-[#22D3EE] font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">AI</span>
            </div>
            <div className="text-[10px] font-mono text-[#64748B] tracking-wider uppercase font-medium">
              PASSIVE THREAT INTELLIGENCE
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
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
                    ? 'bg-[rgba(34,211,238,0.10)] text-[#E2E8F0] border-l-2 border-[#22D3EE] font-semibold'
                    : 'text-[#94A3B8] hover:bg-[#0D1426] hover:text-[#F8FAFC] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-xs w-4 ${isActive ? 'text-[#22D3EE]' : 'text-[#64748B]'}`}>{item.symbol}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#22D3EE]' : 'text-current'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-[#1C2A45] bg-[#080D1C] space-y-2.5">
        <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
          <span>SYSTEM STATUS</span>
          <Lock className="h-3 w-3 text-[#22D3EE]" />
        </div>

        {/* Status Rows */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="p-2 rounded-md bg-[#0D1426] border border-[#1C2A45] flex items-center justify-between">
            <span className="text-[#94A3B8] text-[11px] font-medium">PASSIVE ENCLAVE</span>
            <span className="text-[10px] font-bold text-[#22D3EE] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE]"></span>
              READ-ONLY
            </span>
          </div>

          <div className="p-2 rounded-md bg-[#0D1426] border border-[#1C2A45] flex items-center justify-between">
            <span className="text-[#94A3B8] text-[11px] font-medium">API ENDPOINT</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              apiStatus === 'connected' ? 'text-[#22C55E]' : 'text-[#F59E0B]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'connected' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
              }`}></span>
              {apiStatus.toUpperCase()}
            </span>
          </div>

          <div className="p-2 rounded-md bg-[#0D1426] border border-[#1C2A45] flex items-center justify-between">
            <span className="text-[#94A3B8] text-[11px] font-medium">WEBSOCKET STREAM</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              wsStatus === 'connected' ? 'text-[#22C55E]' : 'text-[#F59E0B]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
              }`}></span>
              {wsStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-[#64748B] text-center pt-2 border-t border-[#1C2A45]">
          Detect. Explain. Never Talk Back.
        </div>
      </div>
    </aside>
  );
}
