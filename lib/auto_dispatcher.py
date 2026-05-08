#!/usr/bin/env python3
"""Auto-dispatcher: polls state.json and dispatches queued messages to idle agents."""

import json
import time
import threading
import subprocess
import os
from pathlib import Path
import datetime


class AutoDispatcher:
    def __init__(self, project_dir: str, interval: float = 2.0):
        self.project_dir = Path(project_dir)
        self.state_file = self.project_dir / ".maw" / "state.json"
        self.interval = interval
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

    def start(self):
        if self._thread is not None:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None

    def _run(self):
        while not self._stop_event.is_set():
            self._tick()
            self._stop_event.wait(self.interval)

    @staticmethod
    def _is_process_alive(pid: int) -> bool:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False

    def _has_diff(self, agent_id: int) -> bool:
        """Check if agent branch has unmerged commits."""
        try:
            result = subprocess.run(
                ["git", "diff", f"main...agent/{agent_id}", "--quiet"],
                capture_output=True,
                cwd=str(self.project_dir),
            )
            return result.returncode != 0
        except Exception:
            return False

    def _tick(self):
        try:
            with self._lock:
                if not self.state_file.exists():
                    return
                with open(self.state_file) as f:
                    data = json.load(f)

                agents = data.get("agents", [])
                messages = data.get("pending_messages", [])
                changed = False

                # Check if running agents are still alive
                for agent in agents:
                    if agent.get("status") == "running":
                        pid = agent.get("pid")
                        if pid and not self._is_process_alive(int(pid)):
                            agent_id = agent["id"]
                            # Process died — check if there's work to review
                            if self._has_diff(agent_id):
                                agent["status"] = "pending_review"
                                agent["pid"] = None
                                agent["completed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                                print(f"[MAW-Dispatch] Agent {agent_id} finished, marked for review")
                            else:
                                agent["status"] = "idle"
                                agent["task"] = ""
                                agent["pid"] = None
                                agent["completed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                                print(f"[MAW-Dispatch] Agent {agent_id} died/idle, reset to idle")
                            changed = True

                if not messages:
                    if changed:
                        with open(self.state_file, "w") as f:
                            json.dump(data, f, indent=2)
                    return

                idle_agents = [a for a in agents if a.get("status") == "idle"]
                if not idle_agents:
                    if changed:
                        with open(self.state_file, "w") as f:
                            json.dump(data, f, indent=2)
                    return

                agent = idle_agents[0]
                msg = messages[0]
                agent_id = agent["id"]
                task = msg["content"]
                msg_id = msg["id"]

                # Dispatch via subprocess call to maw dispatch
                subprocess.Popen(
                    ["maw", "dispatch", task, str(agent_id)],
                    cwd=str(self.project_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

                # Remove message from queue
                data["pending_messages"] = [m for m in messages if m["id"] != msg_id]

                with open(self.state_file, "w") as f:
                    json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[MAW-Dispatch] error: {e}")
