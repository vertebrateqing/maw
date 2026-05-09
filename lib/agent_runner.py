#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
import signal
import sys
from pathlib import Path

MAW_INSTALL_DIR = Path(__file__).parent.parent.resolve()


def _build_agent_prompt(task: str, agent_id: int, worktree: Path, project_dir: str) -> str:
    """Build the enhanced prompt with embedded workflow rules."""
    return f"""【MAW Agent 工作规则】

你当前在独立的 git worktree 中工作：
- 路径: {worktree}
- 分支: agent/{agent_id}

请严格按以下顺序完成工作：
1. 同步主分支：git fetch origin main，如有需要则 git rebase origin/main
2. 完成任务并提交：git add -A && git commit -m "feat: <简述>"
3. 运行项目测试，修复失败的测试用例，直到全部通过
4. 推送分支到远程：git push origin agent/{agent_id}
   - 如果 push 失败（例如远程 main 有更新），执行：
     git fetch origin main && git rebase origin/main && git push origin agent/{agent_id}
   - 如 rebase 产生冲突，解决冲突后继续 push
5. 正常退出，等待用户审核

任务：{task}

注意：
- 不要直接操作其他 agent 的 worktree
- 不要自行合并到 main 分支
- push 必须成功，不能遗漏
- 如遇无法解决的问题，报告错误后退出"""


def run_agent(agent_id: int, task: str, project_dir: str, agent_config: dict = None) -> subprocess.Popen:
    """Run claude in agent worktree as background process via agent_wrapper."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = Path(project_dir) / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    enhanced_task = _build_agent_prompt(task, agent_id, worktree, project_dir)

    wrapper = MAW_INSTALL_DIR / "lib" / "agent_wrapper.py"

    proc = subprocess.Popen(
        [sys.executable, str(wrapper), enhanced_task, str(worktree), str(log_file)],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
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
