# MAW — 多代理工作区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20WSL2-blue.svg)](#前置要求)

MAW 让你能够**用 iPhone 远程控制 Claude Code**，并实现多代理并行开发。在独立的 git worktree 中同时运行多个 Claude Code 实例，从手机浏览器监控进度，并将工作合并回主分支。

> **v0.2.3** —— Agent 自动同步代码、推送到远程分支并退出。你在浏览器中审核 diff 并批准合并；也可随时发送后续修改指令。

> 🌐 [English README](README.md)

## 功能

- 📱 **iPhone 浏览器控制** —— Safari 访问仪表盘，无需安装 App
- 🤖 **多代理并行执行** —— 多个 Claude Code 实例同时处理不同任务
- 🌳 **Git Worktree 隔离** —— 每个代理在独立分支工作
- 🌊 **实时日志流** —— 实时查看 agent 的思考过程和工具调用
- ✅ **代码审查与合并** —— 查看 diff，一键批准合并到 main
- 💬 **持续对话** —— 对已完成的工作发送补充修改指令
- 🔄 **自动调度** —— 任务自动排队，空闲代理自动领取
- 📊 **实时状态看板** —— SSE 推送实时状态更新
- 🔒 **默认私有** —— 通过 Tailscale 网格 VPN 隔离公网

## 架构

```
iPhone Safari
  └── Tailscale VPN
        └── HTTP → host:8080
              └── maw-server (Python 守护进程)
                    ├── 自动调度器线程（队列 → 空闲代理）
                    ├── Agent N: 子进程 claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /messages, /dispatch, /diff, /approve, /continue)
                    └── SSE 广播器 (state.json 变更推送)
```

## 前置要求

- POSIX 环境：Linux、macOS 或 WSL2 (Ubuntu) 均可
- 你的项目必须是一个 git 仓库
- Python **3.10+**
- 已安装并登录 [`claude`](https://docs.claude.com/en/docs/claude-code/overview) CLI（`claude --version` 可正常输出）
- iPhone 上安装 [Tailscale](https://tailscale.com/)（仅远程访问需要）

### 安装系统依赖

**Linux (Debian / Ubuntu)：**

```bash
sudo apt-get update
sudo apt-get install -y jq git python3 python3-venv python3-pip
```

**macOS (Homebrew)：**

```bash
brew install jq git python@3.12
```

**Tailscale（仅在需要远程访问时配置）：**

```bash
# Linux
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# macOS
brew install --cask tailscale
open -a Tailscale
```

iPhone 上安装 [Tailscale 客户端](https://apps.apple.com/cn/app/tailscale/id1470499037)并用同一账号登录。

## 安装步骤

### 1. 安装 MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw

# 把 CLI 加入 PATH（macOS + zsh 用户改成 ~/.zshrc）
echo 'export PATH="'$PWD'/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 2. 配置 Python 环境

```bash
cd /path/to/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. 启动 MAW 服务器

进入**你自己的项目目录**（不是 maw 目录），运行：

```bash
cd /path/to/your/project
maw-server
```

首次启动会自动初始化 4 个代理、对应的 git worktree 和 `state.json`。如果想换成其他数量：

```bash
maw init 10   # 10 个并发代理
```

### 4. 从 iPhone 连接

1. iPhone 打开 **Tailscale**，连接到你的网络
2. 打开 **Safari**，访问 `http://<你的 Tailscale IP>:8080`（用 `tailscale ip -4` 查询）
3. 看到 MAW 仪表盘

> 💡 **技巧**：把页面添加到主屏幕，一键访问。

## 后台守护进程

### Linux (systemd)

```bash
sed "s/%I/$USER/g" /path/to/maw/config/maw.service | sudo tee /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable --now maw
```

### macOS / 跨平台 (tmux)

```bash
tmux new -s maw -d 'cd /path/to/your/project && maw-server'
# 之后用 tmux attach -t maw 重新接管
```

如需 macOS 原生守护进程，可在 `~/Library/LaunchAgents/com.maw.server.plist` 创建一个 LaunchAgent，把 `ProgramArguments` 指向 `bin/maw-server`，`WorkingDirectory` 指向你的项目目录，然后 `launchctl load`。

## 日常使用

**派发任务：**

1. 在 **消息输入框** 中输入任务描述
2. 点击 **派发** 发送给空闲代理
3. 没有空闲代理时，任务自动进入 **排队队列**
4. **自动调度器** 在代理空闲时自动分配

**查看进度：**

- 代理卡片实时刷新状态：`idle`、`running`、`pending_review`
- 点击 **Log** 查看代理实时输出
- 点击 **Kill** 终止运行中的代理

**审查并合并：**

- 点击 **Diff** 查看变更
- 点击 **Approve & Merge** 将代理分支快进合并到 main
- 如需修改，在输入框中输入补充指令，点击 **继续**

## 命令参考

| 命令 | 说明 |
|---|---|
| `maw init [N]` | 初始化 N 个代理（默认 4） |
| `maw status` | 显示一次状态看板 |
| `maw watch` | 持续刷新状态看板 |
| `maw dispatch <任务> [id]` | 派发任务到空闲代理（或指定 id） |
| `maw queue <内容>` | 把任务放入排队队列 |
| `maw queue-list` | 列出排队中的任务 |
| `maw queue-update <id> <内容>` | 修改排队任务的内容 |
| `maw queue-remove <id>` | 删除排队任务 |
| `maw diff <id>` | 查看 `git diff main…agent/<id>` |
| `maw review-request <id>` | 标记代理为 `pending_review` |
| `maw approve <id>` | 审核通过并合并到 main |
| `maw reject <id>` | 拒绝并重置代理 worktree |
| `maw merge <id>` | `approve` 的别名（兼容旧用法） |
| `maw reset` | 全局重置：终止所有代理、清空日志、同步 main |
| `maw reset <id>` | 重置单个代理 worktree 到 main |
| `maw kill <id>` | 给代理进程发 SIGTERM |
| `maw config <id> <键> <值>` | 切换单个代理的配置项（如 `auto_test true`） |
| `maw menu` | 交互式菜单 |
| `maw version` | 输出 MAW 版本号 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MAW_LANG` | `en` | 界面语言：`en` 或 `zh` |
| `MAW_WATCH_INTERVAL` | `2` | `maw watch` 的刷新间隔（秒） |
| `MAW_PORT` | `8080` | 服务器端口 |

## 安全须知

`maw-server` 默认监听 `0.0.0.0:<port>`，让 Tailscale 网格内（以及局域网内）的设备都能访问。**它本身不带认证**。推荐两种部署方式：

- **仅通过 Tailscale 访问（推荐）**：依赖 Tailscale 把仪表盘隔离在公网之外；务必确认主机没有把 `8080` 端口转发出去。
- **本地访问 + SSH 隧道**：在客户端用 `ssh -L 8080:127.0.0.1:8080 user@host`，结合 `MAW_PORT` 或防火墙规则限制访问面。

切勿在没有任何认证反向代理的情况下把 `maw-server` 暴露到公网。

## 前端开发

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # Vite 开发服务器，热更新
npm run build    # 生产构建 → ../static/
```

`static/` 目录里的构建产物已提交到 git，最终用户无需安装 Node.js 即可运行 MAW。

## 运行测试

```bash
# Bash 单元测试
bash tests/run_all.sh

# Python API 测试
pytest tests/test_api.py
```

## 许可证

[MIT](LICENSE)
