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

## 前置要求

- WSL2 (Ubuntu) 或 Linux/macOS + bash
- 你的项目必须是一个 git 仓库
- iPhone 上安装 Termius 和 Tailscale

## 详细配置步骤

### 1. 安装依赖

在电脑端（WSL2）执行：

```bash
# 必需包
sudo apt-get update
sudo apt-get install -y tmux jq openssh-server git

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# 记下你的 Tailscale IP: 100.x.x.x
```

在 iPhone 上：
- 安装 [Tailscale](https://apps.apple.com/cn/app/tailscale/id1470499037)
- 安装 [Termius](https://apps.apple.com/cn/app/termius-ssh-client/id549039908)

### 2. 安装 MAW

```bash
git clone https://github.com/yourusername/maw.git
cd maw
export PATH="$PWD/bin:$PATH"
# 加到 shell 配置里永久生效：
# echo 'export PATH="/path/to/maw/bin:$PATH"' >> ~/.bashrc
```

### 3. 配置 SSH

```bash
# 确保 SSH 服务在运行
sudo service ssh start

# 复制 MAW 的 SSH 安全配置
sudo mkdir -p /etc/ssh/sshd_config.d
sudo cp config/sshd_config.example /etc/ssh/sshd_config.d/maw.conf
sudo sh -c 'grep -q "sshd_config.d" /etc/ssh/sshd_config || echo "Include /etc/ssh/sshd_config.d/*.conf" >> /etc/ssh/sshd_config'
sudo service ssh restart

# 为 iPhone 生成 SSH 密钥（如果没有）
ssh-keygen -t ed25519 -C "iphone-maw" -f ~/.ssh/iphone_maw
# 将公钥加入授权列表
cat ~/.ssh/iphone_maw.pub >> ~/.ssh/authorized_keys
```

### 4. 配置 tmux

```bash
cp config/tmux.conf ~/.tmux.conf
```

### 5. 配置你的项目

进入**你自己的项目目录**（不是 maw 目录）：

```bash
cd /path/to/your/project

# 确保在 main 分支上
git checkout main

# 启动名为 "maw" 的 tmux 会话
tmux new-session -s maw
```

> ⚠️ **重要**：必须先进入 tmux 再运行 `maw init`。MAW 会检查 `TMUX` 环境变量，不在 tmux 内会拒绝执行。

在 tmux 会话内初始化 MAW：

```bash
maw init 4
```

这会创建 4 个代理、git worktree 和 `state.json`。

### 6. 创建状态窗口

建立窗口布局。在 tmux 会话内：

```bash
# 你当前在 window 1，重命名为 "master"：
# 按 Ctrl+b , 然后输入新名字
Ctrl+b ,
# 输入: master
# 按回车

# 创建 window 2 用来看状态板
Ctrl+b c
# 创建了新窗口，重命名为 "status"：
Ctrl+b ,
# 输入: status

# 在 window 2 里运行 watch
maw watch
```

现在的布局：

```
Window 1 (master):  主 Claude Code 会话
Window 2 (status):  maw watch（每 2 秒自动刷新）
```

用 `Ctrl+b 1` 和 `Ctrl+b 2` 切换窗口。

### 7. 在 Master 窗口启动 Claude Code

切换到 window 1（`Ctrl+b 1`），启动 Claude Code：

```bash
claude
```

### 8. 从 iPhone 连接

1. iPhone 打开 **Tailscale**，连接网络
2. 打开 **Termius**，添加主机：
   - 别名: `WSL2 MAW`
   - 主机: `100.x.x.x`（你的 WSL2 Tailscale IP）
   - 端口: `22`
   - 用户名: 你的 WSL2 用户名
   - 密码: 关闭
   - 私钥: 导入 `~/.ssh/iphone_maw`（需先传到 iPhone）
3. 连接
4. 连上后，attach 到 tmux 会话：
   ```bash
   tmux attach -t maw
   ```

> 💡 **技巧**：可在 Termius 里配置自动执行 `tmux attach -t maw`。进入主机设置 → 启动 → 片段，添加该命令。

### 9. 日常使用 MAW

**在 master 窗口**（`Ctrl+b 1`）正常和 Claude Code 对话。遇到可并行的复杂任务时：

```
你：请实现用户认证模块，比较复杂，能分配给代理做吗？
Claude: 我会把任务派发给空闲代理。请执行：maw dispatch "实现用户认证模块"
```

**执行派发命令**（仍在 master 窗口）：
```bash
maw dispatch "实现用户认证模块"
```

MAW 会：
1. 找一个空闲代理
2. 新建 tmux 窗口（如 `Window 3: agent-1`）
3. 在该窗口内启动 `claude` 执行任务
4. 将状态更新为 `running`

**查看进度**，切到 window 2：
```bash
Ctrl+b 2
```

看到实时状态看板：
```
┌─ MAW 状态看板 ──────────────────────────────────────────────┐
│ ID  状态     分支      任务                    时间        │
│ ────────────────────────────────────────────────────────────│
│ 1   🔵 运行中  agent/1  实现用户认证模块...      03:12       │
│ 2   ⚪ 空闲    agent/2  -                                    │
│ 3   ⚪ 空闲    agent/3  -                                    │
│ 4   ⚪ 空闲    agent/4  -                                    │
└─────────────────────────────────────────────────────────────┘
[4 个代理 | 1 运行中 | 0 已完成 | 3 空闲]
```

**查看代理实时输出**：
```bash
Ctrl+b 3   # 切换到 agent-1 窗口看 Claude 的实时输出
```

**代理完成后**，回到 master（`Ctrl+b 1`）合并：
```bash
maw merge 1
```

这会将 `agent/1` 分支合并到 `main`，并重置代理为空闲状态。

### 10. 断开和重连

**iPhone 端**：直接关闭 Termius，tmux 会话在 WSL2 上继续运行。

**之后重连**：
```bash
tmux attach -t maw
```

一切保持断开时的状态。

## iPhone tmux 快捷键

| 操作 | 按键 |
|------|------|
| 切换到窗口 N | `Ctrl+b` `1`（或 `2`、`3`、`4`...） |
| 列出所有窗口 | `Ctrl+b` `w` |
| 下一个窗口 | `Ctrl+b` `n` |
| 上一个窗口 | `Ctrl+b` `p` |
| 最近窗口 | `Ctrl+b` `l` |
| 新建窗口 | `Ctrl+b` `c` |
| 关闭窗口 | `Ctrl+b` `x` |
| 重命名窗口 | `Ctrl+b` `,` |
| 脱离 tmux（保持会话） | `Ctrl+b` `d` |

> 💡 **Termius 技巧**：配置 Snippets 一键切换窗口：
> - 名称 `W1`，内容: `\x02 1`（发送 Ctrl+b 1）
> - 名称 `W2`，内容: `\x02 2`
> - 名称 `W3`，内容: `\x02 3`

## 命令参考

| 命令 | 说明 |
|------|------|
| `maw init [N]` | 初始化 N 个代理（默认 4）。**必须在 tmux 内执行。** |
| `maw dispatch "<任务>" [id]` | 派发任务给空闲代理（或指定 id）。自动创建 tmux 窗口。 |
| `maw status` | 显示状态看板（单次） |
| `maw watch` | 持续刷新状态看板 |
| `maw merge <id>` | 合并代理分支到 main |
| `maw reset <id>` | 重置代理 worktree 到 main |
| `maw kill <id>` | 终止代理进程并关闭 tmux 窗口 |
| `maw menu` | 交互式菜单（适合 status 窗口） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAW_LANG` | `en` | 语言: `en` 或 `zh` |
| `MAW_MAX_AGENTS` | `4` | 最大代理数 |
| `MAW_WATCH_INTERVAL` | `2` | 状态刷新间隔（秒） |

## 架构

```
iPhone (Termius)
  └── Tailscale VPN
        └── SSH → WSL2
              └── tmux session "maw"
                    ├── Window 1 (master): Claude Code (用户交互)
                    ├── Window 2 (status): maw watch
                    └── Window N (agent-X): Claude Code (并行任务)
                         └── git worktree + 分支 agent/N
```

## 测试

```bash
cd /path/to/maw
bash tests/run_all.sh
```

## 常见问题

### "Not running inside tmux"
先执行 `tmux new-session -s maw`，再在会话内运行 maw 命令。

### "No idle agents available"
所有代理都在忙。等一个完成，或执行 `maw status` 查看状态。

### tmux 会话丢失
会话会持续到 WSL2 重启。用 `tmux attach -t maw` 恢复。如果 WSL2 已关闭，重启后重新创建会话。

### SSH 连接被拒绝
- 检查 `sudo service ssh status`
- 确认 Tailscale 已连接：`sudo tailscale status`
- 检查防火墙：`sudo ss -tlnp | grep 22`

## 贡献

1. Fork 仓库
2. 创建功能分支: `git checkout -b feature/my-feature`
3. 编写代码和测试
4. 运行测试套件
5. 提交 Pull Request

## 许可证

[MIT](LICENSE)
