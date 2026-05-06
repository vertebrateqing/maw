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
      <div className="flex flex-col items-center justify-center py-8 text-[#444444]">
        <MessageSquare size={20} className="mb-2 opacity-50" />
        <span className="text-xs font-mono">暂无待处理任务</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="bg-[#141414] rounded-lg border border-[#222222] p-3 transition-all duration-150 hover:border-[#333333]"
        >
          {editingId === msg.id ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-[#0a0a0a] text-[#d4d4d4] text-xs font-mono rounded px-2.5 py-2 border border-[#2a2a2a] focus:border-[#00bcd4] focus:outline-none resize-none h-16"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => saveEdit(msg.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono bg-[#1a2f1a] text-[#4caf50] rounded border border-[#2e5c2e] hover:bg-[#203d20]"
                >
                  <Check size={10} /> Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono bg-[#1e1e1e] text-[#888888] rounded border border-[#333333] hover:bg-[#2a2a2a]"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-[#b0b0b0] font-mono leading-relaxed mb-2 whitespace-pre-wrap break-words">
                {msg.content}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#555555] font-mono">
                  {new Date(msg.created_at).toLocaleString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(msg)}
                    className="p-1 text-[#555555] hover:text-[#00bcd4] transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={() => onDelete(msg.id)}
                    className="p-1 text-[#555555] hover:text-[#ef5350] transition-colors"
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
