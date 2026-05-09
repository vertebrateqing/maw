export interface Agent {
  id: number;
  worktree: string;
  branch: string;
  status: "idle" | "running" | "pending_review" | "error";
  task: string;
  pid: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  priority: number;
}

export interface MawState {
  version: string;
  project: string;
  agents: Agent[];
  pending_messages: Message[];
  created_at: string;
  cwd: string;
}

export interface DiffResponse {
  diff: string;
  agent_id: number;
}

export interface LogResponse {
  log: string;
  agent_id: number;
}
