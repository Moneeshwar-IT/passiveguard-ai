import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlayCircle, AlertTriangle, FileText, BarChart3, Cpu } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Demo / Simulation', path: '/demo', icon: PlayCircle },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Alert Details', path: '/alert-details', icon: FileText },
    { name: 'Traffic Analytics', path: '/traffic', icon: BarChart3 },
    { name: 'Model Performance', path: '/models', icon: Cpu },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between min-h-[calc(100vh-73px)]">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border-l-4 border-sky-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-500">
        <p className="font-semibold text-slate-400 mb-1">Security Disclaimer</p>
        <p>Passive observation mode — no packet transmission, active probing, external DNS, TLS decryption, or mitigation.</p>
      </div>
    </aside>
  );
}
