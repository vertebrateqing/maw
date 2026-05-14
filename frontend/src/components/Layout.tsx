import { useState, useRef, useEffect } from "react";
import { AgentCard } from "./AgentCard";
import { DiffViewer } from "./DiffViewer";
import { LogViewer } from "./LogViewer";
import { MessageInput } from "./MessageInput";
import { MessageQueue } from "./MessageQueue";
import { useApi } from "@/hooks/useApi";
import { LayoutGrid, Inbox, Activity, GitBranch } from "lucide-react";

export function Layout() {
  const { state, error, connected, fetchDiff, approve, kill, addMessage, updateMessage, deleteMessage, clearLog, continueTask } = useApi();
  const [diffData, setDiffData] = useState<{ id: number; text: string } | null>(null);
  const [logAgentId, setLogAgentId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"agents" | "messages">("agents");
  const agentsScrollRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const agentsScrollPos = useRef(0);
  const messagesScrollPos = useRef(0);

  useEffect(() => {
    if (agentsScrollRef.current) {
      agentsScrollRef.current.scrollTop = agentsScrollPos.current;
    }
  });

  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollPos.current;
    }
  });

  const handleAgentsScroll = () => {
    agentsScrollPos.current = agentsScrollRef.current?.scrollTop || 0;
  };

  const handleMessagesScroll = () => {
    messagesScrollPos.current = messagesScrollRef.current?.scrollTop || 0;
  };

  const handleViewDiff = async (id: number) => {
    const text = await fetchDiff(id);
    setDiffData({ id, text });
  };

  const handleViewLog = (id: number) => {
    setLogAgentId(id);
  };

  const runningCount = state?.agents?.filter((a) => a.status === "running").length || 0;
  const reviewCount = state?.agents?.filter((a) => a.status === "pending_review").length || 0;
  const idleCount = state?.agents?.filter((a) => a.status === "idle").length || 0;

  return (
    <div className="h-screen flex flex-col bg-[hsl(220,18%,4%)] text-[hsl(210,20%,85%)] overflow-hidden noise-bg">
      {/* Header */}
      <header className="shrink-0 relative z-10">
        <div className="glass-strong border-b border-[hsl(220,12%,18%)]">
          <div className="flex items-center justify-between px-4 lg:px-5 py-3">
            {/* Left: Logo + project */}
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="relative">
                  <div className="w-7 h-7 rounded-lg bg-[hsl(186,85%,52%)]/10 border border-[hsl(186,85%,52%)]/30 flex items-center justify-center">
                    <GitBranch size={14} className="text-[hsl(186,85%,52%)]" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[hsl(186,85%,52%)] animate-pulse" />
                </div>
                <span className="text-sm font-bold tracking-[0.12em] text-gradient uppercase">MAW</span>
              </div>

              {state?.cwd && (
                <span
                  className="hidden lg:block text-[11px] text-[hsl(220,10%,45%)] truncate max-w-[180px] xl:max-w-[260px]"
                  title={state.cwd}
                >
                  {state.cwd}
                </span>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-[hsl(145,65%,48%)]" : "bg-[hsl(38,90%,58%)] animate-pulse"}`} />
                <span className={`text-[11px] hidden sm:inline ${connected ? "text-[hsl(145,65%,48%)]" : "text-[hsl(38,90%,58%)]"}`}>
                  {connected ? "connected" : error || "reconnecting"}
                </span>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-1 lg:gap-1.5 text-[11px] shrink-0">
              <StatPill
                icon={<Activity size={10} />}
                label="agents"
                value={state?.agents?.length || 0}
                color="foreground"
                hideLabel
              />
              <div className="hidden md:block w-px h-3 bg-[hsl(220,12%,18%)] mx-1" />
              <StatPill
                icon={<span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(210,85%,60%)]" />}
                label="running"
                value={runningCount}
                color="running"
              />
              <StatPill
                icon={<span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(38,90%,58%)]" />}
                label="review"
                value={reviewCount}
                color="review"
              />
              <StatPill
                icon={<span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(145,65%,48%)]" />}
                label="idle"
                value={idleCount}
                color="idle"
                hiddenOnMobile
              />
              <div className="hidden sm:block w-px h-3 bg-[hsl(220,12%,18%)] mx-1" />
              <StatPill
                label="queued"
                value={state?.pending_messages?.length || 0}
                color="foreground"
                hiddenOnMobile
              />
            </div>
          </div>
        </div>
      </header>

      {/* Task Input */}
      <MessageInput onSubmit={addMessage} />

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden shrink-0 relative z-10">
        <div className="flex glass border-b border-[hsl(220,12%,18%)]">
          <MobileTab
            active={mobileTab === "agents"}
            onClick={() => setMobileTab("agents")}
            icon={<LayoutGrid size={13} />}
            label="Agents"
            count={state?.agents?.length || 0}
          />
          <MobileTab
            active={mobileTab === "messages"}
            onClick={() => setMobileTab("messages")}
            icon={<Inbox size={13} />}
            label="Queue"
            count={state?.pending_messages?.length || 0}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative z-[1]">
        {/* Agents Panel */}
        <div
          className={`${
            mobileTab === "agents" ? "flex" : "hidden lg:flex"
          } flex-1 min-w-0 flex-col lg:border-r border-[hsl(220,12%,18%)]`}
        >
          <PanelHeader
            title="Agents"
            count={state?.agents?.length || 0}
          />
          <div
            ref={agentsScrollRef}
            onScroll={handleAgentsScroll}
            className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {state?.agents?.map((agent, i) => (
                <div
                  key={agent.id}
                  className="animate-[fade-in-up_0.4s_ease-out_forwards]"
                  style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s`, opacity: 0 }}
                >
                  <AgentCard
                    agent={agent}
                    onViewDiff={handleViewDiff}
                    onViewLog={handleViewLog}
                    onApprove={async (id) => {
                      try {
                        await approve(id);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        alert(`Approve failed: ${msg}`);
                      }
                    }}
                    onKill={async (id) => {
                      try {
                        await kill(id);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        alert(`Kill failed: ${msg}`);
                      }
                    }}
                    onContinue={continueTask}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message Queue */}
        <div
          className={`${
            mobileTab === "messages" ? "flex" : "hidden lg:flex"
          } w-full lg:w-[360px] xl:w-96 shrink-0 flex-col`}
        >
          <PanelHeader
            title="Message Queue"
            count={state?.pending_messages?.length || 0}
          />
          <div
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
            className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4"
          >
            <MessageQueue
              messages={state?.pending_messages || []}
              onUpdate={updateMessage}
              onDelete={deleteMessage}
            />
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      {diffData && (
        <DiffViewer
          diff={diffData.text}
          agentId={diffData.id}
          onClose={() => setDiffData(null)}
          onApprove={async () => {
            try {
              await approve(diffData.id);
              setDiffData(null);
              alert("Agent approved and merged successfully.");
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              alert(`Approve failed: ${msg}`);
            }
          }}
        />
      )}

      {/* Log Modal */}
      {logAgentId !== null && (
        <LogViewer
          agentId={logAgentId}
          onClose={() => setLogAgentId(null)}
          onClearLog={clearLog}
        />
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
  hideLabel,
  hiddenOnMobile,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  color: "foreground" | "running" | "review" | "idle";
  hideLabel?: boolean;
  hiddenOnMobile?: boolean;
}) {
  const colorMap = {
    foreground: "text-[hsl(210,20%,85%)]",
    running: "text-[hsl(210,85%,60%)]",
    review: "text-[hsl(38,90%,58%)]",
    idle: "text-[hsl(145,65%,48%)]",
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(220,14%,12%)] border border-[hsl(220,12%,18%)] ${hiddenOnMobile ? "hidden sm:flex" : "flex"}`}>
      {icon && <span className="opacity-70">{icon}</span>}
      {!hideLabel && <span className="text-[hsl(220,10%,45%)] hidden lg:inline">{label}</span>}
      <span className={`font-bold ${colorMap[color]}`}>{value}</span>
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all duration-200 ${
        active
          ? "text-[hsl(186,85%,52%)] border-b-2 border-[hsl(186,85%,52%)] bg-[hsl(186,85%,52%)]/5"
          : "text-[hsl(220,10%,45%)] hover:text-[hsl(210,20%,70%)]"
      }`}
    >
      {icon}
      {label} ({count})
    </button>
  );
}

function PanelHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="shrink-0 px-4 py-2.5 border-b border-[hsl(220,12%,18%)] hidden lg:flex items-center justify-between">
      <h2 className="text-[11px] font-bold text-[hsl(220,10%,45%)] uppercase tracking-[0.15em]">
        {title}
      </h2>
      <span className="text-[11px] font-bold text-[hsl(220,10%,45%)] bg-[hsl(220,14%,12%)] px-2 py-0.5 rounded-md border border-[hsl(220,12%,18%)]">
        {count}
      </span>
    </div>
  );
}
