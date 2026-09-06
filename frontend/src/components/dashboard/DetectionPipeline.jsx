import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound packets',
      color: 'text-[#22D3EE] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#22D3EE]',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-[#22D3EE] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#22D3EE]',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-[#A855F7] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#A855F7]',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-[#6366F1] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#6366F1]',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Multi-Signal Fusion',
      color: 'text-[#6366F1] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#6366F1]',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-[#EF4444] border-[#1C2A45] bg-[#050816]',
      accent: 'border-l-4 border-l-[#EF4444]',
    },
  ];

  return (
    <div className="bg-[#0D1426] border border-[#1C2A45] rounded-xl p-5 shadow-lg transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#1C2A45] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-4 w-4 text-[#6366F1]" />
            AI THREAT DETECTION PIPELINE ARCHITECTURE
          </h3>
          <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#6366F1] bg-[rgba(99,102,241,0.12)] border border-[#6366F1]/30 px-2.5 py-1 rounded-full uppercase shrink-0">
          HYBRID ML ENGINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.title}
              className={`p-3.5 rounded-lg border ${st.color} ${st.accent} transition-all hover:scale-[1.02] flex flex-col justify-between h-full font-mono`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  0{idx + 1}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#F8FAFC] tracking-tight">{st.title}</div>
                <div className="text-[11px] font-semibold text-[#CBD5E1] mt-1">{st.detail}</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">{st.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
