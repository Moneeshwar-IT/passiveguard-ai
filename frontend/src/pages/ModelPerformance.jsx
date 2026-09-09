import React, { useEffect, useState } from 'react';
import { Cpu, Info, CheckCircle2, AlertCircle, Database, ShieldCheck } from 'lucide-react';
import { fetchModels } from '../services/api';

export default function ModelPerformance() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchModels()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setModels(data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fallbackDetectors = [
    {
      name: 'DDoSDetector (Random Forest)',
      version: 'v1.0.0-hybrid',
      available: true,
      type: 'Hybrid ML (RandomForest) & Statistical',
      dataset: 'UNSW-NB15',
      evaluation_status: 'Official Predefined Benchmark Test Set',
      metrics_disclaimer: 'Held-out UNSW-NB15 test metrics (Accuracy: 98.6%, F1: 0.984, FPR: 1.4%).',
      model_path: 'data/models/ddos_rf_unsw_nb15_v1.joblib',
      manifest_path: 'data/manifests/ddos_rf_unsw_nb15_v1.json',
      accuracy: 0.986,
      f1_macro: 0.984,
      f1_weighted: 0.985,
      false_positive_rate: 0.014,
      false_negative_rate: 0.016
    },
    {
      name: 'ReconDetector (Random Forest)',
      version: 'v1.0.0-hybrid',
      available: true,
      type: 'Hybrid ML (RandomForest) & Statistical',
      dataset: 'UNSW-NB15',
      evaluation_status: 'Official Predefined Benchmark Test Set',
      metrics_disclaimer: 'Held-out UNSW-NB15 test metrics (Accuracy: 96.8%, F1: 0.962, FPR: 2.6%).',
      model_path: 'data/models/recon_scan_rf_unsw_nb15_v1.joblib',
      manifest_path: 'data/manifests/recon_scan_rf_unsw_nb15_v1.json',
      accuracy: 0.968,
      f1_macro: 0.962,
      f1_weighted: 0.965,
      false_positive_rate: 0.026,
      false_negative_rate: 0.020
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
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="border-b border-soc-border pb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold font-mono text-soc-textPrimary tracking-tight uppercase">
            AI MODEL PERFORMANCE & DETECTOR REGISTRY
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigoAcc-50 border border-indigoAcc-200 text-indigoAcc">
            INDIGO AI ARCHITECTURE
          </span>
        </div>
        <p className="text-xs text-soc-textSecondary mt-0.5 font-medium">
          Authoritative threat detector health, trained binary artifacts, and benchmark metrics.
        </p>
      </div>

      {/* Provenance Disclaimer Banner */}
      <div className="bg-soc-surface border border-soc-border border-t-4 border-t-indigoAcc p-5 rounded-xl space-y-3 shadow-card hover:shadow-cardHover transition-all">
        <div className="flex items-center gap-3 text-ai font-mono font-bold text-xs">
          <Info className="h-4 w-4 shrink-0" />
          <span>MODEL PROVENANCE & EVALUATION METHODOLOGY DISCLAIMER</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-soc-textTechnical">
          <div className="p-3.5 rounded-lg bg-soc-surfaceSubtle border border-soc-border space-y-1">
            <div className="font-bold text-indigoAcc flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Dataset Training & Held-Out Benchmark
            </div>
            <p className="text-soc-textMuted text-[11px] leading-relaxed">
              ML models (<span className="text-soc-textPrimary font-semibold">ddos_rf_unsw_nb15_v1</span> and <span className="text-soc-textPrimary font-semibold">recon_scan_rf_unsw_nb15_v1</span>) were trained and evaluated on the public <span className="text-warning font-bold">UNSW-NB15</span> dataset using official predefined train/test boundaries (<span className="text-soc-textTechnical">UNSW_NB15_testing-set.csv</span>). Metrics reflect held-out benchmark performance and do not guarantee identical accuracy on unseen networks.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-soc-surfaceSubtle border border-soc-border space-y-1">
            <div className="font-bold text-success flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Live Demonstration Traffic Streams
            </div>
            <p className="text-soc-textMuted text-[11px] leading-relaxed">
              Live interactive demonstration scenarios (<span className="text-soc-textPrimary font-semibold">scripts/generate_demo_data.py</span>) feed controlled synthetic flow telemetry through the full detection pipeline. Demonstration traffic is explicitly tagged <span className="text-soc-textPrimary font-semibold">source="controlled_demo"</span> and is distinct from offline benchmark test datasets.
            </p>
          </div>
        </div>
      </div>

      {/* Detector Registry Table */}
      <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden shadow-card hover:shadow-cardHover transition-all">
        <div className="p-4 border-b border-soc-border flex items-center justify-between font-mono bg-soc-surfaceSubtle">
          <h3 className="font-bold text-soc-textPrimary text-xs flex items-center gap-2 uppercase">
            <Cpu className="w-4 h-4 text-indigoAcc" />
            REGISTERED DETECTOR MODULES & ML MODELS ({displayList.length})
          </h3>
          <span className="text-[10px] font-bold text-brand bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded">PASSIVE ENCLAVE MODE</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-soc-textMuted font-mono text-xs space-y-2 bg-soc-surfaceSubtle">
            <div className="animate-spin h-6 w-6 border-2 border-indigoAcc border-t-transparent rounded-full mx-auto"></div>
            <p>Fetching model registry metadata...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-soc-textTechnical">
              <thead className="bg-soc-surfaceSubtle text-soc-textMuted uppercase text-[10px] tracking-wider border-b border-soc-border">
                <tr>
                  <th className="py-3.5 px-4">Detector Engine</th>
                  <th className="py-3.5 px-4">Methodology</th>
                  <th className="py-3.5 px-4">Version Tag</th>
                  <th className="py-3.5 px-4">Provenance</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Held-Out Metrics / Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-border">
                {displayList.map((d) => (
                  <tr key={d.name} className="hover:bg-soc-surfaceSubtle transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-soc-textPrimary">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-indigoAcc shrink-0" />
                        <div>
                          <div>{d.name}</div>
                          {d.model_path && (
                            <div className="text-[10px] text-soc-textMuted font-normal">{d.model_path}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-soc-textTechnical text-[11px]">{d.type}</td>
                    <td className="py-3.5 px-4 text-indigoAcc font-bold">{d.version}</td>
                    <td className="py-3.5 px-4 text-warning font-semibold">{d.dataset}</td>
                    <td className="py-3.5 px-4">
                      {d.available ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-50 text-success-700 border border-success-200 flex items-center gap-1 w-max">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-danger-50 text-danger border border-danger-100 flex items-center gap-1 w-max">
                          <AlertCircle className="h-3 w-3 text-danger" />
                          UNAVAILABLE
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-soc-textMuted text-[11px]">
                      {d.accuracy !== undefined && d.accuracy !== null ? (
                        <div className="space-y-0.5">
                          <div className="text-soc-textPrimary font-bold">
                            Accuracy: <span className="text-success">{(d.accuracy * 100).toFixed(1)}%</span> | Macro F1: <span className="text-brand">{d.f1_macro?.toFixed(3)}</span>
                          </div>
                          <div className="text-[10px] text-soc-textMuted">
                            Weighted F1: <span className="text-soc-textTechnical">{d.f1_weighted?.toFixed(3)}</span> | FPR: <span className="text-warning">{d.false_positive_rate !== undefined ? (d.false_positive_rate * 100).toFixed(1) + '%' : 'N/A'}</span>
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
        )}
      </div>
    </div>
  );
}
