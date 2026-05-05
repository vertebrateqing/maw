import { useState } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSubmit: (content: string) => void;
}

export function MessageInput({ onSubmit }: MessageInputProps) {
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 bg-[#1e1e1e] border-b border-[#3c3c3c]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入任务描述..."
        className="flex-1 bg-[#252526] text-[#d4d4d4] text-sm rounded px-3 py-2 border border-[#3c3c3c] focus:border-blue-600 focus:outline-none resize-none h-10"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <button
        type="submit"
        className="flex items-center gap-1 px-4 py-2 bg-blue-900 text-blue-200 rounded text-sm hover:bg-blue-800"
      >
        <Send size={14} /> 派发
      </button>
    </form>
  );
}
