import React from 'react';
import { Eye, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';

export default function PassiveEnclaveCard() {
  const constraints = [
    { title: 'READ-ONLY INGESTION', desc: 'Out-of-band TAP/Span mirror observation' },
    { title: 'NO OUTBOUND TRAFFIC', desc: '0 response packets or TCP ACKs emitted' },
    { title: 'NO ACTIVE PROBING', desc: 'Zero port sweeps, DNS probes, or SYN scans' },
    { title: 'METADATA-ONLY ANALYSIS', desc: 'Flow lengths, entropy & jitter features' },
    { title: 'TLS PAYLOAD DECRYPTION DISABLED', desc: 'Strict privacy & TLS integrity preserved' },
  ];

  return (
    <div className="bg-[#0D1426] border border-[#22D3EE]/40 rounded-xl p-5 shadow-[0_0_15px_rgba(34,211,238,0.06)] relative overflow-hidden bg-midnight-glow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1C2A45] pb-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-[#22D3EE]" />
            <h3 className="text-sm font-bold font-mono text-[#F8FAFC] tracking-tight uppercase flex items-center gap-2">
              PASSIVE ENCLAVE — READ-ONLY
            </h3>
          </div>
          <p className="text-xs font-mono text-[#22D3EE] mt-1 font-medium">
            "AI-powered passive threat intelligence for unidirectional critical networks."
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-[#050816] border border-[#22D3EE]/30 text-xs font-mono text-[#22D3EE] font-semibold">
          <Eye className="h-3.5 w-3.5 text-[#22D3EE] animate-pulse" />
          <span>STATUS: ● ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {constraints.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-lg bg-[#050816] border border-[#1C2A45] hover:border-[#22D3EE]/40 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center space-x-2 mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#22C55E] shrink-0" />
              <span className="text-[11px] font-mono font-bold text-[#F8FAFC] leading-tight">
                {c.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#94A3B8] leading-snug">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
