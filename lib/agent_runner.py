#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
import signal
from pathlib import Path

MAW_DIR = Path(os.getcwd())


def _build_agent_prompt(task: str, agent_id: int, worktree: Path, project_dir: str) -> str:
    """Build the enhanced prompt with embedded workflow rules."""
    return f"""【MAW Agent 自治工作流 - 严格执行】

你当前在独立的 git worktree 中工作：
- 路径: {worktree}
- 分支: agent/{agent_id}
- 项目根目录: {project_dir}

请严格按照以下顺序执行，不要跳过任何步骤：

=== 阶段一：同步代码（编码前必须执行） ===
1. 执行 `git fetch origin main`
2. 执行 `git rebase origin/main`
   - 如有冲突，分析原因并解决，然后 `git rebase --continue`
   - 完成后 `git status` 确认工作区干净
3. 确认无误后再开始编码

=== 阶段二：完成任务 ===
{task}

=== 阶段三：提交与测试 ===
4. 编码完成后执行 `git add -A && git commit -m "feat: <任务简述>"`
5. 运行项目测试：
   - 若存在 package.json → `npm test`
   - 若存在 Cargo.toml → `cargo test`
   - 若存在 go.mod → `go test ./...`
   - 若存在 tests/ 或 pytest.ini → `pytest`
   - 否则尝试 `python3 -m unittest discover`
6. 如果测试失败：
   - 分析失败原因
   - 修复代码
   - 重新 commit
   - 再次运行测试
   - 重复直到全部通过

=== 阶段四：合入主干 ===
7. 再次执行 `git fetch origin main && git rebase origin/main`
8. 切换到项目根目录：`cd {project_dir}`
9. 执行 `git merge agent/{agent_id} --no-edit`
   - 如有冲突，解决后重新执行
10. 重置 worktree：`maw reset {agent_id}`
11. 输入 `exit` 正常退出

注意：每个 git 操作后建议用 `git status` 确认状态。如某步骤遇到无法解决的问题，报告具体错误后退出。"""


def run_agent(agent_id: int, task: str, project_dir: str, agent_config: dict = None) -> subprocess.Popen:
    """Run claude in agent worktree as background process."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = Path(project_dir) / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    enhanced_task = _build_agent_prompt(task, agent_id, worktree, project_dir)

    # Script that runs claude with the enhanced prompt
    script = f'''#!/bin/bash
cd "{worktree}"
claude "{enhanced_task.replace('"', '\\"')}"
'''

    proc = subprocess.Popen(
        ["bash", "-c", script],
        stdout=open(log_file, "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return proc


def kill_agent(agent_id: int) -> None:
    """Kill agent subprocess."""
    result = subprocess.run(
        ["pgrep", "-f", f"agent-{agent_id}"],
        capture_output=True,
        text=True,
    )
    for pid_str in result.stdout.strip().split("\n"):
        if pid_str:
            try:
                os.kill(int(pid_str), signal.SIGTERM)
            except ProcessLookupError:
                pass
