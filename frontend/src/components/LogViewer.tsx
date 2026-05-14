import { useEffect, useRef, useState } from "react";
import { X, Terminal, Radio, Trash2 } from "lucide-react";

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-[fade-in-up_0.2s_ease-out]">
      <div className="glass-strong rounded-2xl border border-[hsl(220,12%,18%)] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(220,12%,18%)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[hsl(186,85%,52%)]/10 border border-[hsl(186,85%,52%)]/20 flex items-center justify-center">
              <Terminal size={14} className="text-[hsl(186,85%,52%)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[hsl(210,20%,85%)]">
                agent-{agentId} Log
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                connected
                  ? "text-[hsl(145,65%,48%)] border-[hsl(145,65%,48%)]/20 bg-[hsl(145,65%,48%)]/8"
                  : "text-[hsl(38,90%,58%)] border-[hsl(38,90%,58%)]/20 bg-[hsl(38,90%,58%)]/8"
              }`}
            >
              <Radio size={9} className={connected ? "animate-pulse" : ""} />
              {connected ? "live" : "reconnecting"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[hsl(220,10%,45%)] hover:text-[hsl(210,20%,80%)] rounded-lg hover:bg-[hsl(220,14%,12%)] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Log Content */}
        <pre
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[hsl(220,10%,60%)] bg-[hsl(220,20%,3%)] min-h-[300px] max-h-[70vh] whitespace-pre-wrap break-words"
        >
          {log || (
            <span className="text-[hsl(220,10%,35%)] italic">Waiting for log output...</span>
          )}
        </pre>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(220,12%,18%)]">
          <span className="text-[10px] text-[hsl(220,10%,45%)]">
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
                className="text-[10px] font-medium text-[hsl(4,80%,58%)]/80 hover:text-[hsl(4,80%,58%)] transition-colors flex items-center gap-1"
              >
                <Trash2 size={9} />
                Clear Server Log
              </button>
            )}
            <button
              onClick={() => {
                setLog("");
                autoScroll.current = true;
              }}
              className="text-[10px] font-medium text-[hsl(220,10%,45%)] hover:text-[hsl(210,20%,70%)] transition-colors"
            >
              Clear Display
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
