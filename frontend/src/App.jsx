import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import TrafficAnalytics from './pages/TrafficAnalytics';
import ModelPerformance from './pages/ModelPerformance';
import DemoSimulation from './pages/DemoSimulation';
import { createWebSocketConnection } from './services/api';

export default function App() {
  const [wsStatus, setWsStatus] = useState('connecting');

  useEffect(() => {
    const ws = createWebSocketConnection(
      () => {},
      (status) => setWsStatus(status)
    );
    return () => ws.close();
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#0F172A] font-sans selection:bg-[#2563EB]/15 selection:text-[#2563EB]">
        <Header wsStatus={wsStatus} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar wsStatus={wsStatus} />
          <main className="flex-1 p-6 lg:p-8 bg-[#F4F7FB] overflow-y-auto min-w-0">
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
    </Router>
  );
}
