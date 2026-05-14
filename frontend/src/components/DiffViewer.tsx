import { X, Check, GitBranch, Copy, CheckCheck } from "lucide-react";
import { useState } from "react";

interface DiffViewerProps {
  diff: string;
  agentId: number;
  onClose: () => void;
  onApprove: () => void;
}

function parseDiff(diff: string) {
  const lines = diff.split("\n");
  const result: { type: string; content: string }[] = [];
  for (const line of lines) {
    if (line.startsWith("+")) {
      result.push({ type: "add", content: line });
    } else if (line.startsWith("-")) {
      result.push({ type: "del", content: line });
    } else if (line.startsWith("@@")) {
      result.push({ type: "chunk", content: line });
    } else {
      result.push({ type: "context", content: line });
    }
  }
  return result;
}

export function DiffViewer({ diff, agentId, onClose, onApprove }: DiffViewerProps) {
  const lines = parseDiff(diff);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-[fade-in-up_0.2s_ease-out]">
      <div className="glass-strong rounded-2xl border border-[hsl(220,12%,18%)] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(220,12%,18%)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[hsl(186,85%,52%)]/10 border border-[hsl(186,85%,52%)]/20 flex items-center justify-center">
              <GitBranch size={14} className="text-[hsl(186,85%,52%)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[hsl(210,20%,85%)]">
                agent/{agentId} <span className="text-[hsl(220,10%,35%)]">→</span> main
              </h3>
              <span className="text-[10px] text-[hsl(220,10%,45%)]">
                {lines.length} lines
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-[hsl(220,10%,45%)] hover:text-[hsl(210,20%,80%)] rounded-lg hover:bg-[hsl(220,14%,12%)] transition-all"
              title="Copy diff"
            >
              {copied ? <CheckCheck size={14} className="text-[hsl(145,65%,48%)]" /> : <Copy size={14} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[hsl(220,10%,45%)] hover:text-[hsl(210,20%,80%)] rounded-lg hover:bg-[hsl(220,14%,12%)] transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-0 font-mono text-xs leading-relaxed bg-[hsl(220,20%,3%)]">
          {lines.length === 0 || (lines.length === 1 && !lines[0].content) ? (
            <div className="text-[hsl(220,10%,35%)] italic text-center py-16">No changes to display</div>
          ) : (
            <div className="py-2">
              {lines.map((line, i) => {
                const baseClass = "px-4 py-[2px] whitespace-pre w-full";
                if (line.type === "add") {
                  return (
                    <div key={i} className={`${baseClass} bg-[hsl(145,50%,12%)]/30 text-[hsl(145,60%,55%)] border-l-2 border-[hsl(145,65%,48%)]/40`}>
                      {line.content}
                    </div>
                  );
                }
                if (line.type === "del") {
                  return (
                    <div key={i} className={`${baseClass} bg-[hsl(4,50%,12%)]/30 text-[hsl(4,70%,60%)] border-l-2 border-[hsl(4,80%,58%)]/40`}>
                      {line.content}
                    </div>
                  );
                }
                if (line.type === "chunk") {
                  return (
                    <div key={i} className={`${baseClass} text-[hsl(220,10%,50%)] bg-[hsl(220,14%,10%)]/50 mt-1 mb-1 font-bold border-y border-[hsl(220,12%,15%)] py-1`}>
                      {line.content}
                    </div>
                  );
                }
                return (
                  <div key={i} className={`${baseClass} text-[hsl(220,10%,55%)]`}>
                    {line.content || " "}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 px-5 py-4 border-t border-[hsl(220,12%,18%)]">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-[hsl(145,65%,48%)]/10 text-[hsl(145,65%,48%)] rounded-xl border border-[hsl(145,65%,48%)]/20 hover:bg-[hsl(145,65%,48%)]/15 hover:border-[hsl(145,65%,48%)]/30 transition-all"
          >
            <Check size={13} /> Approve & Merge
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs text-[hsl(220,10%,45%)] rounded-xl border border-[hsl(220,12%,18%)] hover:bg-[hsl(220,14%,12%)] hover:text-[hsl(210,20%,80%)] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
