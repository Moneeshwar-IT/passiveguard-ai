import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';
import Badge from '../common/Badge';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound packets',
      color: 'text-enterprise-primary dark:text-enterprise-primaryDark',
      accent: 'border-l-4 border-l-enterprise-primary dark:border-l-enterprise-primaryDark',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-enterprise-primary dark:text-enterprise-primaryDark',
      accent: 'border-l-4 border-l-enterprise-primary dark:border-l-enterprise-primaryDark',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-purple-600 dark:text-purple-400',
      accent: 'border-l-4 border-l-purple-500',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-indigo-600 dark:text-indigo-400',
      accent: 'border-l-4 border-l-indigo-500',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Multi-Signal Fusion',
      color: 'text-indigo-600 dark:text-indigo-400',
      accent: 'border-l-4 border-l-indigo-500',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-rose-600 dark:text-rose-400',
      accent: 'border-l-4 border-l-rose-500',
    },
  ];

  return (
    <div className="bg-enterprise-surface dark:bg-enterprise-surfaceDark border border-enterprise-border dark:border-enterprise-borderDark rounded-xl p-5 shadow-card transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-enterprise-border dark:border-enterprise-borderDark pb-3">
        <div>
          <h3 className="text-sm font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-4 w-4 text-indigo-500" />
            AI THREAT DETECTION PIPELINE ARCHITECTURE
          </h3>
          <p className="text-xs text-enterprise-textMuted dark:text-enterprise-textMutedDark font-mono mt-0.5">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <div className="shrink-0">
          <Badge type="ACTIVE" label="HYBRID ML ENGINE ACTIVE" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.title}
              className={`p-3.5 rounded-lg border border-enterprise-border dark:border-enterprise-borderDark bg-enterprise-surfaceSubtle dark:bg-enterprise-surfaceSubtleDark ${st.color} ${st.accent} transition-all hover:scale-[1.02] flex flex-col justify-between h-full font-mono shadow-subtle`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-enterprise-textMuted dark:text-enterprise-textMutedDark">
                  0{idx + 1}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark tracking-tight">{st.title}</div>
                <div className="text-[11px] font-semibold text-enterprise-textSecondary dark:text-enterprise-textSecondaryDark mt-1">{st.detail}</div>
                <div className="text-[10px] text-enterprise-textMuted dark:text-enterprise-textMutedDark mt-0.5">{st.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
