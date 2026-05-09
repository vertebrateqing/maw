import { useState } from "react";
import { Square, Check, FileText, Clock, Terminal, ScrollText, Send } from "lucide-react";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  onViewDiff: (id: number) => void;
  onViewLog: (id: number) => void;
  onApprove: (id: number) => void;
  onKill: (id: number) => void;
  onContinue?: (id: number, task: string) => void;
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const config = {
    idle: {
      bg: "bg-[#1a2f1a]",
      text: "text-[#4caf50]",
      border: "border-[#2e5c2e]",
      dot: "bg-[#4caf50]",
      label: "IDLE",
    },
    running: {
      bg: "bg-[#1a2744]",
      text: "text-[#64b5f6]",
      border: "border-[#2a4a7a]",
      dot: "bg-[#64b5f6] animate-pulse",
      label: "RUNNING",
    },
    pending_review: {
      bg: "bg-[#3d2e1a]",
      text: "text-[#ffb74d]",
      border: "border-[#6b542e]",
      dot: "bg-[#ffb74d]",
      label: "REVIEW",
    },
    error: {
      bg: "bg-[#3d1a1a]",
      text: "text-[#ef5350]",
      border: "border-[#6b2e2e]",
      dot: "bg-[#ef5350]",
      label: "ERROR",
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function formatElapsed(startedAt: string | null) {
  if (!startedAt) return "--:--";
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AgentCard({ agent, onViewDiff, onViewLog, onApprove, onKill, onContinue }: AgentCardProps) {
  const [showFullTask, setShowFullTask] = useState(false);
  const [continueText, setContinueText] = useState("");
  const isReview = agent.status === "pending_review";

  return (
    <div
      className={`bg-[#141414] rounded-lg border p-3 transition-all duration-200 hover:border-[#444444] ${
        isReview ? "border-[#6b542e]" : "border-[#222222]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-[#555555]" />
            <span className="text-xs font-mono font-bold text-[#888888]">agent-{agent.id}</span>
          </div>
          <StatusBadge status={agent.status} />
        </div>
        {agent.status === "running" && agent.started_at && (
          <div className="flex items-center gap-1 text-xs text-[#555555] font-mono">
            <Clock size={11} />
            {formatElapsed(agent.started_at)}
          </div>
        )}
      </div>

      {/* Task */}
      <div className="mb-3">
        <div
          className={`text-sm text-[#b0b0b0] font-mono leading-relaxed ${
            showFullTask ? "" : "line-clamp-2"
          }`}
          onClick={() => setShowFullTask(!showFullTask)}
          style={{ cursor: agent.task && agent.task.length > 60 ? "pointer" : "default" }}
        >
          {agent.task || (
            <span className="text-[#555555] italic">等待任务...</span>
          )}
        </div>
        {agent.task && agent.task.length > 60 && (
          <button
            onClick={() => setShowFullTask(!showFullTask)}
            className="text-[10px] text-[#555555] hover:text-[#888888] mt-1 font-mono"
          >
            {showFullTask ? "收起" : "展开"}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onViewLog(agent.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#1a1a2e] text-[#64b5f6] rounded border border-[#2a2a5a] hover:bg-[#202040] transition-colors min-h-[28px] touch-manipulation"
        >
          <ScrollText size={12} /> Log
        </button>
        {agent.status === "running" && (
          <button
            onClick={() => onKill(agent.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#3d1a1a] text-[#ef5350] rounded border border-[#6b2e2e] hover:bg-[#4d2020] transition-colors min-h-[28px] touch-manipulation"
          >
            <Square size={12} /> Kill
          </button>
        )}
        {agent.status === "pending_review" && (
          <>
            <button
              onClick={() => onViewDiff(agent.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#1e1e1e] text-[#b0b0b0] rounded border border-[#333333] hover:bg-[#2a2a2a] transition-colors min-h-[28px] touch-manipulation"
            >
              <FileText size={12} /> Diff
            </button>
            <button
              onClick={() => onApprove(agent.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#1a2f1a] text-[#4caf50] rounded border border-[#2e5c2e] hover:bg-[#203d20] transition-colors min-h-[28px] touch-manipulation"
            >
              <Check size={12} /> Approve
            </button>
          </>
        )}
      </div>

      {/* Continue Task Input */}
      {isReview && onContinue && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={continueText}
            onChange={(e) => setContinueText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && continueText.trim()) {
                onContinue(agent.id, continueText.trim());
                setContinueText("");
              }
            }}
            placeholder="输入修改要求..."
            className="flex-1 min-w-0 px-2.5 py-1 text-[11px] font-mono bg-[#0a0a0a] text-[#b0b0b0] rounded border border-[#333333] placeholder:text-[#555555] focus:outline-none focus:border-[#00bcd4] transition-colors"
          />
          <button
            onClick={() => {
              if (continueText.trim()) {
                onContinue(agent.id, continueText.trim());
                setContinueText("");
              }
            }}
            disabled={!continueText.trim()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-[#1a2744] text-[#64b5f6] rounded border border-[#2a4a7a] hover:bg-[#202d50] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={10} /> 继续
          </button>
        </div>
      )}
    </div>
  );
}
