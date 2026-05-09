#!/usr/bin/env python3
"""Agent Wrapper - Run claude in stream-json mode and write human-readable logs."""

import json
import subprocess
import sys
import os


def main():
    if len(sys.argv) < 4:
        print("Usage: agent_wrapper.py <task> <worktree> <log_file>", file=sys.stderr)
        sys.exit(1)

    task = sys.argv[1]
    worktree = sys.argv[2]
    log_file = sys.argv[3]

    # Ensure log directory exists
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    proc = subprocess.Popen(
        [
            "claude",
            "-p",
            "--verbose",
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--permission-mode", "auto",
            task,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=worktree,
    )

    with open(log_file, "w", buffering=1) as f:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                msg_type = data.get("type")

                if msg_type == "assistant" and "message" in data:
                    msg = data["message"]
                    for content in msg.get("content", []):
                        ct = content.get("type")
                        if ct == "thinking":
                            thinking = content.get("thinking", "").strip()
                            if thinking:
                                f.write(f"\n🤔 {thinking}\n\n")
                        elif ct == "tool_use":
                            name = content.get("name", "")
                            inp = content.get("input", {})
                            inp_str = json.dumps(inp, ensure_ascii=False)
                            if len(inp_str) > 200:
                                inp_str = inp_str[:200] + "..."
                            f.write(f"🔧 {name}({inp_str})\n")
                        elif ct == "text":
                            text = content.get("text", "").strip()
                            if text:
                                f.write(f"{text}\n")

                elif msg_type == "user" and "message" in data:
                    msg = data["message"]
                    for content in msg.get("content", []):
                        if content.get("type") == "tool_result":
                            result = content.get("content", "")
                            # Truncate long results
                            if isinstance(result, str) and len(result) > 500:
                                result = result[:500] + f"\n... ({len(result) - 500} more chars)"
                            f.write(f"✅ {result}\n")

            except json.JSONDecodeError:
                # Not JSON (e.g., stderr redirected to stdout), write raw
                f.write(f"{line}\n")

    exit_code = proc.wait()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
