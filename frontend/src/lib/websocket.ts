'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

type MessageHandler = (data: any) => void;

export function useWebSocket(url: string, onMessage?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
        
        // Call global onMessage handler
        if (onMessage) {
          onMessage(message.data);
        }
        
        // Call type-specific handlers
        const handlers = handlersRef.current.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      wsRef.current = null;
      
      // Reconnect after 3 seconds
      setTimeout(() => reconnectRef.current?.(), 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [url, onMessage]);

  useEffect(() => {
    reconnectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
  };
}

// Hook specifically for dashboard stats
export function useDashboardStats() {
  const [stats, setStats] = useState<unknown>(null);
  
  // Use API URL for WebSocket connection (same host as backend, not Next.js dev server)
  const wsUrl = typeof window !== 'undefined'
    ? `ws://${process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') || 'localhost:5000'}/ws`
    : '';

  const { isConnected: connected } = useWebSocket(wsUrl, (data) => {
    setStats(data as any);
  });

  return { stats, isConnected: connected };
}
