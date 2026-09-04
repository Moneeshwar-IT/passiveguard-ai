import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound transmission',
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-sky-400 border-sky-500/30 bg-sky-950/40',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-teal-400 border-teal-500/30 bg-teal-950/40',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-purple-400 border-purple-500/30 bg-purple-950/40',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Score Aggregation',
      color: 'text-amber-400 border-amber-500/30 bg-amber-950/40',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-rose-400 border-rose-500/30 bg-rose-950/40',
    },
  ];

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-[#1E293B] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            AI Threat Detection Pipeline Architecture
          </h3>
          <p className="text-xs text-slate-400">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-full uppercase">
          HYBRID PIPELINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-center">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <React.Fragment key={st.title}>
              <div className={`p-3.5 rounded-lg border ${st.color} transition-all hover:scale-[1.02] flex flex-col justify-between h-full`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    0{idx + 1}
                  </span>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-tight">{st.title}</div>
                  <div className="text-[11px] font-mono font-semibold text-slate-300 mt-1">{st.detail}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{st.sub}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
