import { useState } from "react";
import { Trash2, Edit2, Check, X, MessageSquare } from "lucide-react";
import type { Message } from "@/types";

interface MessageQueueProps {
  messages: Message[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function MessageQueue({ messages, onUpdate, onDelete }: MessageQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = (id: string) => {
    onUpdate(id, editContent);
    setEditingId(null);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[hsl(220,10%,35%)]">
        <div className="w-12 h-12 rounded-xl bg-[hsl(220,14%,12%)] border border-[hsl(220,12%,18%)] flex items-center justify-center mb-3">
          <MessageSquare size={18} className="opacity-40" />
        </div>
        <span className="text-xs">暂无待处理任务</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className={`relative glass rounded-xl border p-3 transition-all duration-200 ${
            hoveredId === msg.id ? "border-[hsl(220,12%,25%)]" : "border-[hsl(220,12%,18%)]"
          }`}
          style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
          onMouseEnter={() => setHoveredId(msg.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Priority indicator */}
          <div
            className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full transition-all duration-200 ${
              hoveredId === msg.id ? "bg-[hsl(186,85%,52%)]/40" : "bg-[hsl(220,12%,18%)]"
            }`}
          />

          {editingId === msg.id ? (
            <div className="space-y-2 pl-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-[hsl(220,18%,4%)] text-[hsl(210,20%,85%)] text-xs rounded-lg px-3 py-2.5 border border-[hsl(220,12%,18%)] focus:border-[hsl(186,85%,52%)]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(186,85%,52%)]/10 resize-none h-20 transition-all"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => saveEdit(msg.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-[hsl(145,65%,48%)]/10 text-[hsl(145,65%,48%)] rounded-lg border border-[hsl(145,65%,48%)]/20 hover:bg-[hsl(145,65%,48%)]/15 transition-all"
                >
                  <Check size={10} /> Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-[hsl(220,14%,12%)] text-[hsl(220,10%,45%)] rounded-lg border border-[hsl(220,12%,18%)] hover:bg-[hsl(220,14%,16%)] hover:text-[hsl(210,20%,70%)] transition-all"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="pl-2">
              <div className="text-xs text-[hsl(210,20%,80%)] leading-relaxed mb-2.5 whitespace-pre-wrap break-words">
                {msg.content}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[hsl(220,10%,35%)]">
                  {new Date(msg.created_at).toLocaleString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => startEdit(msg)}
                    className="p-1.5 text-[hsl(220,10%,35%)] hover:text-[hsl(186,85%,52%)] rounded-md hover:bg-[hsl(186,85%,52%)]/5 transition-all"
                    title="Edit"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={() => onDelete(msg.id)}
                    className="p-1.5 text-[hsl(220,10%,35%)] hover:text-[hsl(4,80%,58%)] rounded-md hover:bg-[hsl(4,80%,58%)]/5 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
