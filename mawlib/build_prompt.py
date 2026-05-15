#!/usr/bin/env python3
"""Render the MAW agent prompt template.

Used by both the bash CLI (`bin/maw dispatch`) and the Python runner
(`mawlib/agent_runner.py`) so the workflow rules live in exactly one file:
`mawlib/agent_prompt.tmpl`.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

TEMPLATE_PATH = Path(__file__).parent / "agent_prompt.tmpl"


def render(agent_id: int, worktree: str, task: str) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    return template.format(agent_id=agent_id, worktree=worktree, task=task)


def main() -> int:
    parser = argparse.ArgumentParser(description="Render the MAW agent prompt.")
    parser.add_argument("agent_id", type=int)
    parser.add_argument("worktree")
    parser.add_argument("task")
    args = parser.parse_args()
    sys.stdout.write(render(args.agent_id, args.worktree, args.task))
    return 0


if __name__ == "__main__":
    sys.exit(main())
