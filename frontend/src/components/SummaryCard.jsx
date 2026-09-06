import React from 'react';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'cyan', trend }) {
  const colorMap = {
    cyan: {
      badge: 'text-[#22D3EE] bg-[rgba(34,211,238,0.10)] border-[#22D3EE]/30',
      text: 'text-[#22D3EE]',
      borderTop: 'border-t-2 border-t-[#22D3EE]',
    },
    blue: {
      badge: 'text-[#22D3EE] bg-[rgba(34,211,238,0.10)] border-[#22D3EE]/30',
      text: 'text-[#22D3EE]',
      borderTop: 'border-t-2 border-t-[#22D3EE]',
    },
    indigo: {
      badge: 'text-[#6366F1] bg-[rgba(99,102,241,0.12)] border-[#6366F1]/30',
      text: 'text-[#6366F1]',
      borderTop: 'border-t-2 border-t-[#6366F1]',
    },
    purple: {
      badge: 'text-[#A855F7] bg-[rgba(168,85,247,0.12)] border-[#A855F7]/30',
      text: 'text-[#A855F7]',
      borderTop: 'border-t-2 border-t-[#A855F7]',
    },
    red: {
      badge: 'text-[#EF4444] bg-[rgba(239,68,68,0.15)] border-[#EF4444]/30',
      text: 'text-[#EF4444]',
      borderTop: 'border-t-2 border-t-[#EF4444]',
    },
    amber: {
      badge: 'text-[#F59E0B] bg-[rgba(245,158,11,0.15)] border-[#F59E0B]/30',
      text: 'text-[#F59E0B]',
      borderTop: 'border-t-2 border-t-[#F59E0B]',
    },
    green: {
      badge: 'text-[#22C55E] bg-[rgba(34,197,94,0.12)] border-[#22C55E]/30',
      text: 'text-[#22C55E]',
      borderTop: 'border-t-2 border-t-[#22C55E]',
    },
  };

  const styleObj = colorMap[color] || colorMap.cyan;

  return (
    <div className={`bg-[#0D1426] border border-[#1C2A45] ${styleObj.borderTop} rounded-xl p-4 transition-all shadow-md hover:bg-[#111B32] hover:border-[#2B4268] group flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-semibold text-[#94A3B8] uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className={`p-2 rounded-lg border ${styleObj.badge} group-hover:scale-105 transition-transform`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono text-[#F8FAFC] tracking-tight">{value}</div>
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-[#64748B] mt-2 pt-2 border-t border-[#1C2A45] flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className={`font-mono font-bold ${styleObj.text}`}>{trend}</span>}
        </div>
      )}
    </div>
  );
}
