import { X } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  agentId: number;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
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

export function DiffViewer({ diff, agentId, onClose, onApprove, onReject }: DiffViewerProps) {
  const lines = parseDiff(diff);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-mono text-[#d4d4d4]">Diff: agent/{agentId} → main</h3>
          <button onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 font-mono text-sm">
          {lines.map((line, i) => {
            const baseClass = "px-2 py-0.5 whitespace-pre";
            if (line.type === "add") {
              return (
                <div key={i} className={`${baseClass} bg-[#0d3b2e] text-[#4ec9b0]`}>
                  {line.content}
                </div>
              );
            }
            if (line.type === "del") {
              return (
                <div key={i} className={`${baseClass} bg-[#3b0d0d] text-[#f48771]`}>
                  {line.content}
                </div>
              );
            }
            if (line.type === "chunk") {
              return (
                <div key={i} className={`${baseClass} text-[#858585] bg-[#1e1e1e] mt-2`}>
                  {line.content}
                </div>
              );
            }
            return (
              <div key={i} className={`${baseClass} text-[#d4d4d4]`}>
                {line.content || " "}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 px-4 py-3 border-t border-[#3c3c3c]">
          <button
            onClick={() => { onApprove(); onClose(); }}
            className="px-4 py-2 text-sm bg-green-900 text-green-200 rounded hover:bg-green-800"
          >
            Approve & Merge
          </button>
          <button
            onClick={() => { onReject(); onClose(); }}
            className="px-4 py-2 text-sm bg-red-900 text-red-200 rounded hover:bg-red-800"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#3c3c3c] text-[#d4d4d4] rounded hover:bg-[#4c4c4c]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
