import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound packets',
      color: 'text-cyan-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-cyan-400',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-cyan-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-cyan-400',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-purple-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-purple-400',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-indigo-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-indigo-400',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Multi-Signal Fusion',
      color: 'text-indigo-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-indigo-400',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-rose-400 border-slate-800/80 bg-slate-950/60',
      accent: 'border-l-4 border-l-rose-500',
    },
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-100 tracking-wider flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-4 w-4 text-cyan-400" />
            AI THREAT DETECTION PIPELINE ARCHITECTURE
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-lg uppercase shrink-0">
          HYBRID ML ENGINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.title}
              className={`p-3.5 rounded-lg border ${st.color} ${st.accent} transition-all hover:scale-[1.02] flex flex-col justify-between h-full font-mono shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  0{idx + 1}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 tracking-tight">{st.title}</div>
                <div className="text-[11px] font-semibold text-slate-300 mt-1">{st.detail}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{st.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
