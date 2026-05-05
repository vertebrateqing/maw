# MAW - 多代理工作区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW 让你能够**用 iPhone 远程控制 Claude Code**，并实现多代理并行开发。在独立的 git worktree 中同时运行多个 Claude Code 实例，从手机浏览器监控进度，并将工作合并回主分支。

> **v0.2.0** — 浏览器仪表盘：告别 tmux/Termius，直接用 Safari 访问。

> :globe_with_meridians: [English README](README.md)

## 功能

- :iphone: **iPhone 浏览器控制** — 用 Safari 访问仪表盘，无需安装 App
- :desktop_computer: **Web 终端** — 完整的 xterm.js 终端，运行主 Claude Code
- :arrows_counterclockwise: **会话持久化** — systemd 守护进程，断网也不断线
- :ocean: **流式输出** — 实时查看 Claude Code 的响应
- :robot: **多代理并行执行** — 将复杂任务拆分给多个 Claude Code 实例
- :deciduous_tree: **Git Worktree 隔离** — 每个代理在独立分支工作，互不冲突
- :bar_chart: **实时状态看板** — 在手机上监控所有代理状态
- :white_check_mark: **代码审查与合并** — GitHub 风格的 diff 查看器，一键批准/拒绝
- :lock: **默认安全** — Tailscale 网格 VPN + 仅本地绑定
- :earth_americas: **双语支持** — 英文和中文

## 架构

```
iPhone Safari
  └── Tailscale VPN
        └── HTTPS → WSL2:8080
              └── maw-server (Python 守护进程)
                    ├── PTY 主进程 ←→ WebSocket → xterm.js (浏览器)
                    ├── Agent N: 子进程 claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /diff, /approve, /reject, /kill)
                    └── SSE 广播器 (state.json 变更推送)
```

## 前置要求

- WSL2 (Ubuntu) 或 Linux/macOS + bash
- 你的项目必须是一个 git 仓库
- iPhone 上安装 Tailscale
- Python 3.10+ 和 Node.js 20+（开发时需要）

## 详细配置步骤

### 1. 安装依赖

在电脑端（WSL2）执行：

```bash
# 必需包
sudo apt-get update
sudo apt-get install -y jq git python3 python3-pip

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# 记下你的 Tailscale IP: 100.x.x.x
```

在 iPhone 上：
- 安装 [Tailscale](https://apps.apple.com/cn/app/tailscale/id1470499037)

### 2. 安装 MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# 加到 shell 配置里永久生效：
# echo 'export PATH="/path/to/maw/bin:$PATH"' >> ~/.bashrc
```

### 3. 配置 Python 环境

```bash
cd /path/to/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. 配置你的项目

进入**你自己的项目目录**（不是 maw 目录）：

```bash
cd /path/to/your/project

# 确保在 main 分支上
git checkout main

# 初始化 MAW，创建 4 个代理
maw init 4
```

这会创建 4 个代理、git worktree 和 `state.json`。

### 5. 启动 MAW 服务器

```bash
maw-server
```

或者用 systemd 保持持久运行：

```bash
# 复制 systemd 服务（将 %I 替换为你的用户名）
sed "s/%I/$USER/g" /path/to/maw/config/maw.service > /tmp/maw.service
sudo cp /tmp/maw.service /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 6. 从 iPhone 连接

1. iPhone 打开 **Tailscale**，连接网络
2. 打开 **Safari**，访问：`http://100.x.x.x:8080`（你的 WSL2 Tailscale IP）
3. 你应该看到 MAW 仪表盘：
   - 左侧：Web 终端（主 Claude Code）
   - 右侧：代理状态卡片

> :bulb: **技巧**：把页面添加到主屏幕，一键访问（分享 → 添加到主屏幕）

### 7. 日常使用 MAW

**在 Web 终端里**正常和 Claude Code 对话。遇到可并行的复杂任务时：

```
你：请实现用户认证模块，比较复杂，能分配给代理做吗？
Claude: 我会把任务派发给空闲代理。
```

Claude 会执行：`maw dispatch "实现用户认证模块"`

MAW 会：
1. 找一个空闲代理
2. 在代理的 worktree 里后台运行 `claude`
3. 将状态更新为 `running`
4. 把代理输出流式写入日志文件

**查看进度**，在浏览器仪表盘里：
- 代理卡片实时刷新状态（SSE 推送）
- 点击 "Kill" 终止运行中的代理
- 代理完成后，卡片显示 "Review" 状态

**审查并合并**：
- 在待审核卡片上点击 "Diff" 查看变更
- 点击 "Approve & Merge" 将代理分支合并到 main
- 点击 "Reject" 重置代理的 worktree

### 8. 断开和重连

**iPhone 端**：直接关闭 Safari，WSL2 上的服务器继续运行。

**之后重连**：打开 Safari，访问同样的地址。一切保持断开时的状态。

## 命令参考

| 命令 | 说明 |
|------|------|
| `maw init [N]` | 初始化 N 个代理（默认 4） |
| `maw dispatch "<任务>" [id]` | 派发任务给空闲代理（或指定 id） |
| `maw status` | 显示状态看板（单次） |
| `maw watch` | 持续刷新状态看板 |
| `maw review-request <id>` | 标记代理为待审核 |
| `maw approve <id>` | 审核通过并合并到 main |
| `maw reject <id>` | 拒绝并重置代理 |
| `maw diff <id>` | 查看代理的 git diff |
| `maw merge <id>` | 合并代理分支到 main |
| `maw reset <id>` | 重置代理 worktree 到 main |
| `maw kill <id>` | 终止代理进程 |
| `maw menu` | 交互式菜单 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAW_LANG` | `en` | 语言: `en` 或 `zh` |
| `MAW_MAX_AGENTS` | `4` | 最大代理数 |
| `MAW_WATCH_INTERVAL` | `2` | 状态刷新间隔（秒） |
| `MAW_PORT` | `8080` | 服务器端口 |

## 开发

修改前端：

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # 开发服务器
npm run build    # 构建到 ../static/
```

`static/` 目录里的构建产物已提交到 git，用户无需安装 Node.js 即可运行 MAW。

## 测试

```bash
cd /path/to/maw
bash tests/run_all.sh
```

## 常见问题

### "No idle agents available"
所有代理都在忙。等一个完成，或执行 `maw status` 查看状态。

### iPhone 无法访问服务器
- 检查 Tailscale 两端都已连接：`sudo tailscale status`
- 检查服务器在运行：`curl http://localhost:8080/api/status`
- 检查防火墙：`sudo ss -tlnp | grep 8080`

### 代理 worktree 冲突
执行 `maw reset <id>` 清理代理的 worktree，重新开始。

## 贡献

1. Fork 仓库
2. 创建功能分支: `git checkout -b feature/my-feature`
3. 编写代码和测试
4. 运行测试套件
5. 提交 Pull Request

## 许可证

[MIT](LICENSE)
