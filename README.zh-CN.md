# MAW - 多代理工作区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW 让你能够**用 iPhone 远程控制 Claude Code**，并实现多代理并行开发。在独立的 git worktree 中同时运行多个 Claude Code 实例，从手机上监控进度，并将工作合并回主分支。

> 🌐 [English README](README.md)

## 功能

- 📱 **iPhone 远程开发** - 通过 SSH 随时随地控制 Claude Code
- 🔄 **会话持久化** - 锁屏、断网都不影响，会话一直保留
- 🌊 **流式输出** - 实时查看 Claude Code 的响应
- 🤖 **多代理并行执行** - 将复杂任务拆分给多个 Claude Code 实例
- 🌳 **Git Worktree 隔离** - 每个代理在独立分支工作，互不冲突
- 📊 **实时状态看板** - 在手机上监控所有代理状态
- 🔒 **默认安全** - Tailscale 网格 VPN + SSH 密钥认证
- 🌍 **双语支持** - 英文和中文

## 快速开始

### 1. 安装 MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
```

### 2. 安装依赖

- **Tailscale** - [下载安装](https://tailscale.com/download) 电脑端和 iPhone 端
- **tmux** - `sudo apt-get install tmux`（通常已预装）
- **jq** - `sudo apt-get install jq`
- **OpenSSH server** - `sudo apt-get install openssh-server`
- **Termius** - [App Store](https://apps.apple.com/cn/app/termius-ssh-client/id549039908)

### 3. 配置 Tailscale (WSL2)

```bash
# 在 WSL2 中
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# 记下你的 Tailscale IP: 100.x.x.x
```

### 4. 配置 SSH

```bash
# 复制示例配置并编辑
sudo cp config/sshd_config.example /etc/ssh/sshd_config.d/maw.conf
# 编辑配置使用你的 Tailscale IP 或保持 0.0.0.0
sudo systemctl restart ssh

# 将 iPhone 的 SSH 公钥添加到 authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

### 5. 配置 tmux

```bash
cp config/tmux.conf ~/.tmux.conf
```

### 6. 初始化项目

```bash
cd /path/to/your/project
git checkout -b main  # 确保有 main 分支
maw init 4            # 创建 4 个代理
```

### 7. 从 iPhone 连接

1. 打开 **Tailscale** app，连接到你的网络
2. 打开 **Termius**，添加新主机：
   - 主机: `100.x.x.x`（你的 WSL2 Tailscale IP）
   - 端口: `22`
   - 用户名: 你的 WSL2 用户名
   - 密钥: 你的 SSH 私钥
3. 连接！你会自动进入 tmux。

### 8. 使用 MAW

```bash
# 在 tmux window 1 (master) 中与 Claude Code 交互
$ claude

# 让 Claude 派发子任务：
# "派发 '实现用户认证' 给代理"
# 然后运行：
$ maw dispatch "实现用户认证"

# 在 window 2 查看状态
# 按 Ctrl+b 2 切换
$ maw watch

# 当代理 2 完成后，合并它的工作
$ maw merge 2
```

## 命令

| 命令 | 说明 |
|------|------|
| `maw init [N]` | 初始化 N 个代理（默认: 4） |
| `maw dispatch "<任务>" [id]` | 发送任务到空闲代理 |
| `maw status` | 显示状态看板 |
| `maw watch` | 持续刷新 |
| `maw merge <id>` | 合并代理分支到 main |
| `maw reset <id>` | 重置代理到 main |
| `maw kill <id>` | 终止代理进程 |
| `maw menu` | 交互式菜单 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAW_LANG` | `en` | 语言: `en` 或 `zh` |
| `MAW_MAX_AGENTS` | `4` | 最大代理数 |
| `MAW_WATCH_INTERVAL` | `2` | 状态刷新间隔（秒） |

## tmux 窗口布局

```
Window 1 (Ctrl+b 1): master  - 主 Claude Code 会话
Window 2 (Ctrl+b 2): status  - 监控 maw 状态看板
Window 3 (Ctrl+b 3): agent-1 - Claude Code 代理 1
Window 4 (Ctrl+b 4): agent-2 - Claude Code 代理 2
...
```

## 架构

```
iPhone (Termius)
  └── Tailscale VPN
        └── SSH → WSL2
              └── tmux session "maw"
                    ├── master: Claude Code (用户交互)
                    ├── status: maw watch
                    └── agent-N: Claude Code (并行任务)
                         └── git worktree + 分支 agent/N
```

## 测试

```bash
bash tests/run_all.sh
```

## 贡献

1. Fork 仓库
2. 创建功能分支: `git checkout -b feature/my-feature`
3. 编写代码和测试
4. 运行测试套件
5. 提交 Pull Request

## 许可证

[MIT](LICENSE)
