# MAW — Multi-Agent Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20WSL2-blue.svg)](#prerequisites)

MAW gives you **remote iPhone control of Claude Code** with parallel multi-agent development. Run multiple Claude Code instances simultaneously in isolated git worktrees, monitor their progress from your phone's browser, and merge their work back into your main branch.

> **v0.2.3** — Agents auto-sync, push, and exit. You review diffs and approve merges from the browser. Follow-up instructions can be sent to any agent.

> 🌐 [中文文档](README.zh-CN.md)

## Features

- 📱 **iPhone Browser Control** — Safari dashboard, no app install
- 🤖 **Multi-Agent Parallel Execution** — Multiple Claude Code instances working on different tasks
- 🌳 **Git Worktree Isolation** — Each agent works in its own branch
- 🌊 **Real-Time Log Streaming** — Watch agent thinking and tool calls live
- ✅ **Diff Review & Merge** — Review changes, approve to merge into main
- 💬 **Follow-Up Instructions** — Send additional tasks to agents after initial work
- 🔄 **Auto-Dispatch** — Tasks are queued and assigned to idle agents automatically
- 📊 **Real-Time Status Board** — SSE-powered live updates
- 🔒 **Private by Default** — Tailscale mesh VPN keeps the dashboard off the public internet

## Architecture

```
iPhone Safari
  └── Tailscale VPN
        └── HTTP → host:8080
              └── maw-server (Python daemon)
                    ├── Auto-dispatcher thread (queue → idle agent)
                    ├── Agent N: subprocess claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /messages, /dispatch, /diff, /approve, /continue)
                    └── SSE broadcaster (state.json changes)
```

## Prerequisites

- A POSIX shell environment: Linux, macOS, or WSL2 (Ubuntu)
- Git repository for your project
- Python **3.10+**
- [`claude`](https://docs.claude.com/en/docs/claude-code/overview) CLI installed and authenticated (`claude --version` should succeed)
- iPhone with the [Tailscale](https://tailscale.com/) app (for remote access)

### Install system dependencies

**Linux (Debian / Ubuntu):**

```bash
sudo apt-get update
sudo apt-get install -y jq git python3 python3-venv python3-pip
```

**macOS (Homebrew):**

```bash
brew install jq git python@3.12
```

**Tailscale (optional, only for remote iPhone access):**

```bash
# Linux
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# macOS
brew install --cask tailscale
open -a Tailscale
```

Then install the [Tailscale iOS app](https://apps.apple.com/us/app/tailscale/id1470499037) on your iPhone and sign in with the same account.

## Setup

### 1. Install MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw

# Add the CLI to your PATH (use ~/.zshrc on macOS with zsh, ~/.bashrc elsewhere)
echo 'export PATH="'$PWD'/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 2. Set up the Python environment

```bash
cd /path/to/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the MAW server

Navigate to **your project's git repository** (not the maw directory) and run:

```bash
cd /path/to/your/project
maw-server
```

The server auto-initializes on first run, creating 4 agents with git worktrees and a `state.json`. Pass a count to `maw init` later to change it:

```bash
maw init 10   # 10 parallel agents
```

### 4. Connect from iPhone

1. Open **Tailscale** on iPhone, connect
2. Open **Safari**, navigate to `http://<your-tailscale-ip>:8080` (find it with `tailscale ip -4`)
3. The MAW dashboard loads

> 💡 **Tip**: Add the page to the Home Screen for one-tap access.

## Running MAW as a daemon

### Linux (systemd)

```bash
sed "s/%I/$USER/g" /path/to/maw/config/maw.service | sudo tee /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable --now maw
```

### macOS / cross-platform (tmux)

```bash
tmux new -s maw -d 'cd /path/to/your/project && maw-server'
# Re-attach later with: tmux attach -t maw
```

For macOS users who want a true LaunchAgent, create `~/Library/LaunchAgents/com.maw.server.plist` with the standard `ProgramArguments` pointing at `bin/maw-server` and `WorkingDirectory` set to your project. Load it with `launchctl load …`.

## Using the dashboard

**Enter tasks:**

1. Type your task in the **Message Input** box
2. Click **Dispatch** to send the task to an idle agent
3. If no agents are idle, the task is **queued** automatically
4. The **auto-dispatcher** assigns queued tasks as agents become idle

**Monitor progress:**

- Agent cards show real-time status (SSE): `idle`, `running`, or `pending_review`
- Click **Log** to watch the agent's real-time output
- Click **Kill** to stop a running agent

**Review and merge:**

- Click **Diff** on a `pending_review` card to see the changes
- Click **Approve & Merge** to fast-forward `main`
- To request changes, type follow-up instructions in the input field and click **继续**

## Command reference

| Command | Description |
|---|---|
| `maw init [N]` | Initialize with N agents (default 4) |
| `maw status` | Show the status board once |
| `maw watch` | Continuously refresh the status board |
| `maw dispatch <task> [id]` | Dispatch a task to an idle agent (or the given id) |
| `maw queue <content>` | Add a task to the pending queue |
| `maw queue-list` | List pending queued tasks |
| `maw queue-update <id> <content>` | Edit a queued task in place |
| `maw queue-remove <id>` | Drop a queued task |
| `maw diff <id>` | Show `git diff main…agent/<id>` |
| `maw review-request <id>` | Mark agent as `pending_review` |
| `maw approve <id>` | Merge agent branch into main |
| `maw reject <id>` | Discard the agent's work and reset its worktree |
| `maw merge <id>` | Alias for `approve` (legacy) |
| `maw reset` | Global reset: kill all, clear logs, sync with main |
| `maw reset <id>` | Reset a single agent's worktree to main |
| `maw kill <id>` | Send SIGTERM to the agent's process |
| `maw config <id> <key> <value>` | Toggle per-agent config flags (e.g. `auto_test true`) |
| `maw menu` | Interactive menu |
| `maw version` | Print the MAW version |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MAW_LANG` | `en` | UI language: `en` or `zh` |
| `MAW_WATCH_INTERVAL` | `2` | Refresh interval for `maw watch` (seconds) |
| `MAW_PORT` | `8080` | Server port |

## Security note

`maw-server` listens on `0.0.0.0:<port>` so Tailscale (and any other LAN client) can reach it. **It does not require authentication.** Two recommended deployment patterns:

- **Tailscale-only access (recommended)**: rely on Tailscale's mesh to keep the dashboard off the public internet. Make sure your host has no port forwarding rules exposing `8080`.
- **Local + SSH tunnel**: front the server with `ssh -L 8080:127.0.0.1:8080 user@host` and configure `MAW_PORT` or your firewall accordingly.

Never expose `maw-server` directly to the public internet without putting an authenticating reverse proxy in front of it.

## Frontend development

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # Vite dev server, hot reload
npm run build    # Production build → ../static/
```

Build output in `static/` is committed to git so users don't need Node.js to run MAW.

## Tests

```bash
# Bash unit tests
bash tests/run_all.sh

# Python API tests
pytest tests/test_api.py
```

## License

[MIT](LICENSE)
