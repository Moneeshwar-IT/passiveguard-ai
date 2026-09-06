import React from 'react';
import { Eye, Layers, Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DetectionPipeline() {
  const stages = [
    {
      title: 'PASSIVE TRAFFIC',
      icon: Eye,
      detail: 'Out-of-band TAP',
      sub: 'Zero outbound packets',
      color: 'text-[#2563EB] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#2563EB]',
    },
    {
      title: 'FLOW FEATURES',
      icon: Layers,
      detail: 'Scapy Dissection',
      sub: '15+ Extracted Vectors',
      color: 'text-[#2563EB] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#2563EB]',
    },
    {
      title: 'BEHAVIORAL ANALYSIS',
      icon: Activity,
      detail: 'Entropy & Jitter',
      sub: 'Temporal Windowing',
      color: 'text-[#7C3AED] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#7C3AED]',
    },
    {
      title: 'ML INFERENCE',
      icon: Cpu,
      detail: 'Random Forest',
      sub: 'rf-v1.0 / UNSW-NB15',
      color: 'text-[#4F46E5] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#4F46E5]',
    },
    {
      title: 'RISK FUSION',
      icon: ShieldCheck,
      detail: 'Hybrid Engine',
      sub: 'Multi-Signal Fusion',
      color: 'text-[#4F46E5] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#4F46E5]',
    },
    {
      title: 'THREAT ALERT',
      icon: AlertTriangle,
      detail: 'SOC Dispatch',
      sub: 'WebSocket Stream',
      color: 'text-[#DC2626] border-[#E2E8F0] bg-[#F8FAFC]',
      accent: 'border-l-4 border-l-[#DC2626]',
    },
  ];

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#E2E8F0] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] tracking-tight flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-4 w-4 text-[#4F46E5]" />
            AI THREAT DETECTION PIPELINE ARCHITECTURE
          </h3>
          <p className="text-xs text-[#64748B] font-mono mt-0.5">
            Real-time flow path from unidirectional packet capture to hybrid statistical ML risk fusion.
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] px-2.5 py-1 rounded-full uppercase shrink-0">
          HYBRID ML ENGINE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.title}
              className={`p-3.5 rounded-lg border ${st.color} ${st.accent} transition-all hover:scale-[1.02] flex flex-col justify-between h-full font-mono shadow-xs`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  0{idx + 1}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0F172A] tracking-tight">{st.title}</div>
                <div className="text-[11px] font-semibold text-[#334155] mt-1">{st.detail}</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">{st.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
