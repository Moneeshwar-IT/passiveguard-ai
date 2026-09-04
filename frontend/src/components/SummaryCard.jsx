import React from 'react';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'cyan', trend }) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    blue: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    red: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  const badgeStyle = colorMap[color] || colorMap.cyan;

  return (
    <div className="bg-[#111827] border border-[#1E293B] hover:border-[#334155] rounded-xl p-4 transition-all shadow-md group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg border ${badgeStyle} group-hover:scale-105 transition-transform`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold font-mono text-white tracking-tight">{value}</div>
      {subtitle && (
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className="font-mono text-cyan-400 font-semibold">{trend}</span>}
        </div>
      )}
    </div>
  );
}
