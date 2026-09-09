import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function EmptyState({ title = 'NO DATA OBSERVED', description = 'No active telemetry or alerts recorded in current monitoring window.', icon: Icon = ShieldCheck }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3 font-mono">
      <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">{description}</p>
      </div>
    </div>
  );
}
