#!/usr/bin/env bash
set -euo pipefail

# MAW State Management
# JSON state file CRUD operations
# Uses jq if available, falls back to simple sed/awk for basic operations

# maw_state_file - get path to state.json
maw_state_file() {
  local root
  root="$(maw_project_root)"
  echo "${root}/.maw/state.json"
}

# maw_state_init - initialize state for a new project
maw_state_init() {
  local root
  root="$(maw_project_root)"

  maw_ensure_dir "${root}/.maw/logs"
  maw_ensure_dir "${root}/.agents"

  local state_file
  state_file="${root}/.maw/state.json"

  if [[ ! -f "$state_file" ]]; then
    cat > "$state_file" << 'JSON'
{
  "version": "1.0",
  "project": "",
  "agents": [],
  "created_at": ""
}
JSON
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    if command -v jq &> /dev/null; then
      jq --arg ts "$timestamp" --arg proj "$(basename "$root")" \
         '.created_at = $ts | .project = $proj' "$state_file" > "${state_file}.tmp"
      mv "${state_file}.tmp" "$state_file"
    else
      sed -i "s/\"created_at\": \"\"/\"created_at\": \"$timestamp\"/" "$state_file"
      sed -i "s/\"project\": \"\"/\"project\": \"$(basename "$root")\"/" "$state_file"
    fi
  fi

  maw_log info "Initialized MAW state in ${root}"
}

# maw_state_add_agent <id> <worktree> <branch>
maw_state_add_agent() {
  local id="$1"
  local worktree="$2"
  local branch="$3"
  local state_file
  state_file="$(maw_state_file)"

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if command -v jq &> /dev/null; then
    jq --argjson id "$id" \
       --arg worktree "$worktree" \
       --arg branch "$branch" \
       --arg ts "$timestamp" \
       '.agents += [{"id": $id, "worktree": $worktree, "branch": $branch, "status": "idle", "task": "", "pid": null, "started_at": null, "completed_at": null}]' \
       "$state_file" > "${state_file}.tmp"
    mv "${state_file}.tmp" "$state_file"
  else
    maw_die "jq is required for state management. Install it with: sudo apt-get install jq"
  fi
}

# maw_state_update_agent <id> <status> [task] [pid]
maw_state_update_agent() {
  local id="$1"
  local status="$2"
  local task="${3:-}"
  local pid="${4:-null}"
  local state_file
  state_file="$(maw_state_file)"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if command -v jq &> /dev/null; then
    local jq_filter
    jq_filter=".agents |= map(if .id == $id then .status = \"$status\""
    if [[ -n "$task" ]]; then
      jq_filter+=" | .task = \"$task\""
    fi
    if [[ "$pid" != "null" && "$pid" != "" ]]; then
      jq_filter+=" | .pid = $pid"
    fi
    if [[ "$status" == "running" ]]; then
      jq_filter+=" | .started_at = \"$timestamp\""
    elif [[ "$status" == "done" || "$status" == "error" ]]; then
      jq_filter+=" | .completed_at = \"$timestamp\" | .pid = null"
    fi
    jq_filter+=" else . end)"

    jq "$jq_filter" "$state_file" > "${state_file}.tmp"
    mv "${state_file}.tmp" "$state_file"
  fi
}

# maw_state_get_agent_status <id>
maw_state_get_agent_status() {
  local id="$1"
  local state_file
  state_file="$(maw_state_file)"

  jq -r ".agents[] | select(.id == $id) | .status" "$state_file"
}

# maw_state_list_agents
maw_state_list_agents() {
  local state_file
  state_file="$(maw_state_file)"
  jq -c '.agents[]' "$state_file"
}

# maw_state_get_idle_agent - returns the first idle agent id, or empty
maw_state_get_idle_agent() {
  local state_file
  state_file="$(maw_state_file)"
  jq -r '.agents[] | select(.status == "idle") | .id' "$state_file" | head -n1
}

# maw_state_agent_count
maw_state_agent_count() {
  local state_file
  state_file="$(maw_state_file)"
  jq '.agents | length' "$state_file"
}
