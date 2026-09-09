import axios from 'axios';

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  console.error('[API Configuration Error] VITE_API_BASE_URL environment variable is not defined!');
  return '';
};

export const API_BASE_URL = getApiBaseUrl();
export const IS_API_URL_MISSING = !API_BASE_URL;

export const getWebSocketUrl = (baseUrl = API_BASE_URL) => {
  if (!baseUrl) return '';
  const cleanUrl = baseUrl.replace(/\/$/, '');
  if (cleanUrl.startsWith('https://')) {
    return cleanUrl.replace(/^https:\/\//, 'wss://') + '/ws';
  }
  if (cleanUrl.startsWith('http://')) {
    return cleanUrl.replace(/^http:\/\//, 'ws://') + '/ws';
  }
  if (cleanUrl.startsWith('wss://') || cleanUrl.startsWith('ws://')) {
    return cleanUrl.endsWith('/ws') ? cleanUrl : `${cleanUrl}/ws`;
  }
  return `wss://${cleanUrl}/ws`;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const fetchHealth = async () => {
  if (IS_API_URL_MISSING) {
    return { status: 'offline', mode: 'passive_read_only', app_name: 'PassiveGuard AI', error: 'VITE_API_BASE_URL is not set' };
  }
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    return { status: 'offline', mode: 'passive_read_only', app_name: 'PassiveGuard AI' };
  }
};

export const fetchAlerts = async (severity = null, limit = 100) => {
  if (IS_API_URL_MISSING) return [];
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
  if (IS_API_URL_MISSING) {
    return {
      active_flows: 0,
      total_packets_sec: 0.0,
      total_bytes_sec: 0.0,
      bandwidth_mbps: 0.0,
      protocol_distribution: { TCP: 0, UDP: 0, ICMP: 0, OTHER: 0 }
    };
  }
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
  if (IS_API_URL_MISSING) return [];
  try {
    const response = await apiClient.get('/api/traffic/historical');
    return response.data;
  } catch (error) {
    return [];
  }
};

export const fetchModels = async () => {
  if (IS_API_URL_MISSING) return [];
  try {
    const response = await apiClient.get('/api/models');
    return response.data;
  } catch (error) {
    return [];
  }
};

export const fetchDemoScenarios = async () => {
  if (IS_API_URL_MISSING) return { scenarios: [], passive_safety_notice: {} };
  try {
    const response = await apiClient.get('/api/demo/scenarios');
    return response.data;
  } catch (error) {
    return { scenarios: [], passive_safety_notice: {} };
  }
};

export const fetchDemoStatus = async () => {
  if (IS_API_URL_MISSING) return { is_running: false, current_scenario: null, last_run: null };
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
  }, { timeout: 60000 });
  return response.data;
};

export const resetDemoState = async () => {
  const response = await apiClient.post('/api/demo/reset', {}, { timeout: 30000 });
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
  return `${bitsPerSec.toFixed(0)} bps`;
};

export const formatIndianTime = (timestamp = new Date()) => {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
};

export const formatIndianDateTime = (timestamp = new Date()) => {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST';
};

export const createWebSocketConnection = (onMessage, onStatusChange) => {
  const wsUrl = getWebSocketUrl(API_BASE_URL);
  if (!wsUrl) {
    if (onStatusChange) onStatusChange('offline');
    return { close: () => {} };
  }

  let ws = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
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

      ws.onerror = (err) => {
        console.warn('WebSocket connection error:', wsUrl, err);
        if (onStatusChange) onStatusChange('error');
      };

      ws.onclose = () => {
        if (onStatusChange) onStatusChange('reconnecting');
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      console.error('WebSocket initialization error:', e);
      if (onStatusChange) onStatusChange('error');
    }
  };

  connect();

  return {
    close: () => {
      isClosed = true;
      if (ws) ws.close();
    }
  };
};
