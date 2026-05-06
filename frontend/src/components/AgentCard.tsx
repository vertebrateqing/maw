import { useState } from "react";
import { Square, Check, X, FileText, Clock, Terminal } from "lucide-react";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  onViewDiff: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onKill: (id: number) => void;
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

export function AgentCard({ agent, onViewDiff, onApprove, onReject, onKill }: AgentCardProps) {
  const [showFullTask, setShowFullTask] = useState(false);
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
      <div className="flex gap-2">
        {agent.status === "running" && (
          <button
            onClick={() => onKill(agent.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-[#3d1a1a] text-[#ef5350] rounded border border-[#6b2e2e] hover:bg-[#4d2020] transition-colors"
          >
            <Square size={10} /> Kill
          </button>
        )}
        {agent.status === "pending_review" && (
          <>
            <button
              onClick={() => onViewDiff(agent.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-[#1e1e1e] text-[#b0b0b0] rounded border border-[#333333] hover:bg-[#2a2a2a] transition-colors"
            >
              <FileText size={10} /> Diff
            </button>
            <button
              onClick={() => onApprove(agent.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-[#1a2f1a] text-[#4caf50] rounded border border-[#2e5c2e] hover:bg-[#203d20] transition-colors"
            >
              <Check size={10} /> Approve
            </button>
            <button
              onClick={() => onReject(agent.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-[#3d1a1a] text-[#ef5350] rounded border border-[#6b2e2e] hover:bg-[#4d2020] transition-colors"
            >
              <X size={10} /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
