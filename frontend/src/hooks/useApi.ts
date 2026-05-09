import { useState, useEffect, useCallback, useRef } from "react";
import type { MawState, DiffResponse, LogResponse, Message } from "@/types";

const API_BASE = "/api";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useApi() {
  const [state, setState] = useState<MawState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const stateRef = useRef<MawState | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`${API_BASE}/events`);

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as MawState;
          if (!deepEqual(data, stateRef.current)) {
            stateRef.current = data;
            setState(data);
          }
          setConnected(true);
          setError(null);
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        setError("Reconnecting...");
        eventSource?.close();
        eventSource = null;
        // Auto-reconnect after 2s
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, []);

  const fetchDiff = useCallback(async (agentId: number): Promise<string> => {
    const res = await fetch(`${API_BASE}/diff/${agentId}`);
    const data: DiffResponse = await res.json();
    return data.diff;
  }, []);

  const fetchLog = useCallback(async (agentId: number): Promise<string> => {
    const res = await fetch(`${API_BASE}/log/${agentId}`);
    const data: LogResponse = await res.json();
    return data.log;
  }, []);

  const clearLog = useCallback(async (agentId: number): Promise<void> => {
    await fetch(`${API_BASE}/log-clear/${agentId}`, { method: "DELETE" });
  }, []);

  const approve = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/approve/${agentId}`, { method: "POST" });
  }, []);

  const reject = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/reject/${agentId}`, { method: "POST" });
  }, []);

  const kill = useCallback(async (agentId: number) => {
    await fetch(`${API_BASE}/kill/${agentId}`, { method: "POST" });
  }, []);

  const fetchMessages = useCallback(async (): Promise<Message[]> => {
    const res = await fetch(`${API_BASE}/messages`);
    return res.json();
  }, []);

  const addMessage = useCallback(async (content: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    // Optimistically update local state
    setState((prev) => {
      if (!prev) return prev;
      const msg: Message = {
        id: `pending-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
        priority: 0,
      };
      return {
        ...prev,
        pending_messages: [...prev.pending_messages, msg],
      };
    });
  }, []);

  const updateMessage = useCallback(async (id: string, content: string): Promise<void> => {
    await fetch(`${API_BASE}/messages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pending_messages: prev.pending_messages.map((m) =>
          m.id === id ? { ...m, content } : m
        ),
      };
    });
  }, []);

  const deleteMessage = useCallback(async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/messages/${id}`, { method: "DELETE" });
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pending_messages: prev.pending_messages.filter((m) => m.id !== id),
      };
    });
  }, []);

  const updateAgentConfig = useCallback(async (agentId: number, key: string, value: boolean): Promise<void> => {
    await fetch(`${API_BASE}/agents/${agentId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }, []);

  return {
    state,
    error,
    connected,
    fetchDiff,
    fetchLog,
    clearLog,
    approve,
    reject,
    kill,
    fetchMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    updateAgentConfig,
  };
}
