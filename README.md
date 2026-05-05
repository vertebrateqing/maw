# MAW - Multi-Agent Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW enables **remote iPhone control of Claude Code** with parallel multi-agent development. Run multiple Claude Code instances simultaneously in isolated git worktrees, monitor their progress from your phone, and merge their work back into your main branch.

> 🌐 [中文文档](README.zh-CN.md)

## Features

- 📱 **iPhone Remote Development** - Control Claude Code from anywhere via SSH
- 🔄 **Session Persistence** - Lock your phone, disconnect from network—your session survives
- 🌊 **Streaming Output** - Real-time visibility into Claude Code responses
- 🤖 **Multi-Agent Parallel Execution** - Split complex tasks across multiple Claude Code instances
- 🌳 **Git Worktree Isolation** - Each agent works in its own branch, no conflicts
- 📊 **Real-time Status Board** - Monitor all agents from your phone
- 🔒 **Secure by Default** - Tailscale mesh VPN + SSH key authentication
- 🌍 **Bilingual** - English and Chinese support

## Prerequisites

- WSL2 (Ubuntu) or Linux/macOS with bash
- Git repository for your project
- iPhone with Termius + Tailscale apps

## Step-by-Step Setup

### 1. Install Dependencies

On your computer (WSL2):

```bash
# Required packages
sudo apt-get update
sudo apt-get install -y tmux jq openssh-server git

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note your Tailscale IP: 100.x.x.x
```

On your iPhone:
- Install [Tailscale](https://apps.apple.com/us/app/tailscale/id1470499037)
- Install [Termius](https://apps.apple.com/us/app/termius-ssh-client/id549039908)

### 2. Install MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# Add to your shell config to persist:
# echo 'export PATH="/path/to/maw/bin:$PATH"' >> ~/.bashrc
```

### 3. Configure SSH

```bash
# Make sure SSH server is running
sudo service ssh start

# Copy MAW's hardened SSH config
sudo mkdir -p /etc/ssh/sshd_config.d
sudo cp config/sshd_config.example /etc/ssh/sshd_config.d/maw.conf
sudo sh -c 'grep -q "sshd_config.d" /etc/ssh/sshd_config || echo "Include /etc/ssh/sshd_config.d/*.conf" >> /etc/ssh/sshd_config'
sudo service ssh restart

# Generate SSH key for iPhone (if you don't have one)
ssh-keygen -t ed25519 -C "iphone-maw" -f ~/.ssh/iphone_maw
# Copy public key to authorized_keys
cat ~/.ssh/iphone_maw.pub >> ~/.ssh/authorized_keys
```

### 4. Configure tmux

```bash
cp config/tmux.conf ~/.tmux.conf
```

### 5. Set Up Your Project

Navigate to **your project's git repository** (not the maw directory):

```bash
cd /path/to/your/project

# Make sure you're on main branch
git checkout main

# Start a tmux session named "maw"
tmux new-session -s maw
```

> ⚠️ **Important**: You must be inside tmux before running `maw init`. MAW checks for the `TMUX` environment variable and will refuse to run outside tmux.

Inside the tmux session, initialize MAW:

```bash
maw init 4
```

This creates 4 agents with git worktrees and a `state.json` file.

### 6. Create the Status Window

Now create the window layout. In your tmux session:

```bash
# You're currently in window 1. Rename it to "master":
# (press Ctrl+b , then type the new name)
Ctrl+b ,
# Type: master
# Press Enter

# Create window 2 for the status board
Ctrl+b c
# This creates a new window. Rename it to "status":
Ctrl+b ,
# Type: status

# Run the watch command in window 2
maw watch
```

Your layout now looks like this:

```
Window 1 (master):  Your main Claude Code session
Window 2 (status):  maw watch (auto-refreshes every 2 seconds)
```

Switch between windows with `Ctrl+b 1` and `Ctrl+b 2`.

### 7. Start Claude Code in the Master Window

Switch to window 1 (`Ctrl+b 1`) and start Claude Code:

```bash
claude
```

### 8. Connect from iPhone

1. Open **Tailscale** app on iPhone, connect to your network
2. Open **Termius**, add a new host:
   - Alias: `WSL2 MAW`
   - Hostname: `100.x.x.x` (your WSL2 Tailscale IP)
   - Port: `22`
   - Username: your WSL2 username
   - Password: OFF
   - Private Key: import `~/.ssh/iphone_maw` (transfer it to iPhone first)
3. Connect to the host
4. Once connected, attach to the tmux session:
   ```bash
   tmux attach -t maw
   ```

> 💡 **Tip**: You can configure Termius to auto-run `tmux attach -t maw` on connection. Go to Host Settings → Startup → Snippet, and add the command.

### 9. Using MAW (Day-to-Day Workflow)

**In the master window** (`Ctrl+b 1`), talk to Claude Code normally. When you have a complex task that can be parallelized:

```
You: Please implement user authentication. It's complex, can you delegate it?
Claude: I'll dispatch this to an available agent. Run: maw dispatch "Implement user authentication"
```

**Run the dispatch command** (still in master window):
```bash
maw dispatch "Implement user authentication"
```

MAW will:
1. Find an idle agent
2. Create a new tmux window (e.g., `Window 3: agent-1`)
3. Start `claude` inside that window with your task
4. Update the state to `running`

**Monitor progress** by switching to window 2:
```bash
Ctrl+b 2
```

You'll see the live status board:
```
┌─ MAW Status Board ──────────────────────────────────────────┐
│ ID  Status  Branch    Task                   Elapsed      │
│ ────────────────────────────────────────────────────────────│
│ 1   🔵 RUN   agent/1  Implement user auth...  03:12       │
│ 2   ⚪ IDLE  agent/2  -                                    │
│ 3   ⚪ IDLE  agent/3  -                                    │
│ 4   ⚪ IDLE  agent/4  -                                    │
└─────────────────────────────────────────────────────────────┘
[4 agents | 1 running | 0 done | 3 idle]
```

**Peek at an agent's work**:
```bash
Ctrl+b 3   # Switch to agent-1 window to see Claude's live output
```

**When the agent finishes**, switch back to master (`Ctrl+b 1`) and merge:
```bash
maw merge 1
```

This merges `agent/1` branch into `main` and resets the agent to idle.

### 10. Disconnect and Reconnect

**From iPhone**: Just close Termius. The tmux session keeps running on WSL2.

**Reconnect later**:
```bash
tmux attach -t maw
```

Everything is exactly where you left it.

## tmux Cheat Sheet for iPhone

| Action | Keys |
|--------|------|
| Switch to window N | `Ctrl+b` `1` (or `2`, `3`, `4`...) |
| List all windows | `Ctrl+b` `w` |
| Next window | `Ctrl+b` `n` |
| Previous window | `Ctrl+b` `p` |
| Last window | `Ctrl+b` `l` |
| New window | `Ctrl+b` `c` |
| Kill window | `Ctrl+b` `x` |
| Rename window | `Ctrl+b` `,` |
| Detach from tmux (keep session) | `Ctrl+b` `d` |

> 💡 **Termius Tip**: Configure Snippets for one-tap window switching:
> - Name `W1`, Content: `\x02 1` (sends Ctrl+b 1)
> - Name `W2`, Content: `\x02 2`
> - Name `W3`, Content: `\x02 3`

## Commands Reference

| Command | Description |
|---------|-------------|
| `maw init [N]` | Initialize with N agents (default: 4). **Must run inside tmux.** |
| `maw dispatch "<task>" [id]` | Send task to idle agent (or specific id). Creates tmux window. |
| `maw status` | Show status board (one-shot) |
| `maw watch` | Continuously refresh status board |
| `maw merge <id>` | Merge agent branch into main |
| `maw reset <id>` | Reset agent worktree to main |
| `maw kill <id>` | Kill agent process and close tmux window |
| `maw menu` | Interactive menu (for status window) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAW_LANG` | `en` | Language: `en` or `zh` |
| `MAW_MAX_AGENTS` | `4` | Maximum agents |
| `MAW_WATCH_INTERVAL` | `2` | Status refresh interval (seconds) |

## Architecture

```
iPhone (Termius)
  └── Tailscale VPN
        └── SSH → WSL2
              └── tmux session "maw"
                    ├── Window 1 (master): Claude Code (user interaction)
                    ├── Window 2 (status): maw watch
                    └── Window N (agent-X): Claude Code (parallel tasks)
                         └── git worktree + branch agent/N
```

## Testing

```bash
cd /path/to/maw
bash tests/run_all.sh
```

## Troubleshooting

### "Not running inside tmux"
Run `tmux new-session -s maw` first, then execute maw commands inside the session.

### "No idle agents available"
All agents are busy. Wait for one to finish, or run `maw status` to check.

### tmux session lost
Sessions persist until WSL2 restarts. Reconnect with `tmux attach -t maw`. If WSL2 shut down, restart it and recreate the session.

### SSH connection refused
- Check `sudo service ssh status`
- Verify Tailscale is connected: `sudo tailscale status`
- Check firewall: `sudo ss -tlnp | grep 22`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## License

[MIT](LICENSE)
