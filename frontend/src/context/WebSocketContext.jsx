import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createWebSocketConnection, API_BASE_URL } from '../services/api';

const WebSocketContext = createContext({
  wsStatus: 'connecting',
  subscribe: () => () => {},
});

export const WebSocketProvider = ({ children }) => {
  const [wsStatus, setWsStatus] = useState('connecting');
  const listenersRef = useRef(new Set());

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    // Single shared WebSocket connection instance for the entire application
    const connection = createWebSocketConnection(
      (data) => {
        listenersRef.current.forEach((listener) => {
          try {
            listener(data);
          } catch (err) {
            console.error('Error in WebSocket listener:', err);
          }
        });
      },
      (status) => {
        setWsStatus(status);
      }
    );

    return () => {
      connection.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ wsStatus, subscribe, isConfigured: Boolean(API_BASE_URL) }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
