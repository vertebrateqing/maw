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

## Quick Start

### 1. Install MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
```

### 2. Install Dependencies

- **Tailscale** - [Install](https://tailscale.com/download) on your computer and iPhone
- **tmux** - `sudo apt-get install tmux` (usually pre-installed)
- **jq** - `sudo apt-get install jq`
- **OpenSSH server** - `sudo apt-get install openssh-server`
- **Termius** - [App Store](https://apps.apple.com/us/app/termius-ssh-client/id549039908)

### 3. Configure Tailscale (WSL2)

```bash
# In WSL2
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note your Tailscale IP: 100.x.x.x
```

### 4. Configure SSH

```bash
# Copy the example config and edit
sudo cp config/sshd_config.example /etc/ssh/sshd_config.d/maw.conf
# Edit to use your Tailscale IP or keep 0.0.0.0
sudo systemctl restart ssh

# Add your iPhone's SSH key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

### 5. Configure tmux

```bash
cp config/tmux.conf ~/.tmux.conf
```

### 6. Initialize Your Project

```bash
cd /path/to/your/project
git checkout -b main  # Ensure you have a main branch
maw init 4            # Create 4 agents
```

### 7. Connect from iPhone

1. Open **Tailscale** app, connect to your network
2. Open **Termius**, add a new host:
   - Host: `100.x.x.x` (your WSL2 Tailscale IP)
   - Port: `22`
   - Username: your WSL2 username
   - Key: your SSH private key
3. Connect! You'll be dropped into tmux.

### 8. Use MAW

```bash
# In tmux window 1 (master), talk to Claude Code
$ claude

# Ask Claude to dispatch a sub-task:
# "Dispatch 'Implement user authentication' to an agent"
# Then run:
$ maw dispatch "Implement user authentication"

# Check status in window 2
# Press Ctrl+b 2 to switch
$ maw watch

# When agent 2 finishes, merge its work
$ maw merge 2
```

## Commands

| Command | Description |
|---------|-------------|
| `maw init [N]` | Initialize with N agents (default: 4) |
| `maw dispatch "<task>" [id]` | Send task to idle agent |
| `maw status` | Show status board |
| `maw watch` | Continuous refresh |
| `maw merge <id>` | Merge agent branch into main |
| `maw reset <id>` | Reset agent to main |
| `maw kill <id>` | Kill agent process |
| `maw menu` | Interactive menu |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAW_LANG` | `en` | Language: `en` or `zh` |
| `MAW_MAX_AGENTS` | `4` | Maximum agents |
| `MAW_WATCH_INTERVAL` | `2` | Status refresh interval (seconds) |

## tmux Window Layout

```
Window 1 (Ctrl+b 1): master  - Main Claude Code session
Window 2 (Ctrl+b 2): status  - Watch maw status board
Window 3 (Ctrl+b 3): agent-1 - Claude Code agent 1
Window 4 (Ctrl+b 4): agent-2 - Claude Code agent 2
...
```

## Architecture

```
iPhone (Termius)
  └── Tailscale VPN
        └── SSH → WSL2
              └── tmux session "maw"
                    ├── master: Claude Code (user interaction)
                    ├── status: maw watch
                    └── agent-N: Claude Code (parallel tasks)
                         └── git worktree + branch agent/N
```

## Testing

```bash
bash tests/run_all.sh
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## License

[MIT](LICENSE)
