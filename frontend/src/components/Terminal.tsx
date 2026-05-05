import { useRef } from "react";
import { useTerminal } from "@/hooks/useTerminal";

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] rounded-lg overflow-hidden border border-[#3c3c3c]">
      <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="ml-2 text-xs text-[#858585]">Claude (Master)</span>
      </div>
      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
