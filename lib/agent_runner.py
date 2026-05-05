#!/usr/bin/env python3
"""Agent Runner - Spawn and manage agent subprocesses."""

import subprocess
import os
import signal
from pathlib import Path

MAW_DIR = Path(__file__).parent.parent.resolve()


def run_agent(agent_id: int, task: str, project_dir: str) -> subprocess.Popen:
    """Run claude in agent worktree as background process."""
    worktree = Path(project_dir) / ".agents" / f"agent-{agent_id}"
    log_file = MAW_DIR / ".maw" / "logs" / f"agent-{agent_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # Script that runs claude then marks review-request
    script = f'''#!/bin/bash
cd "{worktree}"
claude "{task.replace('"', '\\"')}"
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
