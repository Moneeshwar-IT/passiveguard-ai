import React from 'react';
import { AlertOctagon, AlertTriangle, Shield, CheckCircle, Info, Radio, Eye } from 'lucide-react';

export default function Badge({ severity, type, label, size = 'normal', className = '' }) {
  const badgeType = (severity || type || 'INFO').toUpperCase();

  const sizeClasses = size === 'small'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2.5 py-0.5 text-xs';

  const badgeConfigs = {
    CRITICAL: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800/60',
      icon: AlertOctagon,
      pulse: true,
      defaultLabel: 'CRITICAL RISK',
    },
    HIGH: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-200 dark:border-rose-800/60',
      icon: AlertTriangle,
      pulse: false,
      defaultLabel: 'HIGH RISK',
    },
    MEDIUM: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800/60',
      icon: AlertTriangle,
      pulse: false,
      defaultLabel: 'MEDIUM RISK',
    },
    LOW: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800/60',
      icon: Shield,
      pulse: false,
      defaultLabel: 'LOW RISK',
    },
    INFO: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      icon: Info,
      pulse: false,
      defaultLabel: 'INFO',
    },
    HEALTHY: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      icon: CheckCircle,
      pulse: false,
      defaultLabel: 'HEALTHY',
    },
    ACTIVE: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800/60',
      icon: Eye,
      pulse: true,
      defaultLabel: 'ACTIVE',
    },
    STREAMING: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      icon: Radio,
      pulse: true,
      defaultLabel: 'STREAMING',
    },
  };

  const config = badgeConfigs[badgeType] || badgeConfigs.INFO;
  const IconComponent = config.icon;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-mono font-bold border transition-colors ${sizeClasses} ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            badgeType === 'CRITICAL' ? 'bg-red-500' : 'bg-emerald-500'
          }`}></span>
        )}
        <IconComponent className="h-3 w-3 shrink-0" />
      </span>
      <span>{displayLabel}</span>
    </span>
  );
}
