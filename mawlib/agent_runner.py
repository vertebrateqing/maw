#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
import signal
import sys
from pathlib import Path

from mawlib.build_prompt import render as render_prompt

MAW_INSTALL_DIR = Path(__file__).parent.parent.resolve()


def run_agent(agent_id: int, task: str, project_dir: str, agent_config: dict = None) -> subprocess.Popen:
    """Run claude in agent worktree as background process via agent_wrapper."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = Path(project_dir) / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    enhanced_task = render_prompt(agent_id, str(worktree), task)

    wrapper = MAW_INSTALL_DIR / "lib" / "agent_wrapper.py"

    proc = subprocess.Popen(
        [sys.executable, str(wrapper), enhanced_task, str(worktree), str(log_file)],
        start_new_session=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
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
