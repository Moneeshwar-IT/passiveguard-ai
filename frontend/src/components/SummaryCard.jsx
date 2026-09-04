import React from 'react';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'sky' }) {
  const colorMap = {
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    red: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  const badgeStyle = colorMap[color] || colorMap.sky;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg border ${badgeStyle}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}
