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

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-8 bg-slate-950 overflow-y-auto">
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
