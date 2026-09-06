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
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] border-l-4 border-l-[#16A34A] rounded-xl p-5 shadow-xs transition-all hover:shadow-sm relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3.5 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-[#16A34A]" />
            <h3 className="text-sm font-bold font-mono text-[#0F172A] tracking-tight uppercase flex items-center gap-2">
              PASSIVE ENCLAVE — READ-ONLY OBSERVATION
            </h3>
          </div>
          <p className="text-xs font-mono text-[#2563EB] mt-1 font-semibold">
            "AI-powered passive threat intelligence for unidirectional critical networks."
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#ECFDF5] border border-[#BBF7D0] text-xs font-mono text-[#15803D] font-semibold shrink-0">
          <Eye className="h-3.5 w-3.5 text-[#16A34A] animate-pulse" />
          <span>STATUS: ● OPERATIONAL</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {constraints.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BBF7D0] transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center space-x-2 mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
              <span className="text-[11px] font-mono font-bold text-[#0F172A] leading-tight">
                {c.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#64748B] leading-snug">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
