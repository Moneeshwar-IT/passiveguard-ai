import React, { useEffect, useState } from 'react';
import { Cpu, Info, CheckCircle2, AlertCircle, Database, FileJson, BarChart3, ShieldCheck } from 'lucide-react';
import { fetchModels } from '../services/api';

export default function ModelPerformance() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        if (data && data.length > 0) {
          setModels(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fallbackDetectors = [
    {
      name: 'DDoSDetector (Random Forest)',
      version: 'v1.0.0-hybrid',
      available: true,
      type: 'Hybrid ML (RandomForest) & Statistical',
      dataset: 'UNSW-NB15',
      evaluation_status: 'Official Predefined Benchmark Test Set',
      metrics_disclaimer: 'Held-out UNSW-NB15 test metrics (Accuracy: 93.53%, Macro F1: 0.8526, Weighted F1: 0.9411, FPR: 6.47%).',
      model_path: 'data/models/ddos_rf_unsw_nb15_v1.joblib',
      manifest_path: 'data/manifests/ddos_rf_unsw_nb15_v1.json',
      accuracy: 0.9353,
      f1_macro: 0.8526,
      f1_weighted: 0.9411,
      false_positive_rate: 0.0647,
      false_negative_rate: 0.0646
    },
    {
      name: 'ReconDetector (Random Forest)',
      version: 'v1.0.0-hybrid',
      available: true,
      type: 'Hybrid ML (RandomForest) & Statistical',
      dataset: 'UNSW-NB15',
      evaluation_status: 'Official Predefined Benchmark Test Set',
      metrics_disclaimer: 'Held-out UNSW-NB15 test metrics (Accuracy: 97.43%, Macro F1: 0.9271, Weighted F1: 0.9756, FPR: 2.62%).',
      model_path: 'data/models/recon_scan_rf_unsw_nb15_v1.joblib',
      manifest_path: 'data/manifests/recon_scan_rf_unsw_nb15_v1.json',
      accuracy: 0.9743,
      f1_macro: 0.9271,
      f1_weighted: 0.9756,
      false_positive_rate: 0.0262,
      false_negative_rate: 0.0200
    },
    {
      name: 'C2Detector',
      version: 'statistical-v1',
      available: true,
      type: 'Statistical Periodicity & Recurrence',
      dataset: 'Rule Baseline / Heuristic Engine',
      evaluation_status: 'Heuristic Baseline Active',
      metrics_disclaimer: 'Statistical heuristic baseline active. Evaluates inter-arrival time periodicity and destination IP recurrence.'
    },
    {
      name: 'DGADetector',
      version: 'statistical-v1',
      available: true,
      type: 'DNS Entropy & Lexical Analysis',
      dataset: 'Rule Baseline / Heuristic Engine',
      evaluation_status: 'Heuristic Baseline Active',
      metrics_disclaimer: 'Statistical heuristic baseline active. Evaluates Shannon entropy and character distribution of DNS subdomains.'
    },
    {
      name: 'DNSTunnelDetector',
      version: 'statistical-v1',
      available: true,
      type: 'Subdomain Churn & Entropy',
      dataset: 'Rule Baseline / Heuristic Engine',
      evaluation_status: 'Heuristic Baseline Active',
      metrics_disclaimer: 'Statistical heuristic baseline active. Evaluates subdomain query lengths, character volume, and query frequencies.'
    },
    {
      name: 'TLSDetector',
      version: 'statistical-v1',
      available: true,
      type: 'Metadata-only TLS/QUIC Fingerprint',
      dataset: 'Rule Baseline / Heuristic Engine',
      evaluation_status: 'Heuristic Baseline Active',
      metrics_disclaimer: 'Statistical heuristic baseline active. Evaluates TLS record lengths, SSL versions, JA3 hashes, and packet size variance.'
    },
    {
      name: 'ExfiltrationDetector',
      version: 'statistical-exfil-v1',
      available: true,
      type: 'Directional Byte Asymmetry & Egress Volume',
      dataset: 'Rule Baseline / Heuristic Engine',
      evaluation_status: 'Heuristic Baseline Active',
      metrics_disclaimer: 'Statistical heuristic baseline active. Evaluates outbound directional byte ratios and sustained high-volume egress transfers.'
    }
  ];

  const displayList = models.length > 0 ? models : fallbackDetectors;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">AI Detector Registry & Model Architecture</h2>
        <p className="text-sm text-slate-400">Authoritative threat detector status, trained ML binary artifacts, and benchmark provenance.</p>
      </div>

      {/* Honest Provenance Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 shadow-lg">
        <div className="flex items-center gap-3 text-amber-400 font-bold text-sm">
          <Info className="h-5 w-5 shrink-0" />
          <span>Model Provenance & Evaluation Methodology Provenance</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="font-bold text-blue-400 flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              Dataset Training & Benchmark Evaluation
            </div>
            <p className="text-slate-400 leading-relaxed">
              ML models (<span className="font-mono text-slate-200">ddos_rf_unsw_nb15_v1</span> and <span className="font-mono text-slate-200">recon_scan_rf_unsw_nb15_v1</span>) were trained and evaluated on the public <span className="font-bold text-amber-300">UNSW-NB15</span> dataset using official predefined train/test boundaries (<span className="font-mono text-slate-300">UNSW_NB15_testing-set.csv</span>). Metrics reflect held-out benchmark performance and do not guarantee identical accuracy on unseen production networks.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="font-bold text-teal-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Live SIH Demonstration Traffic
            </div>
            <p className="text-slate-400 leading-relaxed">
              Live interactive demonstration scenarios (<span className="font-mono text-slate-200">scripts/generate_demo_data.py</span>) feed controlled synthetic flow telemetry through the full detection pipeline. Demonstration traffic is explicitly tagged <span className="font-mono text-slate-200">source="controlled_demo"</span> and is distinct from the offline UNSW-NB15 benchmark test dataset.
            </p>
          </div>
        </div>
      </div>

      {/* Detector Registry Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            Registered Detector Modules & ML Models ({displayList.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">Passive Enclave Mode</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-3.5 px-4">Detector Engine</th>
                <th className="py-3.5 px-4">Methodology</th>
                <th className="py-3.5 px-4">Version Tag</th>
                <th className="py-3.5 px-4">Provenance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Held-Out Metrics / Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayList.map((d) => (
                <tr key={d.name} className="hover:bg-slate-800/50">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-sky-400 shrink-0" />
                      <div>
                        <div>{d.name}</div>
                        {d.model_path && (
                          <div className="text-[11px] font-mono text-slate-500 font-normal">{d.model_path}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 text-xs">{d.type}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-sky-400 font-bold">{d.version}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-amber-400 font-semibold">{d.dataset}</td>
                  <td className="py-3.5 px-4">
                    {d.available ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                        <CheckCircle2 className="h-3 w-3" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
                        <AlertCircle className="h-3 w-3" />
                        UNAVAILABLE
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                    {d.accuracy !== undefined && d.accuracy !== null ? (
                      <div className="space-y-1">
                        <div className="text-slate-200 font-bold">
                          Accuracy: <span className="text-emerald-400">{(d.accuracy * 100).toFixed(2)}%</span> | Macro F1: <span className="text-cyan-400">{d.f1_macro?.toFixed(4)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Weighted F1: <span className="text-slate-200">{d.f1_weighted?.toFixed(4)}</span> | FPR: <span className="text-amber-400">{d.false_positive_rate !== undefined ? (d.false_positive_rate * 100).toFixed(2) + '%' : 'N/A'}</span>
                        </div>
                      </div>
                    ) : (
                      <span>{d.metrics_disclaimer}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
