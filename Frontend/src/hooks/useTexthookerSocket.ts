import { useCallback, useEffect, useRef, useState } from 'react';

export type TexthookerSocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

const RECONNECT_INTERVAL_MS = 3000;

export default function useTexthookerSocket({
  url,
  disabled,
  continuousReconnect,
  onMessage,
}: {
  url: string;
  disabled: boolean;
  continuousReconnect: boolean;
  onMessage: (event: MessageEvent) => void;
}) {
  const [status, setStatus] = useState<TexthookerSocketStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const isManualDisconnectRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const inactive = disabled || !url.trim();

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearReconnect = useCallback(() => {
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (inactive) return;
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    isManualDisconnectRef.current = false;
    setStatus('connecting');
    try {
      const socket = new WebSocket(url.trim());
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        setStatus('connected');
        clearReconnect();
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        setStatus('disconnected');
        socketRef.current = null;
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        setStatus('error');
        socketRef.current = null;
      };

      socket.onmessage = (event) => onMessageRef.current(event);
    } catch (error) {
      console.error('WebSocket error:', error);
      setStatus('error');
    }
  }, [url, inactive, clearReconnect]);

  const disconnect = useCallback(
    (isManual = false) => {
      if (isManual) {
        isManualDisconnectRef.current = true;
      }
      clearReconnect();

      const activeSocket = socketRef.current;
      socketRef.current = null;
      setStatus('disconnected');

      if (!activeSocket) return;

      activeSocket.onopen = null;
      activeSocket.onclose = null;
      activeSocket.onerror = null;
      activeSocket.onmessage = null;

      if (
        activeSocket.readyState === WebSocket.OPEN ||
        activeSocket.readyState === WebSocket.CONNECTING
      ) {
        activeSocket.close();
      }
    },
    [clearReconnect]
  );

  const startReconnect = useCallback(() => {
    if (reconnectIntervalRef.current) return;
    reconnectIntervalRef.current = setInterval(() => {
      if (
        !socketRef.current ||
        socketRef.current.readyState === WebSocket.CLOSED
      ) {
        connect();
      }
    }, RECONNECT_INTERVAL_MS);
  }, [connect]);

  const toggle = useCallback(() => {
    const activeSocket = socketRef.current;
    if (
      activeSocket?.readyState === WebSocket.OPEN ||
      activeSocket?.readyState === WebSocket.CONNECTING
    ) {
      disconnect(true);
      return;
    }

    connect();
    if (continuousReconnect && !inactive) {
      startReconnect();
    }
  }, [connect, continuousReconnect, disconnect, inactive, startReconnect]);

  useEffect(() => {
    if (inactive) disconnect();
  }, [inactive, disconnect]);

  useEffect(() => {
    if (
      !inactive &&
      continuousReconnect &&
      !isManualDisconnectRef.current &&
      status !== 'connected' &&
      status !== 'connecting'
    ) {
      startReconnect();
    } else if (inactive || !continuousReconnect) {
      clearReconnect();
    }
  }, [continuousReconnect, status, inactive, startReconnect, clearReconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { status, connect, disconnect, toggle, inactive };
}
