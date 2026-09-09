import React, { useState } from 'react';
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
import { ThemeProvider } from './context/ThemeContext';

function ApiMissingBanner() {
  const { isApiUrlMissing } = useBackendStatus();
  if (!isApiUrlMissing) return null;

  return (
    <div className="bg-enterprise-danger dark:bg-enterprise-dangerDark border-b border-danger-700 px-4 py-2.5 text-white font-mono text-xs flex items-center justify-between shadow-md" role="alert" aria-live="assertive">
      <div className="flex items-center space-x-2">
        <span className="font-bold uppercase tracking-wider">[CONFIG ERROR]</span>
        <span>Environment variable <code className="bg-black/30 px-1.5 py-0.5 rounded font-bold">VITE_API_BASE_URL</code> is not defined!</span>
      </div>
      <span className="text-[11px] opacity-90">Set VITE_API_BASE_URL in .env to connect to the PassiveGuard API backend.</span>
    </div>
  );
}

function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-enterprise-bg dark:bg-enterprise-bgDark text-enterprise-textPrimary dark:text-enterprise-textPrimaryDark font-sans selection:bg-enterprise-primary/20 selection:text-enterprise-primary">
      <ApiMissingBanner />
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-enterprise-bg dark:bg-enterprise-bgDark overflow-y-auto min-w-0">
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
    <ThemeProvider>
      <WebSocketProvider>
        <BackendStatusProvider>
          <Router>
            <MainLayout />
          </Router>
        </BackendStatusProvider>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

