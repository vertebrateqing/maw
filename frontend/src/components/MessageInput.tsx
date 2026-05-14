import { useState } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSubmit: (content: string) => void;
}

export function MessageInput({ onSubmit }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
      className="shrink-0 relative z-10"
    >
      <div className="glass-strong border-b border-[hsl(220,12%,18%)] px-3 lg:px-4 py-3"
      >
        <div className={`flex gap-2.5 transition-all duration-200 ${isFocused ? "glow-primary" : ""} rounded-xl p-1 bg-[hsl(220,18%,4%)] border ${isFocused ? "border-[hsl(186,85%,52%)]/30" : "border-[hsl(220,12%,18%)]"}`}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入任务描述..."
            disabled={isSubmitting}
            className="flex-1 bg-transparent text-[hsl(210,20%,85%)] text-sm px-3 py-2 focus:outline-none resize-none h-9 transition-all placeholder:text-[hsl(220,10%,35%)] disabled:opacity-50"
            rows={1}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[hsl(186,85%,52%)]/10 text-[hsl(186,85%,52%)] rounded-lg text-xs font-bold border border-[hsl(186,85%,52%)]/25 hover:bg-[hsl(186,85%,52%)]/15 hover:border-[hsl(186,85%,52%)]/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 shrink-0 self-center"
          >
            <Send size={12} />
            <span className="hidden sm:inline">{isSubmitting ? "Sending..." : "Dispatch"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
