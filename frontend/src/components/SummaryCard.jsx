import React from 'react';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colorMap = {
    cyan: {
      badge: 'text-brand bg-brand-50 border-brand-200',
      text: 'text-brand',
      borderTop: 'border-t-2 border-t-brand',
    },
    blue: {
      badge: 'text-brand bg-brand-50 border-brand-200',
      text: 'text-brand',
      borderTop: 'border-t-2 border-t-brand',
    },
    indigo: {
      badge: 'text-indigoAcc bg-indigoAcc-50 border-indigoAcc-200',
      text: 'text-indigoAcc',
      borderTop: 'border-t-2 border-t-indigoAcc',
    },
    purple: {
      badge: 'text-ai bg-ai-50 border-ai-200',
      text: 'text-ai',
      borderTop: 'border-t-2 border-t-ai',
    },
    red: {
      badge: 'text-danger bg-danger-50 border-danger-100',
      text: 'text-danger',
      borderTop: 'border-t-2 border-t-danger',
    },
    amber: {
      badge: 'text-warning bg-warning-50 border-warning-100',
      text: 'text-warning',
      borderTop: 'border-t-2 border-t-warning',
    },
    green: {
      badge: 'text-success-700 bg-success-50 border-success-200',
      text: 'text-success-700',
      borderTop: 'border-t-2 border-t-success',
    },
  };

  const styleObj = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-soc-surface border border-soc-border ${styleObj.borderTop} rounded-xl p-4 transition-all shadow-card hover:shadow-cardHover hover:border-soc-borderHover group flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-semibold text-soc-textMuted uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className={`p-2 rounded-lg border ${styleObj.badge} group-hover:scale-105 transition-transform`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono text-soc-textPrimary tracking-tight">{value}</div>
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-soc-textMuted mt-2 pt-2 border-t border-soc-border flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className={`font-mono font-bold ${styleObj.text}`}>{trend}</span>}
        </div>
      )}
    </div>
  );
}
