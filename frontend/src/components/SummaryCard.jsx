import React from 'react';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colorMap = {
    blue: {
      badge: 'text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]',
      text: 'text-[#2563EB]',
      borderTop: 'border-t-4 border-t-[#2563EB]',
    },
    indigo: {
      badge: 'text-[#4F46E5] bg-[#EEF2FF] border-[#C7D2FE]',
      text: 'text-[#4F46E5]',
      borderTop: 'border-t-4 border-t-[#4F46E5]',
    },
    purple: {
      badge: 'text-[#7C3AED] bg-[#F5F3FF] border-[#DDD6FE]',
      text: 'text-[#7C3AED]',
      borderTop: 'border-t-4 border-t-[#7C3AED]',
    },
    red: {
      badge: 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]',
      text: 'text-[#DC2626]',
      borderTop: 'border-t-4 border-t-[#DC2626]',
    },
    amber: {
      badge: 'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]',
      text: 'text-[#D97706]',
      borderTop: 'border-t-4 border-t-[#D97706]',
    },
    green: {
      badge: 'text-[#16A34A] bg-[#ECFDF5] border-[#BBF7D0]',
      text: 'text-[#16A34A]',
      borderTop: 'border-t-4 border-t-[#16A34A]',
    },
  };

  const styleObj = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-[#FFFFFF] border border-[#E2E8F0] ${styleObj.borderTop} rounded-xl p-4 transition-all shadow-xs hover:shadow-sm group flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-semibold text-[#64748B] uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className={`p-2 rounded-lg border ${styleObj.badge} group-hover:scale-105 transition-transform shadow-xs`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono text-[#0F172A] tracking-tight">{value}</div>
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-[#64748B] mt-2 pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className={`font-mono font-bold ${styleObj.text}`}>{trend}</span>}
        </div>
      )}
    </div>
  );
}
