import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

export const fetchHealth = async () => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    return { status: 'offline', mode: 'passive_read_only', app_name: 'PassiveGuard AI' };
  }
};

export const fetchAlerts = async (severity = null, limit = 100) => {
  try {
    const params = { limit };
    if (severity && severity !== 'ALL') params.severity = severity;
    const response = await apiClient.get('/api/alerts', { params });
    return response.data;
  } catch (error) {
    console.warn('API error fetching alerts:', error.message);
    return [];
  }
};

export const fetchAlertById = async (alertId) => {
  const response = await apiClient.get(`/api/alerts/${alertId}`);
  return response.data;
};

export const fetchCurrentTraffic = async () => {
  try {
    const response = await apiClient.get('/api/traffic/current');
    return response.data;
  } catch (error) {
    return {
      active_flows: 0,
      total_packets_sec: 0.0,
      total_bytes_sec: 0.0,
      bandwidth_mbps: 0.0,
      protocol_distribution: { TCP: 0, UDP: 0, ICMP: 0, OTHER: 0 }
    };
  }
};

export const fetchHistoricalTraffic = async () => {
  try {
    const response = await apiClient.get('/api/traffic/historical');
    return response.data;
  } catch (error) {
    return [];
  }
};

export const fetchModels = async () => {
  try {
    const response = await apiClient.get('/api/models');
    return response.data;
  } catch (error) {
    return [];
  }
};

export const fetchDemoScenarios = async () => {
  try {
    const response = await apiClient.get('/api/demo/scenarios');
    return response.data;
  } catch (error) {
    return { scenarios: [], passive_safety_notice: {} };
  }
};

export const fetchDemoStatus = async () => {
  try {
    const response = await apiClient.get('/api/demo/status');
    return response.data;
  } catch (error) {
    return { is_running: false, current_scenario: null, last_run: null };
  }
};

export const runDemoScenario = async (scenario = 'mixed', resetState = false, delay = 0.0) => {
  const response = await apiClient.post('/api/demo/run', {
    scenario,
    reset_state: resetState,
    delay
  }, { timeout: 30000 });
  return response.data;
};

export const resetDemoState = async () => {
  const response = await apiClient.post('/api/demo/reset');
  return response.data;
};

export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatThroughput = (bytesPerSec) => {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec >= 1_000_000_000) return `${(bitsPerSec / 1_000_000_000).toFixed(2)} Gbps`;
  if (bitsPerSec >= 1_000_000) return `${(bitsPerSec / 1_000_000).toFixed(2)} Mbps`;
  if (bitsPerSec >= 1_000) return `${(bitsPerSec / 1_000).toFixed(2)} Kbps`;
  return `${bitsPerSec.toFixed(0)} bps`;
};

export const createWebSocketConnection = (onMessage, onStatusChange) => {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
  let ws = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (onStatusChange) onStatusChange('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = () => {
      if (onStatusChange) onStatusChange('error');
    };

    ws.onclose = () => {
      if (onStatusChange) onStatusChange('reconnecting');
      if (!isClosed) {
        setTimeout(connect, 3000);
      }
    };
  };

  connect();

  return {
    close: () => {
      isClosed = true;
      if (ws) ws.close();
    }
  };
};
