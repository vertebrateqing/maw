# MAW - 多代理工作区

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MAW 让你能够**用 iPhone 远程控制 Claude Code**，并实现多代理并行开发。在独立的 git worktree 中同时运行多个 Claude Code 实例，从手机浏览器监控进度，并将工作合并回主分支。

> **v0.2.1** -- 去中心化架构：所有代理都是平等的。通过浏览器仪表盘输入任务，自动排队，并分发给空闲代理。

> :globe_with_meridians: [English README](README.md)

## 功能

- :iphone: **iPhone 浏览器控制** -- 用 Safari 访问仪表盘，无需安装 App
- :arrows_counterclockwise: **会话持久化** -- systemd 守护进程，断网也不断线
- :ocean: **流式输出** -- 实时查看 Claude Code 的响应
- :robot: **多代理并行执行** -- 将复杂任务拆分给多个 Claude Code 实例
- :deciduous_tree: **Git Worktree 隔离** -- 每个代理在独立分支工作，互不冲突
- :bar_chart: **实时状态看板** -- 在手机上监控所有代理状态
- :white_check_mark: **代码审查与合并** -- GitHub 风格的 diff 查看器，一键批准/拒绝
- :lock: **默认安全** -- Tailscale 网格 VPN + 仅本地绑定
- :earth_americas: **双语支持** -- 英文和中文

## 架构

```
iPhone Safari
  └── Tailscale VPN
        └── HTTPS → WSL2:8080
              └── maw-server (Python 守护进程)
                    ├── 启动时自动初始化
                    ├── 自动调度器线程（队列 → 空闲代理）
                    ├── Agent N: 子进程 claude → .maw/logs/agent-N.log
                    ├── FastAPI HTTP API (/status, /messages, /dispatch, /diff, /approve)
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

### 4. 启动 MAW 服务器

进入**你自己的项目目录**（不是 maw 目录），直接运行：

```bash
cd /path/to/your/project
maw-server
```

服务器首次运行会自动初始化，创建 4 个代理、git worktree 和 `state.json`。

或者用 systemd 保持持久运行：

```bash
# 复制 systemd 服务（将 %I 替换为你的用户名）
sed "s/%I/$USER/g" /path/to/maw/config/maw.service > /tmp/maw.service
sudo cp /tmp/maw.service /etc/systemd/system/maw.service
sudo systemctl daemon-reload
sudo systemctl enable maw
sudo systemctl start maw
```

### 5. 从 iPhone 连接

1. iPhone 打开 **Tailscale**，连接网络
2. 打开 **Safari**，访问：`http://100.x.x.x:8080`（你的 WSL2 Tailscale IP）
3. 你应该看到 MAW 仪表盘：
   - 顶部：任务输入框
   - 主区域：代理状态卡片（空闲 / 运行中 / 待审核）
   - 右侧边栏：待处理任务队列

> :bulb: **技巧**：把页面添加到主屏幕，一键访问（分享 → 添加到主屏幕）

### 6. 日常使用 MAW

**在浏览器仪表盘中输入任务：**

1. 在 **消息输入框** 中输入任务描述
2. 点击 **派发** 发送任务
3. 如果没有空闲代理，任务会自动进入 **排队队列**
4. **自动调度器** 会在代理空闲时自动分配排队任务

**查看进度**，在浏览器仪表盘里：
- 代理卡片实时刷新状态（SSE 推送）：空闲、运行中、待审核
- 点击 "Kill" 终止运行中的代理
- **消息队列** 显示等待空闲代理的待处理任务

**审查并合并**：
- 在待审核卡片上点击 "Diff" 查看变更
- 点击 "Approve & Merge" 将代理分支合并到 main
- 点击 "Reject" 重置代理的 worktree

### 7. 断开和重连

**iPhone 端**：直接关闭 Safari，WSL2 上的服务器继续运行。

**之后重连**：打开 Safari，访问同样的地址。一切保持断开时的状态。

## 命令参考

| 命令 | 说明 |
|------|------|
| `maw init [N]` | 初始化 N 个代理（默认 4） |
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
所有代理都在忙。任务会自动排队，并在代理空闲时自动分发。

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
