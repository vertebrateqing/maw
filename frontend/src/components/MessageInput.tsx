import { useState } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSubmit: (content: string) => void;
}

export function MessageInput({ onSubmit }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent("");
    } catch (err) {
      console.error("Failed to submit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 flex gap-3 p-3 bg-[#111111] border-b border-[#222222]"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入任务描述..."
        disabled={isSubmitting}
        className="flex-1 bg-[#141414] text-[#d4d4d4] text-sm font-mono rounded-lg px-3 py-2.5 border border-[#2a2a2a] focus:border-[#00bcd4] focus:outline-none focus:ring-1 focus:ring-[#00bcd4]/20 resize-none h-10 transition-all placeholder:text-[#555555] disabled:opacity-50"
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
        disabled={isSubmitting || !content.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00bcd4]/10 text-[#00bcd4] rounded-lg text-sm font-mono font-bold border border-[#00bcd4]/30 hover:bg-[#00bcd4]/20 hover:border-[#00bcd4]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Send size={13} />
        {isSubmitting ? "Sending..." : "Dispatch"}
      </button>
    </form>
  );
}
