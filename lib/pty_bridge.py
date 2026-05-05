#!/usr/bin/env python3
"""PTY Bridge - Bidirectional PTY ↔ WebSocket forwarding."""

import os
import pty
import select
import threading
from typing import Callable


class PtyBridge:
    """Manages a PTY and forwards data between it and WebSocket clients."""

    def __init__(self, command: list[str], cwd: str = None):
        self.command = command
        self.cwd = cwd or os.getcwd()
        self.master_fd = None
        self.child_pid = None
        self.clients: set[Callable[[str], None]] = set()
        self._read_thread = None
        self._running = False

    def start(self) -> None:
        """Start the PTY and the child process."""
        self.master_fd, slave_fd = pty.openpty()
        self.child_pid = os.fork()

        if self.child_pid == 0:
            # Child process
            os.setsid()
            os.close(self.master_fd)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(slave_fd)
            os.chdir(self.cwd)
            os.execvp(self.command[0], self.command)
            os._exit(1)

        # Parent process
        os.close(slave_fd)
        self._running = True
        self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._read_thread.start()

    def _read_loop(self) -> None:
        """Read from PTY and broadcast to all clients."""
        while self._running:
            try:
                readable, _, _ = select.select([self.master_fd], [], [], 0.1)
                if readable:
                    data = os.read(self.master_fd, 4096)
                    if not data:
                        break
                    text = data.decode("utf-8", errors="replace")
                    for client in list(self.clients):
                        try:
                            client(text)
                        except Exception:
                            pass
            except (OSError, select.error):
                break

    def write(self, data: str) -> None:
        """Write data to PTY stdin."""
        if self.master_fd is not None:
            os.write(self.master_fd, data.encode("utf-8"))

    def inject(self, text: str) -> None:
        """Inject text into PTY (simulates typing)."""
        self.write(text)

    def add_client(self, callback: Callable[[str], None]) -> None:
        self.clients.add(callback)

    def remove_client(self, callback: Callable[[str], None]) -> None:
        self.clients.discard(callback)

    def stop(self) -> None:
        self._running = False
        if self.master_fd is not None:
            os.close(self.master_fd)
            self.master_fd = None
        if self.child_pid:
            try:
                os.kill(self.child_pid, 15)
            except ProcessLookupError:
                pass
