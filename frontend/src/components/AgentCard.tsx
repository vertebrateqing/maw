import { Square, Check, X, FileText, Clock } from "lucide-react";
import type { Agent } from "@/types";

interface AgentCardProps {
  agent: Agent;
  onViewDiff: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onKill: (id: number) => void;
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const styles = {
    idle: "bg-gray-800 text-gray-400 border-gray-700",
    running: "bg-blue-950 text-blue-400 border-blue-800",
    pending_review: "bg-yellow-950 text-yellow-400 border-yellow-800",
    error: "bg-red-950 text-red-400 border-red-800",
  };
  const labels = {
    idle: "Idle",
    running: "Running",
    pending_review: "Review",
    error: "Error",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[status]}`}>
      {labels[status]}
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
  return (
    <div className={`bg-[#252526] rounded-lg border p-3 ${
      agent.status === "pending_review" ? "border-yellow-700" : "border-[#3c3c3c]"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-[#858585]">agent-{agent.id}</span>
          <StatusBadge status={agent.status} />
        </div>
        {agent.status === "running" && agent.started_at && (
          <div className="flex items-center gap-1 text-xs text-[#858585]">
            <Clock size={12} />
            {formatElapsed(agent.started_at)}
          </div>
        )}
      </div>

      <div className="text-sm text-[#d4d4d4] mb-2 truncate">
        {agent.task || "No task assigned"}
      </div>

      <div className="flex gap-2">
        {agent.status === "running" && (
          <button
            onClick={() => onKill(agent.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900 text-red-200 rounded hover:bg-red-800"
          >
            <Square size={12} /> Kill
          </button>
        )}
        {agent.status === "pending_review" && (
          <>
            <button
              onClick={() => onViewDiff(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] text-[#d4d4d4] rounded hover:bg-[#4c4c4c]"
            >
              <FileText size={12} /> Diff
            </button>
            <button
              onClick={() => onApprove(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-900 text-green-200 rounded hover:bg-green-800"
            >
              <Check size={12} /> Approve
            </button>
            <button
              onClick={() => onReject(agent.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900 text-red-200 rounded hover:bg-red-800"
            >
              <X size={12} /> Reject
            </button>
          </>
        )}
      </div>

      {agent.status === "idle" && (
        <div className="mt-2 pt-2 border-t border-[#3c3c3c] text-xs text-[#858585]">
          等待任务...
        </div>
      )}
    </div>
  );
}
