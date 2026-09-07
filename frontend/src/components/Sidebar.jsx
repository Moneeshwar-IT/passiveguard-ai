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
    <aside className="w-64 bg-[#FFFFFF] border-r border-[#E2E8F0] flex flex-col justify-between min-h-[calc(100vh-57px)] shrink-0 select-none shadow-xs">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#E2E8F0]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB]">
            <Shield className="h-5 w-5 text-[#2563EB]" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A] tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-[#2563EB] font-extrabold">AI</span>
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
                    ? 'bg-[#EFF6FF] text-[#2563EB] border-l-2 border-[#2563EB] font-semibold'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-xs w-4 ${isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>{item.symbol}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-2.5">
        <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
          <span>SYSTEM STATUS</span>
          <Lock className="h-3 w-3 text-[#2563EB]" />
        </div>

        {/* Status Rows */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="p-2 rounded-md bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between shadow-xs">
            <span className="text-[#475569] text-[11px] font-medium">PASSIVE ENCLAVE</span>
            <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]"></span>
              READ-ONLY
            </span>
          </div>

          <div className="p-2 rounded-md bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between shadow-xs">
            <span className="text-[#475569] text-[11px] font-medium">API ENDPOINT</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              apiStatus === 'connected' ? 'text-[#15803D]' : 'text-[#D97706]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'connected' ? 'bg-[#15803D]' : 'bg-[#D97706]'
              }`}></span>
              {apiStatus.toUpperCase()}
            </span>
          </div>

          <div className="p-2 rounded-md bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between shadow-xs">
            <span className="text-[#475569] text-[11px] font-medium">WEBSOCKET STREAM</span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${
              wsStatus === 'connected' ? 'text-[#15803D]' : 'text-[#D97706]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-[#15803D]' : 'bg-[#D97706]'
              }`}></span>
              {wsStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-[#64748B] text-center pt-2 border-t border-[#E2E8F0]">
          Detect. Explain. Never Talk Back.
        </div>
      </div>
    </aside>
  );
}
