import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Radio, FileText,
  BarChart3, Cpu, PlayCircle, Lock
} from 'lucide-react';
import { useBackendStatus } from '../context/BackendStatusContext';
import Badge from './common/Badge';

export default function Sidebar({ mobileMenuOpen, setMobileMenuOpen }) {
  const { healthStatus, wsStatus } = useBackendStatus();

  const navItems = [
    { name: 'Command Center', symbol: '▣', path: '/', icon: LayoutDashboard },
    { name: 'Live Detection', symbol: '◉', path: '/alerts', icon: Radio },
    { name: 'Threat Details', symbol: '◈', path: '/alert-details', icon: FileText },
    { name: 'Traffic Intelligence', symbol: '◎', path: '/traffic', icon: BarChart3 },
    { name: 'AI Models', symbol: '◈', path: '/models', icon: Cpu },
    { name: 'Demo Lab', symbol: '⌁', path: '/demo', icon: PlayCircle },
  ];

  const handleNavClick = () => {
    if (setMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const sidebarContent = (
    <aside className="w-64 bg-enterprise-surface dark:bg-enterprise-surfaceDark border-r border-enterprise-border dark:border-enterprise-borderDark flex flex-col justify-between h-full shrink-0 select-none shadow-card transition-colors">
      {/* Brand Header */}
      <div className="p-4 border-b border-enterprise-border dark:border-enterprise-borderDark">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-enterprise-primary/10 border border-enterprise-primary/20 text-enterprise-primary dark:text-enterprise-primaryDark">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-wider text-sm font-mono flex items-center gap-1">
              PASSIVEGUARD<span className="text-enterprise-primary dark:text-enterprise-primaryDark font-extrabold">AI</span>
            </div>
            <div className="text-[10px] font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark tracking-wider uppercase font-medium">
              PASSIVE THREAT INTELLIGENCE
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase tracking-wider">
          SOC NAVIGATION
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-enterprise-primary/10 dark:bg-enterprise-primaryDark/15 text-enterprise-primary dark:text-enterprise-primaryDark border-l-2 border-enterprise-primary dark:border-enterprise-primaryDark font-semibold shadow-sm'
                    : 'text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark hover:bg-enterprise-surfaceSubtle dark:hover:bg-enterprise-surfaceSubtleDark hover:text-enterprise-textPrimary dark:hover:text-enterprise-textPrimaryDark font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-xs w-4 ${isActive ? 'text-enterprise-primary dark:text-enterprise-primaryDark' : 'text-enterprise-textMuted dark:text-enterprise-textMutedDark'}`}>{item.symbol}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-enterprise-primary dark:text-enterprise-primaryDark' : 'text-enterprise-textMuted dark:text-enterprise-textMutedDark'}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark space-y-2.5">
        <div className="text-[10px] font-mono font-bold text-enterprise-textMuted dark:text-enterprise-textMutedDark uppercase tracking-wider flex items-center justify-between">
          <span>SYSTEM STATUS</span>
          <Lock className="h-3 w-3 text-enterprise-primary dark:text-enterprise-primaryDark" />
        </div>

        {/* Status Rows */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="p-2 rounded-md bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark flex items-center justify-between shadow-subtle">
            <span className="text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark text-[11px] font-medium">PASSIVE ENCLAVE</span>
            <Badge type="READ_ONLY" />
          </div>

          <div className="p-2 rounded-md bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark flex items-center justify-between shadow-subtle">
            <span className="text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark text-[11px] font-medium">API HEALTH</span>
            {healthStatus === 'healthy' ? (
              <Badge type="HEALTHY" />
            ) : (
              <Badge type="MEDIUM" label={healthStatus.toUpperCase()} />
            )}
          </div>

          <div className="p-2 rounded-md bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark flex items-center justify-between shadow-subtle">
            <span className="text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark text-[11px] font-medium">WEBSOCKET STREAM</span>
            {wsStatus === 'connected' ? (
              <Badge type="STREAMING" label="CONNECTED" pulse />
            ) : (
              <Badge type="OFFLINE" label={wsStatus.toUpperCase()} />
            )}
          </div>
        </div>

        <div className="text-[10px] font-mono text-enterprise-textMuted dark:text-enterprise-textMutedDark text-center pt-2 border-t border-enterprise-border dark:border-enterprise-borderDark">
          Detect. Explain. Never Talk Back.
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block h-full">
        {sidebarContent}
      </div>

      {/* Mobile Slide-Out Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full h-full z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
