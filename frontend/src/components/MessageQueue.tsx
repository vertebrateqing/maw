import { useState } from "react";
import { Trash2, Edit2, Check, X } from "lucide-react";
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

  return (
    <div className="space-y-2">
      {messages.length === 0 && (
        <div className="text-xs text-[#858585] italic">暂无待处理任务</div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className="bg-[#252526] rounded border border-[#3c3c3c] p-2">
          {editingId === msg.id ? (
            <div className="flex gap-1">
              <input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] text-xs rounded px-2 py-1 border border-[#3c3c3c]"
              />
              <button onClick={() => saveEdit(msg.id)} className="text-green-400 hover:text-green-300">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-300">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <div className="text-xs text-[#d4d4d4] mb-1">{msg.content}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#858585]">{new Date(msg.created_at).toLocaleString()}</span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(msg)} className="text-[#858585] hover:text-blue-400">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => onDelete(msg.id)} className="text-[#858585] hover:text-red-400">
                    <Trash2 size={12} />
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
