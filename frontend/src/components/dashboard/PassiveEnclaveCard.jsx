import React from 'react';
import { Eye, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';

export default function PassiveEnclaveCard() {
  const constraints = [
    { title: 'READ-ONLY INGESTION', desc: 'Out-of-band TAP / Span mirror observation' },
    { title: 'NETWORK TRANSMISSION DISABLED', desc: '0 outbound response packets or TCP ACKs emitted' },
    { title: 'ACTIVE PROBING DISABLED', desc: 'Zero port sweeps, DNS probes, or SYN scans' },
    { title: 'METADATA-ONLY ANALYSIS', desc: 'Flow lengths, entropy & jitter features' },
    { title: 'TLS PAYLOAD DECRYPTION DISABLED', desc: 'Strict privacy & TLS integrity preserved' },
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl relative overflow-hidden bg-obsidian-glow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-100 tracking-wider uppercase flex items-center gap-2">
              PASSIVE ENCLAVE OPERATIONAL — READ-ONLY
            </h3>
            <p className="text-xs font-mono text-cyan-400 mt-0.5 font-medium">
              Unidirectional observation enclave & zero-transmission security guarantees
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-400 font-semibold shrink-0">
          <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>ENCLAVE: ● ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {constraints.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center space-x-2 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-mono font-bold text-slate-100 leading-tight">
                {c.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 leading-snug">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
