import { X, Check, GitBranch } from "lucide-react";

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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-xl border border-[#2a2a2a] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222222]">
          <div className="flex items-center gap-2.5">
            <GitBranch size={14} className="text-[#00bcd4]" />
            <h3 className="text-sm font-mono font-bold text-[#d4d4d4]">
              agent/{agentId} <span className="text-[#555555]">&rarr;</span> main
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#555555] hover:text-[#d4d4d4] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {lines.length === 0 || (lines.length === 1 && !lines[0].content) ? (
            <div className="text-[#555555] italic text-center py-8">No changes to display</div>
          ) : (
            lines.map((line, i) => {
              const baseClass = "px-3 py-0.5 whitespace-pre rounded-sm w-max min-w-full";
              if (line.type === "add") {
                return (
                  <div key={i} className={`${baseClass} bg-[#0d2818] text-[#4ade80]`}>
                    {line.content}
                  </div>
                );
              }
              if (line.type === "del") {
                return (
                  <div key={i} className={`${baseClass} bg-[#2a0a0a] text-[#f87171]`}>
                    {line.content}
                  </div>
                );
              }
              if (line.type === "chunk") {
                return (
                  <div key={i} className={`${baseClass} text-[#888888] bg-[#1a1a1a] mt-1 mb-1 font-bold`}>
                    {line.content}
                  </div>
                );
              }
              return (
                <div key={i} className={`${baseClass} text-[#a0a0a0]`}>
                  {line.content || " "}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 px-5 py-3.5 border-t border-[#222222]">
          <button
            onClick={() => { onApprove(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold bg-[#1a2f1a] text-[#4caf50] rounded-lg border border-[#2e5c2e] hover:bg-[#203d20] transition-colors"
          >
            <Check size={12} /> Approve & Merge
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono text-[#888888] rounded-lg border border-[#333333] hover:bg-[#1a1a1a] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
