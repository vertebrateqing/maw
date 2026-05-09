# MAW - Multi-Agent Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW enables **remote iPhone control of Claude Code** with parallel multi-agent development. Run multiple Claude Code instances simultaneously in isolated git worktrees, monitor their progress from your phone's browser, and merge their work back into your main branch.

> **v0.2.2** -- Agents automatically sync, push, and exit. You review diffs and approve merges from the browser. Follow-up instructions can be sent to any agent.

> :globe_with_meridians: [中文文档](README.zh-CN.md)

## Features

- :iphone: **iPhone Browser Control** -- Safari dashboard, no app install
- :robot: **Multi-Agent Parallel Execution** -- Multiple Claude Code instances working on different tasks
- :deciduous_tree: **Git Worktree Isolation** -- Each agent works in its own branch
- :ocean: **Real-Time Log Streaming** -- Watch agent thinking and tool calls live
- :white_check_mark: **Diff Review & Merge** -- Review changes, approve to merge into main
- :speech_balloon: **Follow-Up Instructions** -- Send additional tasks to agents after initial work
- :arrows_counterclockwise: **Auto-Dispatch** -- Tasks are queued and assigned to idle agents automatically
- :bar_chart: **Real-Time Status Board** -- SSE-powered live updates
- :lock: **Secure by Default** -- Tailscale mesh VPN + local-only binding

## Architecture

```
iPhone Safari
  └── Tailscale VPN
        └── HTTP → WSL2:8080
              └── maw-server (Python daemon)
                    ├── Auto-dispatcher thread (queue → idle agent)
                    ├── Agent N: subprocess claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /messages, /dispatch, /diff, /approve, /continue)
                    └── SSE broadcaster (state.json changes)
```

## Prerequisites

- WSL2 (Ubuntu) or Linux/macOS with bash
- Git repository for your project
- iPhone with Tailscale app
- Python 3.10+

## Setup

### 1. Install Dependencies

```bash
sudo apt-get update
sudo apt-get install -y jq git python3 python3-pip

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

On your iPhone: install [Tailscale](https://apps.apple.com/us/app/tailscale/id1470499037).

### 2. Install MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# Add to shell config for persistence:
# echo 'export PATH="/path/to/maw/bin:$PATH"' >> ~/.bashrc
```

### 3. Set Up Python Environment

```bash
cd /path/to/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Start the MAW Server

Navigate to **your project's git repository** (not the maw directory) and run:

```bash
cd /path/to/your/project
maw-server
```

The server auto-initializes on first run, creating 4 agents with git worktrees and `state.json`.

Or run with systemd:

```bash
sed "s/%I/$USER/g" /path/to/maw/config/maw.service | sudo tee /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 5. Connect from iPhone

1. Open **Tailscale** on iPhone, connect
2. Open **Safari**, navigate to `http://100.x.x.x:8080` (your WSL2 Tailscale IP)
3. You should see the MAW dashboard

> :bulb: **Tip**: Add to Home Screen for quick access (Share → Add to Home Screen)

## Using MAW

**Enter tasks in the browser dashboard:**

1. Type your task in the **Message Input** box
2. Click **Dispatch** to send the task
3. If no agents are idle, the task is automatically **queued**
4. The **auto-dispatcher** assigns queued tasks as agents become idle

**Monitor progress:**
- Agent cards show real-time status (SSE): idle, running, or pending_review
- Click **Log** to watch the agent's real-time output
- Click **Kill** to stop a running agent

**Review and merge:**
- Click **Diff** on a pending-review card to see changes
- Click **Approve & Merge** to merge the agent's branch into main
- If the work needs changes, type follow-up instructions in the input field and click **继续**

**The Message Queue** shows tasks waiting for an idle agent.

## Commands Reference

| Command | Description |
|---------|-------------|
| `maw init [N]` | Initialize with N agents (default: 4) |
| `maw status` | Show status board (one-shot) |
| `maw watch` | Continuously refresh status board |
| `maw approve <id>` | Merge agent branch into main |
| `maw diff <id>` | Show git diff for agent branch |
| `maw reset <id>` | Reset agent worktree to main |
| `maw kill <id>` | Kill agent process |
| `maw queue <content>` | Add a message to the queue |
| `maw menu` | Interactive menu |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAW_LANG` | `en` | Language: `en` or `zh` |
| `MAW_MAX_AGENTS` | `4` | Maximum agents |
| `MAW_WATCH_INTERVAL` | `2` | Status refresh interval (seconds) |
| `MAW_PORT` | `8080` | Server port |

## Development

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # Development server
npm run build    # Build to ../static/
```

Build output in `static/` is committed to git so users don't need Node.js to run MAW.

## License

[MIT](LICENSE)
