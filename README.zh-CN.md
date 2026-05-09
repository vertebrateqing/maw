# MAW - 多代理工作区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW 让你能够**用 iPhone 远程控制 Claude Code**，并实现多代理并行开发。在独立的 git worktree 中同时运行多个 Claude Code 实例，从手机浏览器监控进度，并将工作合并回主分支。

> **v0.2.2** -- Agent 自动同步代码、推送到远程分支并退出。你在浏览器中审核 diff 并批准合并。还可以随时发送后续修改指令。

> :globe_with_meridians: [English README](README.md)

## 功能

- :iphone: **iPhone 浏览器控制** -- Safari 访问仪表盘，无需安装 App
- :robot: **多代理并行执行** -- 多个 Claude Code 实例同时处理不同任务
- :deciduous_tree: **Git Worktree 隔离** -- 每个代理在独立分支工作
- :ocean: **实时日志流** -- 实时查看 agent 的思考过程和工具调用
- :white_check_mark: **代码审查与合并** -- 查看 diff，一键批准合并到 main
- :speech_balloon: **持续对话** -- 对已完成的工作发送补充修改指令
- :arrows_counterclockwise: **自动调度** -- 任务自动排队，空闲时代理自动领取
- :bar_chart: **实时状态看板** -- SSE 推送实时状态更新
- :lock: **默认安全** -- Tailscale 网格 VPN + 仅本地绑定

## 架构

```
iPhone Safari
  └── Tailscale VPN
        └── HTTP → WSL2:8080
              └── maw-server (Python 守护进程)
                    ├── 自动调度器线程（队列 → 空闲代理）
                    ├── Agent N: 子进程 claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /messages, /dispatch, /diff, /approve, /continue)
                    └── SSE 广播器 (state.json 变更推送)
```

## 前置要求

- WSL2 (Ubuntu) 或 Linux/macOS + bash
- 你的项目必须是一个 git 仓库
- iPhone 上安装 Tailscale
- Python 3.10+

## 配置步骤

### 1. 安装依赖

```bash
sudo apt-get update
sudo apt-get install -y jq git python3 python3-pip

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

iPhone 上：安装 [Tailscale](https://apps.apple.com/cn/app/tailscale/id1470499037)。

### 2. 安装 MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# 加到 shell 配置永久生效：
# echo 'export PATH="/path/to/maw/bin:$PATH"' >> ~/.bashrc
```

### 3. 配置 Python 环境

```bash
cd /path/to/maw
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. 启动 MAW 服务器

进入**你自己的项目目录**（不是 maw 目录），运行：

```bash
cd /path/to/your/project
maw-server
```

首次运行自动初始化，创建 4 个代理、git worktree 和 `state.json`。

或者用 systemd 保持持久运行：

```bash
sed "s/%I/$USER/g" /path/to/maw/config/maw.service | sudo tee /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 5. 从 iPhone 连接

1. iPhone 打开 **Tailscale**，连接网络
2. 打开 **Safari**，访问 `http://100.x.x.x:8080`（WSL2 Tailscale IP）
3. 看到 MAW 仪表盘

> :bulb: **技巧**：把页面添加到主屏幕，一键访问

## 日常使用

**在浏览器仪表盘中输入任务：**

1. 在 **消息输入框** 中输入任务描述
2. 点击 **派发** 发送任务
3. 没有空闲代理时，任务自动进入 **排队队列**
4. **自动调度器** 在代理空闲时自动分配

**查看进度：**
- 代理卡片实时刷新状态：空闲、运行中、待审核
- 点击 **Log** 查看代理实时输出流
- 点击 **Kill** 终止运行中的代理

**审查并合并：**
- 点击 **Diff** 查看变更
- 点击 **Approve & Merge** 将代理分支合并到 main
- 如需修改，在输入框中输入补充指令，点击 **继续**

## 命令参考

| 命令 | 说明 |
|------|------|
| `maw init [N]` | 初始化 N 个代理（默认 4） |
| `maw status` | 显示状态看板 |
| `maw watch` | 持续刷新状态看板 |
| `maw approve <id>` | 审核通过并合并到 main |
| `maw diff <id>` | 查看代理的 git diff |
| `maw reset <id>` | 重置代理 worktree 到 main |
| `maw kill <id>` | 终止代理进程 |
| `maw queue <content>` | 添加任务到队列 |
| `maw menu` | 交互式菜单 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAW_LANG` | `en` | 语言: `en` 或 `zh` |
| `MAW_MAX_AGENTS` | `4` | 最大代理数 |
| `MAW_WATCH_INTERVAL` | `2` | 刷新间隔（秒） |
| `MAW_PORT` | `8080` | 服务器端口 |

## 开发

```bash
cd /path/to/maw/frontend
npm install
npm run dev      # 开发服务器
npm run build    # 构建到 ../static/
```

`static/` 目录里的构建产物已提交到 git，用户无需安装 Node.js 即可运行 MAW。

## 许可证

[MIT](LICENSE)
