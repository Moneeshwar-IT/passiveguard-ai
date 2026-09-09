import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import TrafficAnalytics from './pages/TrafficAnalytics';
import ModelPerformance from './pages/ModelPerformance';
import DemoSimulation from './pages/DemoSimulation';
import { WebSocketProvider } from './context/WebSocketContext';
import { BackendStatusProvider, useBackendStatus } from './context/BackendStatusContext';

function ApiMissingBanner() {
  const { isApiUrlMissing } = useBackendStatus();
  if (!isApiUrlMissing) return null;

  return (
    <div className="bg-danger border-b border-danger-700 px-4 py-2.5 text-white font-mono text-xs flex items-center justify-between shadow-md" role="alert" aria-live="assertive">
      <div className="flex items-center space-x-2">
        <span className="font-bold uppercase tracking-wider">[CONFIG ERROR]</span>
        <span>Environment variable <code className="bg-black/30 px-1.5 py-0.5 rounded font-bold">VITE_API_BASE_URL</code> is not defined!</span>
      </div>
      <span className="text-[11px] opacity-90">Set VITE_API_BASE_URL in .env to connect to the PassiveGuard API backend.</span>
    </div>
  );
}

function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-soc-bg text-soc-textPrimary font-sans selection:bg-brand-50 selection:text-brand bg-enterprise-glow">
      <ApiMissingBanner />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 bg-soc-bg overflow-y-auto min-w-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/demo" element={<DemoSimulation />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/alert-details" element={<AlertDetails />} />
            <Route path="/traffic" element={<TrafficAnalytics />} />
            <Route path="/models" element={<ModelPerformance />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <BackendStatusProvider>
        <Router>
          <MainLayout />
        </Router>
      </BackendStatusProvider>
    </WebSocketProvider>
  );
}
