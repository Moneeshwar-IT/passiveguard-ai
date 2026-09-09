import React from 'react';
import { Eye, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function PassiveEnclaveCard() {
  const constraints = [
    { title: 'READ-ONLY INGESTION', desc: 'Out-of-band TAP/Span mirror observation' },
    { title: 'NO OUTBOUND TRAFFIC', desc: '0 response packets or TCP ACKs emitted' },
    { title: 'NO ACTIVE PROBING', desc: 'Zero port sweeps, DNS probes, or SYN scans' },
    { title: 'METADATA-ONLY ANALYSIS', desc: 'Flow lengths, entropy & jitter features' },
    { title: 'TLS PAYLOAD DECRYPTION DISABLED', desc: 'Strict privacy & TLS integrity preserved' },
  ];

  return (
    <div className="bg-soc-surface border border-brand-200 rounded-xl p-5 shadow-card relative overflow-hidden bg-enterprise-glow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-soc-border pb-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <h3 className="text-sm font-bold font-mono text-soc-textPrimary tracking-tight uppercase flex items-center gap-2">
              PASSIVE ENCLAVE — READ-ONLY
            </h3>
          </div>
          <p className="text-xs font-mono text-brand mt-1 font-medium">
            "AI-powered passive threat intelligence for unidirectional critical networks."
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-brand-50 border border-brand-200 text-xs font-mono text-brand font-semibold">
          <Eye className="h-3.5 w-3.5 text-brand animate-pulse" />
          <span>STATUS: ● ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {constraints.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-lg bg-soc-surfaceSubtle border border-soc-border hover:border-brand-200 transition-colors flex flex-col justify-between shadow-subtle"
          >
            <div className="flex items-center space-x-2 mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="text-[11px] font-mono font-bold text-soc-textPrimary leading-tight">
                {c.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-soc-textMuted leading-snug">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
