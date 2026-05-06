# MAW Workflow

## Overview
MAW (Multi-Agent Workspace) is a decentralized multi-agent development tool.
All Claude agents are equal -- there is no "master" agent. Tasks are entered
via the browser dashboard, queued automatically, and dispatched to idle agents.

## Dashboard
Open `http://<wsl-ip>:8080` in your browser (via Tailscale VPN on iPhone).

The dashboard shows:
- **Message Input** -- Enter task descriptions and click "Dispatch"
- **Agent Panel** -- See all agents and their status (idle / running / review)
- **Message Queue** -- Pending tasks waiting for an idle agent

## Review Cycle
When an agent completes:
1. Status changes to `pending_review`
2. Click **Diff** to review changes
3. Click **Approve** to merge into main (agent resets to idle)
4. Click **Reject** to discard changes (agent resets to idle)

## Guidelines
- Tasks are automatically queued if no idle agents
- The auto-dispatcher assigns queued tasks as agents become idle
- Agents work in isolated git worktrees (`.agents/agent-N`)
- Each agent writes its own git commits and handles its own tests
