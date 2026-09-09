import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound packets',
      color: 'text-brand border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-brand',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-brand border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-brand',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-ai border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-ai',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-indigoAcc border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-indigoAcc',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Multi-Signal Fusion',
      color: 'text-indigoAcc border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-indigoAcc',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-danger border-soc-border bg-soc-surfaceSubtle',
      accent: 'border-l-4 border-l-danger',
    },
  ];

  return (
    <div className="bg-soc-surface border border-soc-border rounded-xl p-5 shadow-card transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-soc-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-soc-textPrimary tracking-tight flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-4 w-4 text-indigoAcc" />
            AI THREAT DETECTION PIPELINE ARCHITECTURE
          </h3>
          <p className="text-xs text-soc-textMuted font-mono mt-0.5">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-indigoAcc bg-indigoAcc-50 border border-indigoAcc-200 px-2.5 py-1 rounded-full uppercase shrink-0">
          HYBRID ML ENGINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.title}
              className={`p-3.5 rounded-lg border ${st.color} ${st.accent} transition-all hover:scale-[1.02] flex flex-col justify-between h-full font-mono shadow-subtle`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-soc-textMuted">
                  0{idx + 1}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-soc-textPrimary tracking-tight">{st.title}</div>
                <div className="text-[11px] font-semibold text-soc-textTechnical mt-1">{st.detail}</div>
                <div className="text-[10px] text-soc-textMuted mt-0.5">{st.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
