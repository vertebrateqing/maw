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

export interface MawState {
  version: string;
  project: string;
  agents: Agent[];
  created_at: string;
}

export interface DiffResponse {
  diff: string;
  agent_id: number;
}

export interface LogResponse {
  log: string;
  agent_id: number;
}
