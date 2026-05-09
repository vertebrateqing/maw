import { useEffect, useRef, useState } from "react";
import { X, Terminal, Radio } from "lucide-react";

interface LogViewerProps {
  agentId: number;
  onClose: () => void;
  onClearLog?: (agentId: number) => void;
}

export function LogViewer({ agentId, onClose, onClearLog }: LogViewerProps) {
  const [log, setLog] = useState("");
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLPreElement>(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    const eventSource = new EventSource(`/api/log-stream/${agentId}`);

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.chunk) {
          setLog((prev) => prev + data.chunk);
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => eventSource.close();
  }, [agentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && autoScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222222]"
        >
          <div className="flex items-center gap-2.5"
          >
            <Terminal size={14} className="text-[#00bcd4]" />
            <h3 className="text-sm font-mono font-bold text-[#d4d4d4]"
            >
              agent-{agentId} Log
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                connected
                  ? "text-[#4caf50] border-[#2e5c2e] bg-[#1a2f1a]"
                  : "text-[#ff9800] border-[#6b542e] bg-[#3d2e1a]"
              }`}
            >
              <Radio size={9} className={connected ? "animate-pulse" : ""} />
              {connected ? "live" : "reconnecting"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#555555] hover:text-[#d4d4d4] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Log Content */}
        <pre
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[#b0b0b0] bg-[#0a0a0a] min-h-[300px] max-h-[70vh] whitespace-pre-wrap break-words"
        >
          {log || (
            <span className="text-[#444444] italic">Waiting for log output...</span>
          )}
        </pre>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[#222222]"
        >
          <span className="text-[10px] text-[#555555] font-mono"
          >
            {log.length.toLocaleString()} chars
          </span>
          <div className="flex items-center gap-3">
            {onClearLog && (
              <button
                onClick={() => {
                  onClearLog(agentId);
                  setLog("");
                  autoScroll.current = true;
                }}
                className="text-[10px] font-mono text-[#ef5350] hover:text-[#f87171] transition-colors"
              >
                Clear Server Log
              </button>
            )}
            <button
              onClick={() => {
                setLog("");
                autoScroll.current = true;
              }}
              className="text-[10px] font-mono text-[#555555] hover:text-[#888888] transition-colors"
            >
              Clear Display
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
