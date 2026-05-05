# MAW - Multi-Agent Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW enables **remote iPhone control of Claude Code** with parallel multi-agent development. Run multiple Claude Code instances simultaneously in isolated git worktrees, monitor their progress from your phone's browser, and merge their work back into your main branch.

> **v0.2.0** -- Browser Dashboard: No more tmux/Termius. Access your agents via Safari.

> :globe_with_meridians: [中文文档](README.zh-CN.md)

## Features

- :iphone: **iPhone Browser Control** -- Access dashboard from Safari, no app needed
- :desktop_computer: **Web Terminal** -- Full xterm.js terminal for master Claude Code
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

### 4. Set Up Your Project

Navigate to **your project's git repository** (not the maw directory):

```bash
cd /path/to/your/project

# Make sure you're on main branch
git checkout main

# Initialize MAW with 4 agents
maw init 4
```

This creates 4 agents with git worktrees and a `state.json` file.

### 5. Start the MAW Server

```bash
maw-server
```

Or run with systemd for persistence:

```bash
# Copy systemd service (replace %I with your username)
sed "s/%I/$USER/g" /path/to/maw/config/maw.service > /tmp/maw.service
sudo cp /tmp/maw.service /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 6. Connect from iPhone

1. Open **Tailscale** app on iPhone, connect to your network
2. Open **Safari**, navigate to: `http://100.x.x.x:8080` (your WSL2 Tailscale IP)
3. You should see the MAW dashboard with:
   - Left pane: Web terminal (master Claude Code)
   - Right pane: Agent status cards

> :bulb: **Tip**: Add the page to your Home Screen for quick access (Share → Add to Home Screen)

### 7. Using MAW (Day-to-Day Workflow)

**In the web terminal**, talk to Claude Code normally. When you have a complex task that can be parallelized:

```
You: Please implement user authentication. It's complex, can you delegate it?
Claude: I'll dispatch this to an available agent.
```

Claude will run: `maw dispatch "Implement user authentication"`

MAW will:
1. Find an idle agent
2. Run `claude` in the agent's worktree as a background process
3. Update the state to `running`
4. Stream the agent's output to a log file

**Monitor progress** in the browser dashboard:
- Agent cards show real-time status (SSE updates)
- Tap "Kill" to stop a running agent
- When an agent completes, its card shows "Review" status

**Review and merge**:
- Tap "Diff" on a pending-review card to see changes
- Tap "Approve & Merge" to merge the agent's branch into main
- Tap "Reject" to reset the agent's worktree

### 8. Disconnect and Reconnect

**From iPhone**: Just close Safari. The server keeps running on WSL2.

**Reconnect later**: Open Safari and navigate to the same URL. Everything is exactly where you left it.

## Commands Reference

| Command | Description |
|---------|-------------|
| `maw init [N]` | Initialize with N agents (default: 4) |
| `maw dispatch "<task>" [id]` | Send task to idle agent (or specific id) |
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
All agents are busy. Wait for one to finish, or run `maw status` to check.

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
