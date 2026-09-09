import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchHealth, IS_API_URL_MISSING } from '../services/api';
import { useWebSocket } from './WebSocketContext';

const BackendStatusContext = createContext({
  healthStatus: 'healthy',
  wsStatus: 'connecting',
  isApiUrlMissing: false,
  checkHealthNow: () => {},
});

export const BackendStatusProvider = ({ children }) => {
  const { wsStatus } = useWebSocket();
  const [healthStatus, setHealthStatus] = useState('healthy');

  const checkHealth = async () => {
    if (IS_API_URL_MISSING) {
      setHealthStatus('offline');
      return;
    }
    try {
      const data = await fetchHealth();
      if (data && data.status === 'healthy') {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('degraded');
      }
    } catch {
      setHealthStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BackendStatusContext.Provider
      value={{
        healthStatus,
        wsStatus,
        isApiUrlMissing: IS_API_URL_MISSING,
        checkHealthNow: checkHealth,
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
};

export const useBackendStatus = () => useContext(BackendStatusContext);
