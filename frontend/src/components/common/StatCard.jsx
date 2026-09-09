import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend, highlight = false }) {
  const colorMap = {
    blue: {
      badge: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
      text: 'text-blue-600 dark:text-blue-400',
      accent: 'border-t-2 border-t-blue-600 dark:border-t-blue-500',
    },
    indigo: {
      badge: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
      text: 'text-indigo-600 dark:text-indigo-400',
      accent: 'border-t-2 border-t-indigo-600 dark:border-t-indigo-500',
    },
    purple: {
      badge: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
      text: 'text-purple-600 dark:text-purple-400',
      accent: 'border-t-2 border-t-purple-600 dark:border-t-purple-500',
    },
    red: {
      badge: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60',
      text: 'text-red-600 dark:text-red-400',
      accent: 'border-t-2 border-t-red-600 dark:border-t-red-500',
    },
    amber: {
      badge: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
      text: 'text-amber-600 dark:text-amber-400',
      accent: 'border-t-2 border-t-amber-600 dark:border-t-amber-500',
    },
    green: {
      badge: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
      text: 'text-emerald-600 dark:text-emerald-400',
      accent: 'border-t-2 border-t-emerald-600 dark:border-t-emerald-500',
    },
  };

  const styleObj = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${styleObj.accent} rounded-xl p-4 transition-all duration-150 shadow-card hover:shadow-cardHover dark:shadow-none dark:hover:border-slate-700 group flex flex-col justify-between ${
        highlight ? 'ring-2 ring-red-500/30 dark:ring-red-400/30' : ''
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          {Icon && (
            <div className={`p-2 rounded-lg border ${styleObj.badge} group-hover:scale-105 transition-transform`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </div>
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className={`font-mono font-bold ${styleObj.text}`}>{trend}</span>}
        </div>
      )}
    </div>
  );
}
