# MAW Setup Guide

Detailed setup instructions for WSL2 + iPhone remote development.

## Table of Contents

1. [WSL2 Network Setup](#wsl2-network-setup)
2. [Tailscale Installation](#tailscale-installation)
3. [SSH Server Configuration](#ssh-server-configuration)
4. [tmux Configuration](#tmux-configuration)
5. [iPhone Termius Configuration](#iphone-termius-configuration)
6. [SSH Key Generation](#ssh-key-generation)
7. [Troubleshooting](#troubleshooting)

## WSL2 Network Setup

WSL2 uses a virtual network adapter. Tailscale works inside WSL2:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start and authenticate
sudo tailscale up

# Check your IP
tailscale ip -4
# Output: 100.x.x.x
```

## Tailscale Installation

### Computer (WSL2)

Already covered above. Ensure `tailscaled` is running:

```bash
sudo systemctl enable tailscaled
sudo systemctl start tailscaled
```

### iPhone

1. Download Tailscale from App Store
2. Sign in with the same account
3. Your WSL2 machine should appear in the device list

## SSH Server Configuration

### Install OpenSSH Server

```bash
sudo apt-get update
sudo apt-get install openssh-server
```

### Generate SSH Key Pair (on iPhone or computer)

```bash
# On your computer (for iPhone to use)
ssh-keygen -t ed25519 -C "iphone-maw" -f ~/.ssh/iphone_maw

# Copy public key to authorized_keys
cat ~/.ssh/iphone_maw.pub >> ~/.ssh/authorized_keys
```

### Configure sshd

```bash
sudo cp config/sshd_config.example /etc/ssh/sshd_config.d/maw.conf
sudo systemctl restart ssh
```

### Test SSH locally

```bash
ssh -i ~/.ssh/iphone_maw localhost
```

## tmux Configuration

```bash
cp config/tmux.conf ~/.tmux.conf
```

### Start tmux session

```bash
tmux new-session -s maw
```

## iPhone Termius Configuration

### Import SSH Key

1. In Termius, go to Keychain
2. Add Key -> Import from file
3. Transfer `~/.ssh/iphone_maw` private key to iPhone (via AirDrop, email, etc.)
4. Import the key

### Create Host

1. Hosts -> New Host
2. Alias: "WSL2 MAW"
3. Hostname: `100.x.x.x` (your Tailscale IP)
4. Port: `22`
5. Username: your WSL2 username
6. Key: select the imported key

### Snippets (Optional but Recommended)

Create snippets for common tmux commands:
- Name: "w1", Content: `\x02 1` (Ctrl+b 1)
- Name: "w2", Content: `\x02 2` (Ctrl+b 2)
- Name: "new", Content: `\x02 c` (Ctrl+b c)

## Troubleshooting

### Cannot connect via Tailscale IP

```bash
# Check tailscale is running
sudo tailscale status

# Check sshd is listening
sudo ss -tlnp | grep 22
```

### tmux session lost on disconnect

This is normal. Reconnect with:
```bash
tmux attach -t maw
```

### Agent process killed unexpectedly

Check if WSL2 is sleeping. Prevent with:
```bash
# In Windows PowerShell (admin)
powershell.exe -Command "wsl.exe -d Ubuntu -e bash -c 'while true; do sleep 60; done'" &
```

### Locale issues

```bash
# Add to ~/.bashrc
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```
