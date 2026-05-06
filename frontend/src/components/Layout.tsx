import { useState, useRef, useEffect } from "react";
import { AgentCard } from "./AgentCard";
import { DiffViewer } from "./DiffViewer";
import { MessageInput } from "./MessageInput";
import { MessageQueue } from "./MessageQueue";
import { useApi } from "@/hooks/useApi";

export function Layout() {
  const { state, error, connected, fetchDiff, approve, reject, kill, addMessage, updateMessage, deleteMessage } = useApi();
  const [diffData, setDiffData] = useState<{ id: number; text: string } | null>(null);
  const agentsScrollRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Preserve scroll positions across re-renders
  const agentsScrollPos = useRef(0);
  const messagesScrollPos = useRef(0);

  useEffect(() => {
    if (agentsScrollRef.current) {
      agentsScrollRef.current.scrollTop = agentsScrollPos.current;
    }
  });

  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollPos.current;
    }
  });

  const handleAgentsScroll = () => {
    agentsScrollPos.current = agentsScrollRef.current?.scrollTop || 0;
  };

  const handleMessagesScroll = () => {
    messagesScrollPos.current = messagesScrollRef.current?.scrollTop || 0;
  };

  const handleViewDiff = async (id: number) => {
    const text = await fetchDiff(id);
    setDiffData({ id, text });
  };

  const runningCount = state?.agents?.filter((a) => a.status === "running").length || 0;
  const reviewCount = state?.agents?.filter((a) => a.status === "pending_review").length || 0;
  const idleCount = state?.agents?.filter((a) => a.status === "idle").length || 0;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-[#d4d4d4] overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#111111] border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider text-[#00bcd4] font-mono">MAW</span>
          {state?.cwd && (
            <span
              className="text-xs text-[#666666] font-mono truncate max-w-[280px]"
              title={state.cwd}
            >
              {state.cwd}
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 text-xs font-mono ${
              connected ? "text-[#4caf50]" : "text-[#ff9800]"
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-[#4caf50]" : "bg-[#ff9800] animate-pulse"}`} />
            {connected ? "online" : error || "reconnecting"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">agents</span>
            <span className="text-[#d4d4d4] font-bold">{state?.agents?.length || 0}</span>
          </div>
          <div className="w-px h-3 bg-[#333333]" />
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2196f3]" />
            <span className="text-[#888888]">running</span>
            <span className="text-[#2196f3] font-bold">{runningCount}</span>
          </div>
          <div className="w-px h-3 bg-[#333333]" />
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff9800]" />
            <span className="text-[#888888]">review</span>
            <span className="text-[#ff9800] font-bold">{reviewCount}</span>
          </div>
          <div className="w-px h-3 bg-[#333333]" />
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4caf50]" />
            <span className="text-[#888888]">idle</span>
            <span className="text-[#4caf50] font-bold">{idleCount}</span>
          </div>
          <div className="w-px h-3 bg-[#333333]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">queued</span>
            <span className="text-[#d4d4d4] font-bold">{state?.pending_messages?.length || 0}</span>
          </div>
        </div>
      </header>

      {/* Task Input */}
      <MessageInput onSubmit={addMessage} />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Agents Panel */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[#222222]">
          <div className="shrink-0 px-4 py-2 border-b border-[#222222]">
            <h2 className="text-xs font-bold text-[#666666] uppercase tracking-wider font-mono">
              Agents ({state?.agents?.length || 0})
            </h2>
          </div>
          <div
            ref={agentsScrollRef}
            onScroll={handleAgentsScroll}
            className="flex-1 min-h-0 overflow-y-auto p-4"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {state?.agents?.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onViewDiff={handleViewDiff}
                  onApprove={approve}
                  onReject={reject}
                  onKill={kill}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Message Queue */}
        <div className="w-96 shrink-0 flex flex-col bg-[#0e0e0e]">
          <div className="shrink-0 px-4 py-2 border-b border-[#222222]">
            <h2 className="text-xs font-bold text-[#666666] uppercase tracking-wider font-mono">
              Message Queue ({state?.pending_messages?.length || 0})
            </h2>
          </div>
          <div
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
            className="flex-1 min-h-0 overflow-y-auto p-4"
          >
            <MessageQueue
              messages={state?.pending_messages || []}
              onUpdate={updateMessage}
              onDelete={deleteMessage}
            />
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      {diffData && (
        <DiffViewer
          diff={diffData.text}
          agentId={diffData.id}
          onClose={() => setDiffData(null)}
          onApprove={() => approve(diffData.id)}
          onReject={() => reject(diffData.id)}
        />
      )}
    </div>
  );
}
