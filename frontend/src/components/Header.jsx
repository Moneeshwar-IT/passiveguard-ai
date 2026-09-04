import React, { useEffect, useState } from 'react';
import { ShieldCheck, Eye, Activity, AlertCircle } from 'lucide-react';
import { fetchHealth } from '../services/api';

export default function Header() {
  const [healthStatus, setHealthStatus] = useState('healthy');

  useEffect(() => {
    const checkHealth = () => {
      fetchHealth()
        .then((data) => {
          if (data && data.status === 'healthy') {
            setHealthStatus('healthy');
          } else {
            setHealthStatus('degraded');
          }
        })
        .catch(() => {
          setHealthStatus('offline');
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <ShieldCheck className="h-7 w-7 text-sky-400" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">PassiveGuard AI</h1>
          <p className="text-xs text-slate-400">Unidirectional Traffic Threat Monitoring System</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-full border border-sky-500/30 text-xs font-mono text-sky-400">
          <Eye className="h-4 w-4 text-sky-400 animate-pulse" />
          <span>PASSIVE ENCLAVE: READ-ONLY</span>
        </div>

        {healthStatus === 'healthy' && (
          <div className="flex items-center space-x-2 bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>SYSTEM HEALTHY</span>
          </div>
        )}

        {healthStatus === 'degraded' && (
          <div className="flex items-center space-x-2 bg-amber-950/60 px-3 py-1.5 rounded-full border border-amber-500/30 text-xs font-mono text-amber-400">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span>SYSTEM DEGRADED</span>
          </div>
        )}

        {healthStatus === 'offline' && (
          <div className="flex items-center space-x-2 bg-red-950/60 px-3 py-1.5 rounded-full border border-red-500/30 text-xs font-mono text-red-400">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span>BACKEND OFFLINE</span>
          </div>
        )}
      </div>
    </header>
  );
}
