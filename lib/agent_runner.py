#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
import signal
from pathlib import Path

MAW_DIR = Path(os.getcwd())

CLAUDE_MD_CONTENT = """# Agent Rules
你是 MAW 并行工作代理。你当前在独立的 git worktree 中工作。

## 工作流程
1. 理解分配的任务，在 worktree 中完成编码
2. 完成后执行 `git add -A && git commit -m "feat: <任务简述>"`
3. 运行项目测试（自动检测：npm test / cargo test / pytest / go test）
4. 如果测试全部通过：正常退出（输入 exit），系统会自动标记 review-request
5. 如果测试未通过：分析失败原因，修复 bug，重新 commit，再次测试，直到通过
6. 不要合并到 main，不要操作其他 agent 的 worktree
"""


def _write_claude_md(worktree: Path) -> None:
    claude_dir = worktree / ".claude"
    claude_dir.mkdir(parents=True, exist_ok=True)
    claude_md = claude_dir / "CLAUDE.md"
    claude_md.write_text(CLAUDE_MD_CONTENT, encoding="utf-8")


def run_agent(agent_id: int, task: str, project_dir: str, agent_config: dict = None) -> subprocess.Popen:
    """Run claude in agent worktree as background process."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = Path(project_dir) / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    config = agent_config or {"auto_pull": False, "auto_test": True}

    if config.get("auto_pull"):
        subprocess.run(
            ["git", "-C", str(worktree), "pull", "origin", "main"],
            capture_output=True,
        )

    _write_claude_md(worktree)

    # Script that runs claude then marks review-request
    script = f'''#!/bin/bash
cd "{worktree}"
claude "任务：{task.replace('"', '\\"')}"
maw review-request {agent_id}
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
