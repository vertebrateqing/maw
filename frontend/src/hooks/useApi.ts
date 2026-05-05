import { useState, useEffect, useCallback } from "react";
import type { MawState, DiffResponse, LogResponse, Message } from "@/types";

const API_BASE = "/api";

export function useApi() {
  const [state, setState] = useState<MawState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setState(data);
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      setError("Connection lost");
    };
    return () => eventSource.close();
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
    await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }, []);

  const updateMessage = useCallback(async (id: string, content: string): Promise<void> => {
    await fetch(`${API_BASE}/messages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }, []);

  const deleteMessage = useCallback(async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/messages/${id}`, { method: "DELETE" });
  }, []);

  const updateAgentConfig = useCallback(async (agentId: number, key: string, value: boolean): Promise<void> => {
    await fetch(`${API_BASE}/agents/${agentId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }, []);

  return { state, error, fetchDiff, fetchLog, approve, reject, kill, fetchMessages, addMessage, updateMessage, deleteMessage, updateAgentConfig };
}
