# MAW - Multi-Agent Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW enables **remote iPhone control of Claude Code** with parallel multi-agent development. Run multiple Claude Code instances simultaneously in isolated git worktrees, monitor their progress from your phone's browser, and merge their work back into your main branch.

> **v0.2.1** -- Decentralized Architecture: All agents are equal. Tasks are entered via the browser dashboard, queued automatically, and dispatched to idle agents.

> :globe_with_meridians: [中文文档](README.zh-CN.md)

## Features

- :iphone: **iPhone Browser Control** -- Access dashboard from Safari, no app needed
- :desktop_computer: **Web Terminal** -- Full xterm.js terminal for Claude Code
- :arrows_counterclockwise: **Session Persistence** -- systemd keeps the daemon alive across disconnects
- :ocean: **Streaming Output** -- Real-time visibility into Claude Code responses
- :robot: **Multi-Agent Parallel Execution** -- Split complex tasks across multiple Claude Code instances
- :deciduous_tree: **Git Worktree Isolation** -- Each agent works in its own branch, no conflicts
- :bar_chart: **Real-time Status Board** -- Monitor all agents from your phone
- :white_check_mark: **Diff Review & Merge** -- GitHub-style diff viewer with one-tap approve/reject
- :lock: **Secure by Default** -- Tailscale mesh VPN + local-only binding
- :earth_americas: **Bilingual** -- English and Chinese support

## Architecture

```
iPhone Safari
  └── Tailscale VPN
        └── HTTPS → WSL2:8080
              └── maw-server (Python daemon)
                    ├── PTY master ←→ WebSocket → xterm.js (browser)
                    ├── Agent N: subprocess claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /diff, /approve, /reject, /kill)
                    └── SSE broadcaster (state.json changes)
```

## Prerequisites

- WSL2 (Ubuntu) or Linux/macOS with bash
- Git repository for your project
- iPhone with Tailscale app
- Python 3.10+ and Node.js 20+ (for development)

## Step-by-Step Setup

### 1. Install Dependencies

On your computer (WSL2):

```bash
# Required packages
sudo apt-get update
sudo apt-get install -y jq git python3 python3-pip

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note your Tailscale IP: 100.x.x.x
```

On your iPhone:
- Install [Tailscale](https://apps.apple.com/us/app/tailscale/id1470499037)

### 2. Install MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# Add to your shell config to persist:
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

The server auto-initializes on first run, creating 4 agents with git worktrees and a `state.json` file.

Or run with systemd for persistence:

```bash
# Copy systemd service (replace %I with your username)
sed "s/%I/$USER/g" /path/to/maw/config/maw.service > /tmp/maw.service
sudo cp /tmp/maw.service /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 5. Connect from iPhone

1. Open **Tailscale** app on iPhone, connect to your network
2. Open **Safari**, navigate to: `http://100.x.x.x:8080` (your WSL2 Tailscale IP)
3. You should see the MAW dashboard with:
   - Left pane: Web terminal (Claude Code)
   - Right pane: Agent status cards and message queue

> :bulb: **Tip**: Add the page to your Home Screen for quick access (Share → Add to Home Screen)

### 6. Using MAW (Day-to-Day Workflow)

**Enter tasks in the browser dashboard:**

1. Type your task description in the **Message Input** box
2. Click **Dispatch** to send the task
3. If no agents are idle, the task is automatically **queued**
4. The **auto-dispatcher** assigns queued tasks as agents become idle

**Monitor progress** in the browser dashboard:
- Agent cards show real-time status (SSE updates): idle, running, or pending_review
- Tap "Kill" to stop a running agent
- The **Message Queue** shows pending tasks waiting for an idle agent

**Review and merge**:
- Tap "Diff" on a pending-review card to see changes
- Tap "Approve & Merge" to merge the agent's branch into main
- Tap "Reject" to reset the agent's worktree

### 7. Agent Configuration

Each idle agent has toggle options you can set from the dashboard:

| Toggle | Description |
|--------|-------------|
| **Auto Pull** | Auto `git pull origin main` before starting work |
| **Auto Test** | Auto run tests after completing work (agent fixes bugs if tests fail) |

### 8. Disconnect and Reconnect

**From iPhone**: Just close Safari. The server keeps running on WSL2.

**Reconnect later**: Open Safari and navigate to the same URL. Everything is exactly where you left it.

## Commands Reference

| Command | Description |
|---------|-------------|
| `maw init [N]` | Initialize with N agents (default: 4) |
| `maw status` | Show status board (one-shot) |
| `maw watch` | Continuously refresh status board |
| `maw review-request <id>` | Mark agent as pending review |
| `maw approve <id>` | Merge agent branch into main and reset |
| `maw reject <id>` | Reset agent worktree to main |
| `maw diff <id>` | Show git diff for agent branch |
| `maw merge <id>` | Merge agent branch into main |
| `maw reset <id>` | Reset agent worktree to main |
| `maw kill <id>` | Kill agent process |
| `maw menu` | Interactive menu |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAW_LANG` | `en` | Language: `en` or `zh` |
| `MAW_MAX_AGENTS` | `4` | Maximum agents |
| `MAW_WATCH_INTERVAL` | `2` | Status refresh interval (seconds) |
| `MAW_PORT` | `8080` | Server port |

## Development

To modify the frontend:

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # Development server
npm run build    # Build to ../static/
```

The build output in `static/` is committed to git so users don't need Node.js to run MAW.

## Testing

```bash
cd /path/to/maw
bash tests/run_all.sh
```

## Troubleshooting

### "No idle agents available"
All agents are busy. Tasks are automatically queued and dispatched when an agent becomes idle.

### Server not reachable from iPhone
- Check Tailscale is connected on both sides: `sudo tailscale status`
- Check server is running: `curl http://localhost:8080/api/status`
- Check firewall: `sudo ss -tlnp | grep 8080`

### Agent worktree conflicts
Run `maw reset <id>` to clean an agent's worktree and start fresh.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## License

[MIT](LICENSE)
