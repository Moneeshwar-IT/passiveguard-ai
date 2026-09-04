import React from 'react';
import { Eye, ShieldCheck, CheckCircle2, Lock, Radio } from 'lucide-react';

export default function PassiveEnclaveCard() {
  const constraints = [
    { title: 'READ-ONLY INGESTION', desc: 'Out-of-band TAP/Span mirror observation' },
    { title: 'NO OUTBOUND TRAFFIC', desc: '0 response packets or TCP ACKs emitted' },
    { title: 'NO ACTIVE PROBING', desc: 'Zero port sweeps, DNS probes, or scans' },
    { title: 'PAYLOAD DECRYPTION DISABLED', desc: 'Strict privacy & TLS integrity preserved' },
    { title: 'METADATA-ONLY ANALYSIS', desc: 'Flow lengths, entropy & jitter features' },
  ];

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-5 shadow-lg relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">
              PASSIVE SECURITY ENCLAVE GUARANTEES
            </h3>
          </div>
          <p className="text-xs font-mono text-cyan-400 mt-1">
            "AI-powered passive threat intelligence for unidirectional critical networks."
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-[#070B14] border border-cyan-500/30 text-xs font-mono text-cyan-400">
          <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>STATUS: UNIDIRECTIONAL ENCLAVE LOCKED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {constraints.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-lg bg-[#070B14] border border-[#1E293B] hover:border-cyan-500/40 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center space-x-2 mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-mono font-bold text-white leading-tight">
                {c.title}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
