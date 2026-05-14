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
      bg: "bg-[hsl(145,65%,48%)]/8",
      text: "text-[hsl(145,65%,48%)]",
      border: "border-[hsl(145,65%,48%)]/20",
      dot: "bg-[hsl(145,65%,48%)]",
      glow: "shadow-[0_0_8px_hsl(145,65%,48%,0.15)]",
      label: "IDLE",
    },
    running: {
      bg: "bg-[hsl(210,85%,60%)]/8",
      text: "text-[hsl(210,85%,60%)]",
      border: "border-[hsl(210,85%,60%)]/20",
      dot: "bg-[hsl(210,85%,60%)]",
      glow: "shadow-[0_0_12px_hsl(210,85%,60%,0.2)]",
      label: "RUNNING",
    },
    pending_review: {
      bg: "bg-[hsl(38,90%,58%)]/8",
      text: "text-[hsl(38,90%,58%)]",
      border: "border-[hsl(38,90%,58%)]/20",
      dot: "bg-[hsl(38,90%,58%)]",
      glow: "shadow-[0_0_12px_hsl(38,90%,58%,0.2)]",
      label: "REVIEW",
    },
    error: {
      bg: "bg-[hsl(4,80%,58%)]/8",
      text: "text-[hsl(4,80%,58%)]",
      border: "border-[hsl(4,80%,58%)]/20",
      dot: "bg-[hsl(4,80%,58%)]",
      glow: "shadow-[0_0_12px_hsl(4,80%,58%,0.2)]",
      label: "ERROR",
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-md border ${c.bg} ${c.text} ${c.border} ${status === "running" ? c.glow : ""}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot} ${status === "running" ? "animate-pulse" : ""}`} />
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

  const glowClass = {
    idle: "hover:glow-idle",
    running: "glow-running",
    pending_review: "glow-review",
    error: "glow-error",
  }[agent.status];

  const borderColor = {
    idle: "border-[hsl(220,12%,18%)]",
    running: "border-[hsl(210,85%,60%)]/25",
    pending_review: "border-[hsl(38,90%,58%)]/25",
    error: "border-[hsl(4,80%,58%)]/25",
  }[agent.status];

  return (
    <div
      className={`group relative glass rounded-xl border p-3.5 transition-all duration-300 hover:border-[hsl(220,12%,25%)] ${borderColor} ${glowClass}`}
    >
      {/* Status accent line */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full transition-all duration-300 ${
          agent.status === "idle"
            ? "bg-[hsl(145,65%,48%)]/40"
            : agent.status === "running"
            ? "bg-[hsl(210,85%,60%)]/50"
            : agent.status === "pending_review"
            ? "bg-[hsl(38,90%,58%)]/50"
            : "bg-[hsl(4,80%,58%)]/50"
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 pl-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Terminal size={12} className="text-[hsl(220,10%,45%)]" />
            <span className="text-xs font-bold text-[hsl(220,10%,45%)]">agent-{agent.id}</span>
          </div>
          <StatusBadge status={agent.status} />
        </div>
        {agent.status === "running" && agent.started_at && (
          <div className="flex items-center gap-1 text-[11px] text-[hsl(220,10%,45%)] shrink-0">
            <Clock size={10} className="opacity-70" />
            {formatElapsed(agent.started_at)}
          </div>
        )}
      </div>

      {/* Task */}
      <div className="mb-3.5 pl-2">
        <div
          className={`text-[13px] text-[hsl(210,20%,80%)] leading-relaxed transition-all ${
            showFullTask ? "" : "line-clamp-2"
          }`}
          style={{ cursor: agent.task && agent.task.length > 80 ? "pointer" : "default" }}
          onClick={() => {
            if (agent.task && agent.task.length > 80) {
              setShowFullTask(!showFullTask);
            }
          }}
        >
          {agent.task || (
            <span className="text-[hsl(220,10%,35%)] italic">等待任务...</span>
          )}
        </div>
        {agent.task && agent.task.length > 80 && (
          <button
            onClick={() => setShowFullTask(!showFullTask)}
            className="text-[10px] text-[hsl(220,10%,45%)] hover:text-[hsl(186,85%,52%)] mt-1.5 transition-colors"
          >
            {showFullTask ? "收起" : "展开"}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-wrap pl-2">
        <ActionButton
          onClick={() => onViewLog(agent.id)}
          icon={<ScrollText size={11} />}
          label="Log"
          variant="secondary"
        />
        {agent.status === "running" && (
          <ActionButton
            onClick={() => onKill(agent.id)}
            icon={<Square size={11} />}
            label="Kill"
            variant="danger"
          />
        )}
        {agent.status === "pending_review" && (
          <>
            <ActionButton
              onClick={() => onViewDiff(agent.id)}
              icon={<FileText size={11} />}
              label="Diff"
              variant="ghost"
            />
            <ActionButton
              onClick={() => onApprove(agent.id)}
              icon={<Check size={11} />}
              label="Approve"
              variant="success"
            />
          </>
        )}
      </div>

      {/* Continue Task Input */}
      {isReview && onContinue && (
        <div className="flex gap-2 mt-3 pl-2 pt-3 border-t border-[hsl(220,12%,18%)]">
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
            className="flex-1 min-w-0 px-3 py-1.5 text-[11px] bg-[hsl(220,18%,4%)] text-[hsl(210,20%,80%)] rounded-lg border border-[hsl(220,12%,18%)] placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-[hsl(186,85%,52%)]/50 focus:ring-1 focus:ring-[hsl(186,85%,52%)]/10 transition-all"
          />
          <button
            onClick={() => {
              if (continueText.trim()) {
                onContinue(agent.id, continueText.trim());
                setContinueText("");
              }
            }}
            disabled={!continueText.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[hsl(210,85%,60%)]/10 text-[hsl(210,85%,60%)] rounded-lg border border-[hsl(210,85%,60%)]/20 hover:bg-[hsl(210,85%,60%)]/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={10} /> 继续
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: "secondary" | "danger" | "success" | "ghost";
}) {
  const variants = {
    secondary: "bg-[hsl(210,85%,60%)]/8 text-[hsl(210,85%,60%)] border-[hsl(210,85%,60%)]/15 hover:bg-[hsl(210,85%,60%)]/12 hover:border-[hsl(210,85%,60%)]/25",
    danger: "bg-[hsl(4,80%,58%)]/8 text-[hsl(4,80%,58%)] border-[hsl(4,80%,58%)]/15 hover:bg-[hsl(4,80%,58%)]/12 hover:border-[hsl(4,80%,58%)]/25",
    success: "bg-[hsl(145,65%,48%)]/8 text-[hsl(145,65%,48%)] border-[hsl(145,65%,48%)]/15 hover:bg-[hsl(145,65%,48%)]/12 hover:border-[hsl(145,65%,48%)]/25",
    ghost: "bg-[hsl(220,14%,12%)] text-[hsl(220,10%,55%)] border-[hsl(220,12%,18%)] hover:bg-[hsl(220,14%,16%)] hover:text-[hsl(210,20%,80%)]",
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all duration-200 min-h-[28px] touch-manipulation ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
