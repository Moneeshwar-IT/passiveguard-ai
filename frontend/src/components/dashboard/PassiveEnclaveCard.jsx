import React from 'react';
import { Eye, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';

export default function PassiveEnclaveCard() {
  const statuses = [
    { title: 'READ-ONLY OBSERVATION', desc: 'Out-of-band TAP / Span mirror ingestion' },
    { title: 'NETWORK TRANSMISSION DISABLED', desc: 'Zero outbound response packets or ACKs' },
    { title: 'ACTIVE PROBING DISABLED', desc: 'Zero port sweeps, SYN scans, or DNS probes' },
    { title: 'METADATA-ONLY ANALYSIS', desc: 'Flow statistical features & vector extraction' },
    { title: 'TLS DECRYPTION DISABLED', desc: 'Payload integrity & privacy strictly preserved' },
  ];

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-[#ECFDF5] border border-[#BBF7D0] text-[#16A34A]">
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono text-[#0F172A] tracking-wider uppercase">
              PASSIVE ENCLAVE OPERATIONAL
            </h3>
            <p className="text-[11px] font-mono text-[#64748B]">
              Unidirectional observation enclave & zero-transmission security guarantees
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-[#ECFDF5] border border-[#BBF7D0] text-[11px] font-mono text-[#15803D] font-bold shrink-0">
          <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse"></span>
          <span>READ-ONLY ENCLAVE ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {statuses.map((s) => (
          <div
            key={s.title}
            className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between"
          >
            <div className="flex items-center space-x-2 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A] shrink-0" />
              <span className="text-[10px] font-mono font-bold text-[#0F172A] leading-tight">
                {s.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#64748B] leading-normal">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
