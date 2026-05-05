import { useState } from "react";
import { Terminal } from "./Terminal";
import { AgentCard } from "./AgentCard";
import { DiffViewer } from "./DiffViewer";
import { useApi } from "@/hooks/useApi";

export function Layout() {
  const { state, fetchDiff, approve, reject, kill } = useApi();
  const [diffData, setDiffData] = useState<{ id: number; text: string } | null>(null);

  const handleViewDiff = async (id: number) => {
    const text = await fetchDiff(id);
    setDiffData({ id, text });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d]">
      <header className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#d4d4d4]">MAW</span>
          <span className="text-xs text-green-400">● Online</span>
        </div>
        <div className="text-xs text-[#858585]">
          {state?.agents?.length || 0} agents | {" "}
          {state?.agents?.filter((a) => a.status === "running").length || 0} running | {" "}
          {state?.agents?.filter((a) => a.status === "pending_review").length || 0} review
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 p-3">
          <Terminal />
        </div>
        <div className="w-80 border-l border-[#3c3c3c] p-3 overflow-y-auto">
          <h2 className="text-xs font-bold text-[#858585] uppercase mb-3">Agents</h2>
          <div className="space-y-3">
            {state?.agents?.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onViewDiff={handleViewDiff}
                onApprove={approve}
                onReject={reject}
                onKill={kill}
              />
            ))}
          </div>
        </div>
      </div>

      {diffData && (
        <DiffViewer
          diff={diffData.text}
          agentId={diffData.id}
          onClose={() => setDiffData(null)}
          onApprove={() => approve(diffData.id)}
          onReject={() => reject(diffData.id)}
        />
      )}
    </div>
  );
}
